// L3 E2E driver: canvas area and MVP content on the real release build,
// with real input over the DevTools protocol and a throwaway WebView2 profile.
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp } from './lib/app.mjs'
import {
  areaRect,
  canvasDigest,
  center,
  click,
  clickElement,
  defineArea,
  drag,
  notice,
  pressEnter,
  pressEscape,
  pressLetter,
  pressed,
  readRaw,
  screenshot,
  typeText,
} from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'

const DOC_KEY = 'canvie.document.v1'
const SETTLE_MS = 350 + 400
const INKS = [
  ['Tinta preta', '#1F2328'],
  ['Tinta azul', '#2563EB'],
  ['Tinta vermelha', '#DC2626'],
]
const MARKDOWN = '# Ideias\n\n- item **um**\n- item dois\n\n| Coluna | Valor |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n\n<img src=x onerror=alert(1)> [link](javascript:alert(1))'

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
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l3-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const app = new CanvieApp({ exe, port: Number(options.port), profileDir, onReady: (label, ms) => report.measure(`launch ready ms (${label})`, ms) })

async function readDoc(page) {
  const raw = await readRaw(page, DOC_KEY)
  return raw === null ? null : JSON.parse(raw)
}

const hint = (page) => page.evaluate("document.querySelector('.area-hint')?.textContent ?? null")
const editorOpen = "document.activeElement?.classList.contains('note-editor') === true"

async function firstRun() {
  const page = await app.launch('fresh profile', { edit: true })
  const isolated = app.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  report.check('first run opens the area selector', (await hint(page))?.startsWith('Arraste para definir a área do canvas.'), await hint(page))
  await screenshot(page, report.file('l3-01-first-run.png'))

  await drag(page, [{ x: 100, y: 120 }, { x: 130, y: 140 }, { x: 150, y: 170 }])
  report.check('an area below 160 × 120 is refused', (await hint(page))?.startsWith('Área pequena demais') && (await readRaw(page, DOC_KEY)) === null, await hint(page))

  await defineArea(page, { x: 100, y: 120 }, { x: 820, y: 560 })
  await sleep(SETTLE_MS)
  const doc = await readDoc(page)
  const rect = await areaRect(page)
  report.check('dragged rectangle becomes the stored area', JSON.stringify(doc?.area) === JSON.stringify({ x: 100, y: 120, width: 720, height: 440 }) && rect.x === 100 && rect.width === 720, JSON.stringify(doc?.area))
}

async function inks() {
  const page = app.page
  const rect = await areaRect(page)
  for (const [index, [label]] of INKS.entries()) {
    await clickElement(page, `button[aria-label="${label}"]`)
    const y = rect.y + rect.height - 120 + index * 30
    await drag(page, Array.from({ length: 10 }, (_, step) => ({ x: rect.x + 30 + step * 15, y: y + Math.sin(step) * 6 })))
  }
  await sleep(SETTLE_MS)
  const colors = (await readDoc(page)).strokes.map((stroke) => stroke.color)
  report.check('one brush draws in black, blue and red', JSON.stringify(colors) === JSON.stringify(INKS.map(([, value]) => value)), JSON.stringify(colors))
  report.check('active ink is marked as pressed', (await pressed(page, 'Tinta vermelha')) === 'true' && (await pressed(page, 'Tinta preta')) === 'false')
}

async function markdownNote() {
  const page = app.page
  const rect = await areaRect(page)
  await pressLetter(page, 't')
  await click(page, rect.x + 30, rect.y + 20)
  await page.waitFor(editorOpen)
  await typeText(page, MARKDOWN)
  await pressEnter(page, 2)
  await sleep(SETTLE_MS)
  const dom = await page.evaluate(`({
    heading: document.querySelector('.note-text h1')?.textContent ?? null,
    rows: document.querySelectorAll('.note-text table tbody tr').length,
    images: document.querySelectorAll('.note img').length,
    links: document.querySelectorAll('.note a').length,
    rawHtmlAsText: document.querySelector('.note-text')?.textContent.includes('<img src=x onerror=alert(1)>') ?? false,
  })`)
  const note = (await readDoc(page)).notes[0]
  report.check('Markdown note keeps its source text', note?.text === MARKDOWN && note.kind === 'text' && note.size === 'medium')
  report.check('Markdown renders a heading and a table', dom.heading === 'Ideias' && dom.rows === 2, JSON.stringify(dom))
  report.check('raw HTML and javascript links render as text', dom.images === 0 && dom.links === 0 && dom.rawHtmlAsText)
}

async function postit() {
  const page = app.page
  const rect = await areaRect(page)
  await pressLetter(page, 'p')
  await click(page, rect.x + rect.width - 270, rect.y + rect.height - 170)
  await page.waitFor(editorOpen)
  await clickElement(page, 'button[aria-label="Texto grande"]')
  report.check('size buttons keep the note editor open', await page.evaluate(editorOpen))
  await typeText(page, 'Ligar para **Ana**')
  await pressEnter(page, 2)
  await sleep(SETTLE_MS)
  const note = (await readDoc(page)).notes.find((candidate) => candidate.kind === 'postit')
  report.check('post-it is stored with the large size', note?.text === 'Ligar para **Ana**' && note.size === 'large', JSON.stringify(note))
  report.check('post-it renders on its card', await page.evaluate("document.querySelector('.note-postit.note-large strong')?.textContent === 'Ana'"))
  await screenshot(page, report.file('l3-02-content.png'))
}

async function editMoveErase() {
  const page = app.page
  await clickElement(page, 'button[aria-label="Mover, atalho Space"]')
  await clickElement(page, '.note-postit', 2)
  await page.waitFor(editorOpen)
  await typeText(page, ' amanha')
  await pressEnter(page, 2)
  await sleep(SETTLE_MS)
  let doc = await readDoc(page)
  report.check('double click edits a post-it', doc.notes.find((note) => note.kind === 'postit')?.text === 'Ligar para **Ana** amanha')

  const before = doc.notes.find((note) => note.kind === 'text')
  const from = await center(page, '.note-text h1')
  await drag(page, [from, { x: from.x + 20, y: from.y + 10 }, { x: from.x + 40, y: from.y + 30 }])
  await sleep(SETTLE_MS)
  doc = await readDoc(page)
  const after = doc.notes.find((note) => note.kind === 'text')
  report.check('Mover drags a note by the pointer distance', after.x === before.x + 40 && after.y === before.y + 30, `${before.x},${before.y} -> ${after.x},${after.y}`)

  await pressLetter(page, 'e')
  const target = await center(page, '.note-postit')
  await drag(page, [{ x: target.x - 10, y: target.y }, target, { x: target.x + 10, y: target.y }])
  await sleep(SETTLE_MS)
  report.check('eraser removes the note it crosses', (await readDoc(page)).notes.length === 1)
  await pressLetter(page, 'z', 2)
  await sleep(SETTLE_MS)
  report.check('undo brings the erased note back', (await readDoc(page)).notes.length === 2)
}

async function background() {
  const page = app.page
  const color = () => page.evaluate("getComputedStyle(document.querySelector('.canvas-area')).backgroundColor")
  await clickElement(page, 'button[aria-label^="Fundo"]')
  await sleep(SETTLE_MS)
  report.check('background switches to transparent', (await readDoc(page)).background === 'transparent' && (await color()) === 'rgba(0, 0, 0, 0)', await color())
  await screenshot(page, report.file('l3-03-transparent.png'))
  await clickElement(page, 'button[aria-label^="Fundo"]')
  await sleep(SETTLE_MS)
  report.check('background switches back to paper', (await readDoc(page)).background === 'paper' && (await color()) === 'rgb(244, 236, 220)', await color())
}

async function redefineArea() {
  const page = app.page
  await clickElement(page, 'button[aria-label="Redefinir área do canvas"]')
  report.check('Área can be cancelled with Esc', (await hint(page))?.includes('Esc cancela'), await hint(page))
  await pressEscape(page)
  await sleep(200)
  report.check('Esc keeps the previous area', await page.evaluate("document.querySelector('.area-selector') === null") && (await readDoc(page)).area.width === 720)

  await clickElement(page, 'button[aria-label="Redefinir área do canvas"]')
  await defineArea(page, { x: 150, y: 140 }, { x: 850, y: 580 })
  await sleep(SETTLE_MS)
  const doc = await readDoc(page)
  report.check('Área redefines the rectangle and keeps the content', JSON.stringify(doc.area) === JSON.stringify({ x: 150, y: 140, width: 700, height: 440 }) && doc.notes.length === 2 && doc.strokes.length === 3)
}

async function killAndReopen() {
  const before = await readRaw(app.page, DOC_KEY)
  await app.stop('kill')
  const page = await app.launch('after kill', { edit: true })
  const rect = await areaRect(page)
  const doc = JSON.parse(await readRaw(page, DOC_KEY))
  report.check('reopened app has the same document', (await readRaw(page, DOC_KEY)) === before)
  report.check('reopened app draws the same area', rect.x === doc.area.x && rect.y === doc.area.y && rect.width === doc.area.width && rect.height === doc.area.height, JSON.stringify(rect))
  const dom = await page.evaluate("({ notes: document.querySelectorAll('.note').length, tables: document.querySelectorAll('.note table').length })")
  report.check('reopened app renders the notes, the table and the strokes', dom.notes === 2 && dom.tables === 1 && (await canvasDigest(page)).ink > 0, JSON.stringify(dom))
  report.check('reopened app shows no notice', (await notice(page)) === null)
  await screenshot(page, report.file('l3-04-after-restart.png'))
}

const scenarios = [firstRun, inks, markdownNote, postit, editMoveErase, background, redefineArea, killAndReopen]
try {
  for (const scenario of scenarios) {
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
