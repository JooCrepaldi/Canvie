// L9 E2E driver: Seleção, Mão and the double click on the release build.
// Seleção is the default; a double click on the empty canvas writes a note;
// a click selects, a drag moves, Delete removes and the context bar aligns;
// the Mão moves only the camera; Esc first drops the selection, then pins.
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp, placementOf, waitForPlacement } from './lib/app.mjs'
import { activeTool, areaRect, center, chooseTool, click, clickElement, defineArea, drag, pressDelete, pressEnter, pressEscape, pressLetter, pressed, readRaw, screenshot, typeText } from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'

const DOC_KEY = 'canvie.document'
const SETTLE_MS = 350 + 400
const TOOL_NAMES = { hand: 'Mão', brush: 'Pincel', text: 'Texto', postit: 'Post-it', eraser: 'Borracha' }
const editorOpen = "document.activeElement?.classList.contains('note-editor') === true"

const { values: options } = parseArgs({
  options: {
    exe: { type: 'string' },
    port: { type: 'string', default: '9333' },
    evidence: { type: 'string' },
  },
})
if (!options.exe || !existsSync(options.exe)) {
  console.error(`Release executable not found: ${options.exe ?? '(missing --exe)'}`)
  process.exit(2)
}

const exe = options.exe
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l9-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const app = new CanvieApp({ exe, port: Number(options.port), profileDir, onReady: (label, ms) => report.measure(`launch ready ms (${label})`, ms) })

const readDoc = async (page) => JSON.parse(await readRaw(page, DOC_KEY))
// The active tool by name; Seleção is no tool at all.
const pressedTools = async (page) => {
  const tool = await activeTool(page)
  return tool in TOOL_NAMES ? [TOOL_NAMES[tool]] : []
}
const selectedText = (page) => page.evaluate("document.querySelector('.note.is-selected')?.textContent.trim() ?? null")
const contextBar = (page) => page.evaluate("document.querySelector('.context-bar') !== null")
const doubleClick = async (page, x, y) => {
  await click(page, x, y, 1)
  await click(page, x, y, 2)
}

async function firstRun() {
  const page = await app.launch('fresh profile', { edit: true })
  const isolated = app.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  await defineArea(page, { x: 160, y: 140 }, { x: 1000, y: 700 })
  report.check('Edit starts in Seleção, with no tool pressed', (await pressedTools(page)).length === 0, JSON.stringify(await pressedTools(page)))
  report.check('the toolbar has Mão instead of Mover', (await pressed(page, 'Mão,')) === 'false' && !(await page.evaluate(`document.querySelector('button[aria-label^="Mover,"]') !== null`)))
}

async function doubleClickWrites() {
  const page = app.page
  const rect = await areaRect(page)
  await doubleClick(page, rect.x + 120, rect.y + 120)
  const opened = await page.waitFor(editorOpen).then(() => true, () => false)
  report.check('a double click on the empty canvas opens a text note editor', opened)
  if (!opened) return
  await typeText(page, 'Nova ideia\nsegunda linha mais longa')
  await pressEnter(page, 2)
  await sleep(SETTLE_MS)
  const note = (await readDoc(page)).notes.at(-1)
  report.check('the note is stored where the double click landed', note?.kind === 'text' && note.text === 'Nova ideia\nsegunda linha mais longa' && note.font === 'sans' && note.align === 'left', JSON.stringify(note))
  report.check('after the note, the canvas is back in Seleção with the note selected', (await pressedTools(page)).length === 0 && (await selectedText(page))?.includes('Nova ideia') && (await contextBar(page)))
  await screenshot(page, report.file('l9-01-selected.png'))
}

async function moveAlignDelete() {
  const page = app.page
  const before = (await readDoc(page)).notes.at(-1)
  const from = await center(page, '.note.is-selected')
  await drag(page, [from, { x: from.x + 20, y: from.y + 10 }, { x: from.x + 40, y: from.y + 30 }])
  await sleep(SETTLE_MS)
  const moved = (await readDoc(page)).notes.at(-1)
  report.check('dragging the selected note moves it by the pointer distance', moved.x === before.x + 40 && moved.y === before.y + 30, `${before.x},${before.y} -> ${moved.x},${moved.y}`)
  report.check('the note stays selected after the move', (await selectedText(page))?.includes('Nova ideia'))

  await clickElement(page, 'button[aria-label="Centralizar"]')
  await sleep(SETTLE_MS)
  const aligned = (await readDoc(page)).notes.at(-1)
  const rendered = await page.evaluate("getComputedStyle(document.querySelector('.note.is-selected')).textAlign")
  report.check('Centralizar stores and renders align center', aligned.align === 'center' && rendered === 'center' && (await pressed(page, 'Centralizar')) === 'true', `${aligned.align} / ${rendered}`)

  await pressDelete(page)
  await sleep(SETTLE_MS)
  report.check('Delete removes the selected note', !(await readDoc(page)).notes.some((note) => note.id === aligned.id) && !(await contextBar(page)))
  await pressLetter(page, 'z', 2)
  await sleep(SETTLE_MS)
  const restored = (await readDoc(page)).notes.find((note) => note.id === aligned.id)
  report.check('Ctrl + Z brings the deleted note back, centered', restored?.align === 'center' && restored.x === moved.x)
}

async function handOnlyPans() {
  const page = app.page
  await chooseTool(page, 'Mão')
  report.check('H chooses the Mão and drops the selection', (await pressedTools(page)).join() === 'Mão' && (await selectedText(page)) === null)
  const before = await readDoc(page)
  const note = before.notes.at(-1)
  const from = await center(page, '.note-text')
  await drag(page, [from, { x: from.x + 30, y: from.y + 20 }, { x: from.x + 60, y: from.y + 40 }])
  await sleep(SETTLE_MS)
  const after = await readDoc(page)
  const unchanged = after.notes.find((candidate) => candidate.id === note.id)
  report.check('dragging over a note with the Mão moves the camera, not the note', after.camera.x === before.camera.x - 60 && after.camera.y === before.camera.y - 40 && unchanged.x === note.x && unchanged.y === note.y, `camera ${before.camera.x},${before.camera.y} -> ${after.camera.x},${after.camera.y}`)

  const rect = await areaRect(page)
  await doubleClick(page, rect.x + rect.width - 220, rect.y + rect.height - 120)
  const opened = await page.waitFor(editorOpen).then(() => true, () => false)
  report.check('a double click with the Mão also opens a note', opened)
  if (opened) {
    await typeText(page, 'Com a Mão')
    await pressEnter(page, 2)
    await sleep(SETTLE_MS)
    report.check('the note written with the Mão returns to Seleção', (await pressedTools(page)).length === 0 && (await selectedText(page)) === 'Com a Mão')
  }
}

async function toggles() {
  const page = app.page
  await pressLetter(page, 'b')
  const brush = await pressedTools(page)
  await pressLetter(page, 'b')
  const afterSecond = await pressedTools(page)
  await pressLetter(page, 'e')
  const eraser = await pressedTools(page)
  const pincelShown = await pressed(page, 'Pincel,')
  await clickElement(page, 'button[aria-label^="Pincel,"]')
  const afterClick = await pressedTools(page)
  report.check('repeating a tool letter or clicking the active tool goes back to Seleção', brush.join() === 'Pincel' && afterSecond.length === 0 && eraser.join() === 'Borracha' && afterClick.length === 0, JSON.stringify([brush, afterSecond, eraser, afterClick]))
  report.check('the Borracha keeps the Pincel pressed in the toolbar', pincelShown === 'true')

  await pressLetter(page, 'e')
  await clickElement(page, 'button[aria-label="Tinta azul"]')
  report.check('choosing an ink chooses the Pincel', (await pressedTools(page)).join() === 'Pincel')
  const rect = await areaRect(page)
  const notesBefore = (await readDoc(page)).notes.length
  await doubleClick(page, rect.x + rect.width / 2, rect.y + 60)
  await sleep(300)
  report.check('a double click with the Pincel opens no editor', !(await page.evaluate(editorOpen)) && (await readDoc(page)).notes.length === notesBefore)

  await pressLetter(page, 'p')
  await click(page, rect.x + rect.width / 2 + 40, rect.y + rect.height / 2 + 20)
  await page.waitFor(editorOpen)
  await typeText(page, 'Post-it novo')
  await pressEnter(page, 2)
  await sleep(SETTLE_MS)
  report.check('a new post-it also returns to Seleção, selected', (await pressedTools(page)).length === 0 && (await selectedText(page)) === 'Post-it novo')
}

async function escapeSteps() {
  const page = app.page
  await clickElement(page, '.note-postit')
  report.check('a click selects a note in Seleção', (await selectedText(page)) === 'Post-it novo')
  await pressEscape(page)
  await sleep(200)
  report.check('the first Esc drops the selection and stays in Edit', (await selectedText(page)) === null && (await placementOf(page)).placement === 'edit')
  await pressEscape(page)
  report.measure('second Esc to Wall ms', await waitForPlacement(page, 'wall'))
  report.check('the second Esc saves and pins', (await readDoc(page)).notes.some((note) => note.text === 'Post-it novo'))
}

try {
  for (const scenario of [firstRun, doubleClickWrites, moveAlignDelete, handOnlyPans, toggles, escapeSteps]) {
    console.log(`\n== ${scenario.name}`)
    await scenario()
  }
  await app.stop('close')
} catch (error) {
  report.check('E2E run completed', false, error instanceof Error ? error.message : String(error))
} finally {
  if (app.current) await app.stop('kill').catch(() => undefined)
  app.removeProfile()
}

report.checkLog(app.launches)
process.exit(report.finish({ exe, executable: statSync(exe).mtime }))
