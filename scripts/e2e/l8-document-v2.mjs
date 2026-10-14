// L8 E2E driver: the v2 document and the migration from v1. A build that
// still writes v1 (--legacy-exe) creates a real document through the UI; the
// new build (--exe) opens the same profile, migrates it, and writes v2 on the
// first save while the v1 key stays untouched as the copy.
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp, waitForPlacement } from './lib/app.mjs'
import { areaRect, canvasDigest, click, clickElement, defineArea, drag, notice, pressEnter, pressEscape, pressLetter, readRaw, screenshot, selectionMode, typeText } from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'

const DOC_KEY = 'canvie.document'
const LEGACY_KEY = 'canvie.document.v1'
const INVALID_KEY = 'canvie.document.invalid'
const SETTLE_MS = 350 + 400
const MARKDOWN = '# Ideias\n\n| Coluna | Valor |\n| --- | --- |\n| a | 1 |'
const INKS = [['Tinta preta', '#1F2328'], ['Tinta azul', '#2563EB'], ['Tinta vermelha', '#DC2626']]
const editorOpen = "document.activeElement?.classList.contains('note-editor') === true"

const { values: options } = parseArgs({
  options: {
    exe: { type: 'string' },
    'legacy-exe': { type: 'string' },
    port: { type: 'string', default: '9333' },
    evidence: { type: 'string' },
  },
})
for (const [name, path] of [['--exe', options.exe], ['--legacy-exe', options['legacy-exe']]]) {
  if (!path || !existsSync(path)) {
    console.error(`Executable not found for ${name}: ${path ?? '(missing)'}`)
    process.exit(2)
  }
}

const port = Number(options.port)
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l8-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const onReady = (label, ms) => report.measure(`launch ready ms (${label})`, ms)
const legacyApp = new CanvieApp({ exe: options['legacy-exe'], port, profileDir, onReady })
const app = new CanvieApp({ exe: options.exe, port, profileDir, onReady })

const raw = (page, key) => readRaw(page, key)
const json = async (page, key) => JSON.parse(await raw(page, key))
let legacyRaw = null

// Rewrites the stored payloads and reloads the page, like a new launch.
async function reloadWith(page, entries) {
  await page.evaluate(`(() => {
    for (const [key, value] of ${JSON.stringify(entries)}) {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
    location.reload()
    return true
  })()`)
  await sleep(300)
  await page.waitFor("document.querySelector('.canvie-shell') !== null && (document.querySelector('.canvas-area') === null || (document.querySelector('canvas')?.width ?? 0) > 1)")
  await sleep(400)
}

const noteStyles = (page) =>
  page.evaluate(`[...document.querySelectorAll('.note')].map((element) => {
    const style = getComputedStyle(element)
    return { kind: element.classList.contains('note-postit') ? 'postit' : 'text', size: style.fontSize, font: style.fontFamily, align: style.textAlign, color: style.color }
  })`)
// Notices show only in Edit, so a check for one enters Edit first.
async function editNow(page) {
  await page.evaluate("window.__TAURI_INTERNALS__.invoke('enter_edit').catch(() => null)")
  await waitForPlacement(page, 'edit')
}

const areaColor = (page) => page.evaluate("getComputedStyle(document.querySelector('.canvas-area')).backgroundColor")

async function legacyDocument() {
  const page = await legacyApp.launch('legacy build', { edit: true })
  const isolated = legacyApp.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  await defineArea(page, { x: 180, y: 140 }, { x: 980, y: 660 })
  const rect = await areaRect(page)
  for (const [index, [label]] of INKS.entries()) {
    await clickElement(page, `button[aria-label="${label}"]`)
    const y = rect.y + rect.height - 120 + index * 30
    await drag(page, Array.from({ length: 10 }, (_, step) => ({ x: rect.x + 30 + step * 15, y: y + Math.sin(step) * 6 })))
  }
  await pressLetter(page, 't')
  await click(page, rect.x + 30, rect.y + 20)
  await page.waitFor(editorOpen)
  await typeText(page, MARKDOWN)
  await pressEnter(page, 2)
  await pressLetter(page, 'p')
  await click(page, rect.x + rect.width - 270, rect.y + 40)
  await page.waitFor(editorOpen)
  await clickElement(page, 'button[aria-label="Texto grande"]')
  await typeText(page, 'Ligar para **Ana**')
  await pressEnter(page, 2)
  await clickElement(page, 'button[aria-label^="Fundo"]')
  await clickElement(page, 'button.toolbar-pin')
  await waitForPlacement(page, 'wall')
  legacyRaw = await raw(page, LEGACY_KEY)
  const legacy = legacyRaw && JSON.parse(legacyRaw)
  report.measure('legacy document', { version: legacy?.version, revision: legacy?.revision, strokes: legacy?.strokes.length, notes: legacy?.notes.map((note) => note.size), background: legacy?.background })
  report.check('the legacy build saved a v1 document with three strokes, a note and a post-it', legacy?.version === 1 && legacy.strokes.length === 3 && legacy.notes.length === 2 && legacy.background === 'transparent')
  if (legacy?.version !== 1) throw new Error('--legacy-exe did not write a v1 document; it must be a build from before L8')
  await legacyApp.stop('close')
}

async function migratedLoad() {
  const page = await app.launch('new build on the legacy profile')
  const legacy = JSON.parse(legacyRaw)
  const rect = await areaRect(page)
  const styles = await noteStyles(page)
  const dom = await page.evaluate("({ rows: document.querySelectorAll('.note-text table tbody tr').length, postit: document.querySelector('.note-postit strong')?.textContent ?? null })")
  report.check('the v1 key is untouched and nothing is written before the first edit', (await raw(page, LEGACY_KEY)) === legacyRaw && (await raw(page, DOC_KEY)) === null)
  report.check('the migrated canvas keeps the area', rect.x === legacy.area.x && rect.y === legacy.area.y && rect.width === legacy.area.width && rect.height === legacy.area.height, JSON.stringify(rect))
  report.check('the migrated notes keep their text and pixel sizes', dom.rows === 1 && dom.postit === 'Ana' && styles.find((style) => style.kind === 'text')?.size === '18px' && styles.find((style) => style.kind === 'postit')?.size === '24px', JSON.stringify(styles))
  report.check('the migrated strokes draw and the background stays transparent', (await canvasDigest(page)).ink > 0 && (await areaColor(page)) === 'rgba(0, 0, 0, 0)')
  await editNow(page)
  report.check('a valid v1 document opens without the recovery notice', (await notice(page)) === null)
  await screenshot(page, report.file('l8-01-migrated.png'))
}

async function firstSaveWritesV2() {
  const page = app.page
  await editNow(page)
  const rect = await areaRect(page)
  await clickElement(page, 'button[aria-label^="Pincel"]')
  await drag(page, Array.from({ length: 10 }, (_, step) => ({ x: rect.x + 300 + step * 15, y: rect.y + 260 + Math.cos(step) * 6 })))
  await sleep(SETTLE_MS)
  const legacy = JSON.parse(legacyRaw)
  const doc = await json(page, DOC_KEY)
  const sameStrokes = legacy.strokes.every((stroke, index) => {
    const migrated = doc.strokes[index]
    return migrated.id === stroke.id && migrated.color === stroke.color && migrated.width === stroke.width && migrated.brush === 'pen' && JSON.stringify(migrated.points) === JSON.stringify(stroke.points)
  })
  const sizes = { small: 'sm', medium: 'md', large: 'lg' }
  const sameNotes = legacy.notes.every((note, index) => {
    const migrated = doc.notes[index]
    return migrated.id === note.id && migrated.text === note.text && migrated.kind === note.kind && migrated.x === note.x && migrated.y === note.y && migrated.size === sizes[note.size] && migrated.font === 'sans' && migrated.align === 'left'
  })
  report.check('the first save writes version 2 at the next revision', doc.version === 2 && doc.revision === legacy.revision + 1, `revision ${legacy.revision} → ${doc.revision}`)
  report.check('the migrated strokes keep id, color, width and points, with the pen brush', sameStrokes && doc.strokes.length === legacy.strokes.length + 1 && doc.strokes.at(-1).brush === 'pen')
  report.check('the migrated notes keep id, text and position, with the same pixel size, sans and left', sameNotes)
  report.check('area, background and camera are unchanged', JSON.stringify([doc.area, doc.background, doc.camera]) === JSON.stringify([legacy.area, legacy.background, legacy.camera]))
  report.check('the v1 key stays untouched after the v2 save', (await raw(page, LEGACY_KEY)) === legacyRaw)
  await clickElement(page, 'button.toolbar-pin')
  await waitForPlacement(page, 'wall')
}

async function reopenV2() {
  const before = await raw(app.page, DOC_KEY)
  await app.stop('kill')
  const page = await app.launch('reopen v2')
  await editNow(page)
  report.check('a reopened app loads the same v2 document', (await raw(page, DOC_KEY)) === before && (await notice(page)) === null)
}

async function everyNewValue() {
  const page = app.page
  const base = await json(page, DOC_KEY)
  const doc = {
    ...base,
    background: 'black',
    strokes: [
      { id: 1, points: Array.from({ length: 20 }, (_, step) => ({ x: -300 + step * 15, y: 150 })), color: '#2563EB', width: 3, brush: 'pen' },
      { id: 2, points: Array.from({ length: 20 }, (_, step) => ({ x: -300 + step * 15, y: 200 })), color: '#EAB308', width: 24, brush: 'highlighter' },
    ],
    notes: [
      { id: 3, x: -330, y: -200, text: 'Serifa', size: 'xs', font: 'serif', align: 'left', kind: 'text' },
      { id: 4, x: -330, y: -150, text: 'Mono\nao centro', size: 'xl', font: 'mono', align: 'center', kind: 'text' },
      { id: 5, x: -330, y: -40, text: 'Direita', size: 'xxl', font: 'sans', align: 'right', kind: 'text' },
      { id: 6, x: 100, y: -200, text: 'Post-it', size: 'md', font: 'serif', align: 'center', kind: 'postit' },
    ],
  }
  await reloadWith(page, [[DOC_KEY, JSON.stringify(doc)]])
  const styles = await noteStyles(page)
  const [serif, mono, right, postit] = styles
  report.check('every v2 note value renders', serif?.size === '12px' && serif.font.startsWith('Georgia') && mono?.size === '32px' && /Cascadia Mono|Consolas/.test(mono.font) && mono.align === 'center' && right?.size === '48px' && right.align === 'right' && postit?.font.startsWith('Georgia'), JSON.stringify(styles))
  report.check('text notes turn light on the black background, post-its keep dark text', serif?.color === 'rgb(243, 244, 246)' && postit?.color === 'rgb(31, 35, 40)', `${serif?.color} / ${postit?.color}`)
  const translucent = await page.evaluate(`(() => {
    const canvas = document.querySelector('canvas')
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    let count = 0
    for (let index = 3; index < data.length; index += 4) if (data[index] >= 70 && data[index] <= 110) count += 1
    return count
  })()`)
  report.check('the highlighter draws translucent ink', translucent > 1_000, `${translucent} pixels at about 35% alpha`)
  const colors = { black: await areaColor(page) }
  await screenshot(page, report.file('l8-02-every-value.png'))
  for (const background of ['white', 'yellow']) {
    await reloadWith(page, [[DOC_KEY, JSON.stringify({ ...doc, background })]])
    colors[background] = await areaColor(page)
  }
  report.check('the black, white and yellow backgrounds paint the area', colors.black === 'rgb(28, 28, 30)' && colors.white === 'rgb(255, 255, 255)' && colors.yellow === 'rgb(254, 243, 199)', JSON.stringify(colors))
  await editNow(page)
  report.check('a document with every new value opens without the recovery notice', (await notice(page)) === null)

  // The editor has no field of its own, so it writes in the light text of a note on black.
  await reloadWith(page, [[DOC_KEY, JSON.stringify(doc)]])
  await editNow(page)
  await selectionMode(page)
  await clickElement(page, '.note-text', 2)
  await page.waitFor(editorOpen)
  const editor = await page.evaluate("(() => { const style = getComputedStyle(document.activeElement); return { color: style.color, font: style.fontFamily, size: style.fontSize } })()")
  report.check('the editor on the black background writes in light text, in the note font', editor.color === 'rgb(243, 244, 246)' && editor.font.startsWith('Georgia') && editor.size === '12px', JSON.stringify(editor))
  await pressEscape(page)
}

async function futureVersion() {
  const page = app.page
  const payload = JSON.stringify({ ...(await json(page, DOC_KEY)), version: 3 })
  await reloadWith(page, [[DOC_KEY, payload], [INVALID_KEY, null]])
  await editNow(page)
  const shown = await notice(page)
  report.check('a future version opens the recovery flow with a copy', shown?.text.includes('inválido') && (await raw(page, INVALID_KEY)) === payload && (await raw(page, DOC_KEY)) === payload, shown?.text)
}

async function invalidLegacyOnly() {
  const page = app.page
  const broken = '{"version":1,"revision":'
  await reloadWith(page, [[DOC_KEY, null], [INVALID_KEY, null], [LEGACY_KEY, broken]])
  await editNow(page)
  const shown = await notice(page)
  report.check('an invalid v1 document alone opens the recovery flow and stays untouched', shown?.text.includes('inválido') && (await raw(page, LEGACY_KEY)) === broken && (await raw(page, INVALID_KEY)) === null, shown?.text)
}

try {
  for (const scenario of [legacyDocument, migratedLoad, firstSaveWritesV2, reopenV2, everyNewValue, futureVersion, invalidLegacyOnly]) {
    console.log(`\n== ${scenario.name}`)
    await scenario()
  }
  await app.stop('kill')
} catch (error) {
  report.check('E2E run completed', false, error instanceof Error ? error.message : String(error))
} finally {
  for (const instance of [legacyApp, app]) if (instance.current) await instance.stop('kill').catch(() => undefined)
  app.removeProfile()
}

report.checkLog(legacyApp.launches + app.launches)
process.exit(report.finish({ exe: options.exe, legacyExe: options['legacy-exe'], executable: statSync(options.exe).mtime }))
