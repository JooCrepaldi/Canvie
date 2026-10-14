// L2 E2E driver: persistent document on the real release build.
//
// The driver talks to the WebView2 page through the DevTools protocol and
// sends real input events. WEBVIEW2_USER_DATA_FOLDER moves the WebView2
// profile to a throwaway folder, so the user's canvas is never read or
// written. The run stops before any write when that redirect is not in effect.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp, closeWindow, webviewCommandLines } from './lib/app.mjs'
import {
  areaRect,
  canvasDigest,
  click,
  clickElement,
  defineArea,
  drag,
  FILLER_KEY,
  fillStorage,
  notice,
  pressEnter,
  pressLetter,
  pressed,
  readRaw,
  screenshot,
  typeText,
  wheel,
  withTimeout,
  writeRaw,
} from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'

const DOC_KEY = 'canvie.document.v1'
const BACKUP_KEY = 'canvie.document.invalid.v1'
const SETTLE_MS = 350 + 400
const AREA_START = { x: 20, y: 70 }
const AREA_END = { x: 880, y: 590 }

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
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l2-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const app = new CanvieApp({ exe, port: Number(options.port), profileDir, onReady: (label, ms) => report.measure(`launch ready ms (${label})`, ms) })

async function readDoc(page) {
  const raw = await readRaw(page, DOC_KEY)
  return raw === null ? null : JSON.parse(raw)
}

async function ensureArea(page) {
  if (await page.evaluate("document.querySelector('.area-selector') !== null")) await defineArea(page, AREA_START, AREA_END)
  return areaRect(page)
}

function gridStrokes(rect, count) {
  const columns = 10
  const rows = Math.ceil(count / columns)
  const top = rect.y + 110
  const cellWidth = (rect.width - 40) / columns
  const cellHeight = (rect.height - 140) / rows
  return Array.from({ length: count }, (_, index) => {
    const x = rect.x + 20 + cellWidth * ((index % columns) + 0.5)
    const y = top + cellHeight * (Math.floor(index / columns) + 0.5)
    return Array.from({ length: 6 }, (_, step) => ({ x: Math.round(x - 20 + step * 8), y: Math.round(y + (step % 2 === 0 ? -6 : 6)) }))
  })
}

function longStroke(rect, y, points) {
  return Array.from({ length: points }, (_, step) => ({ x: rect.x + 40 + ((rect.width - 80) * step) / (points - 1), y: y + Math.sin(step / 3) * 12 }))
}

function largeDocument(strokeCount, pointsPerStroke, revision) {
  const strokes = Array.from({ length: strokeCount }, (_, index) => ({
    id: index + 1,
    points: Array.from({ length: pointsPerStroke }, (_, step) => ({
      x: (index % 30) * 25 - 375 + step * 0.37 + Math.random(),
      y: Math.floor(index / 30) * 12 - 120 + Math.sin(step / 4) * 9 + Math.random(),
    })),
    color: '#1F2328',
    width: 3,
  }))
  const area = { x: AREA_START.x, y: AREA_START.y, width: AREA_END.x - AREA_START.x, height: AREA_END.y - AREA_START.y }
  return { version: 1, revision, area, background: 'paper', strokes, notes: [], camera: { x: 0, y: 0, zoom: 1 } }
}

async function freshBoot() {
  const page = await app.launch('fresh profile', { edit: true })
  // Safety: prove WebView2 runs on the throwaway profile before any write.
  const isolated = app.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  report.check('fresh profile boots with no stored document', (await readRaw(page, DOC_KEY)) === null)
  report.check('fresh profile shows no notice', (await notice(page)) === null)
  report.check('fresh profile asks for the area first', await page.evaluate("document.querySelector('.area-selector') !== null && document.querySelector('.canvas-area') === null"))
}

async function l1Workload() {
  const page = app.page
  const rect = await ensureArea(page)
  report.measure('area', rect)
  const strokes = gridStrokes(rect, 50)
  for (const points of strokes) await drag(page, points)

  await pressLetter(page, 't')
  await click(page, rect.x + 40, rect.y + 30)
  await page.waitFor("document.activeElement?.classList.contains('note-editor') === true")
  await typeText(page, 'teste')
  const typed = await page.evaluate("document.querySelector('.note-editor').value")
  report.check('typing in a note does not trigger tool shortcuts', typed === 'teste' && (await pressed(page, 'Nota')) === 'true', `value=${typed}`)
  await pressEnter(page, 2)

  await pressLetter(page, 'e')
  const target = strokes[0][2]
  await drag(page, [
    { x: target.x - 4, y: target.y - 4 },
    { x: target.x, y: target.y },
    { x: target.x + 4, y: target.y + 4 },
  ])
  await sleep(SETTLE_MS)
  report.check('eraser removal is saved', (await readDoc(page)).strokes.length === 49)
  await pressLetter(page, 'z', 2)
  await sleep(SETTLE_MS)
  report.check('undo is saved', (await readDoc(page)).strokes.length === 50)
  await pressLetter(page, 'y', 2)
  await sleep(SETTLE_MS)
  report.check('redo is saved', (await readDoc(page)).strokes.length === 49)

  await clickElement(page, 'button[aria-label="Mover, atalho Space"]')
  report.check('cursor tool is active for the pan', (await pressed(page, 'Mover,')) === 'true')
  const middle = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) }
  await drag(page, [middle, { x: middle.x + 20, y: middle.y + 10 }, { x: middle.x + 40, y: middle.y + 30 }, { x: middle.x + 60, y: middle.y + 40 }])
  await wheel(page, middle.x, middle.y, -100)
  await wheel(page, middle.x, middle.y, -100)
  await sleep(SETTLE_MS)

  const doc = await readDoc(page)
  const ids = [...doc.strokes.map((stroke) => stroke.id), ...doc.notes.map((note) => note.id)]
  // Area, 50 strokes, note, eraser, undo, redo, pan and two zoom steps.
  report.check('area, 50 strokes, note, eraser, undo, redo, pan and zoom persist as one document', doc.revision === 58 && doc.strokes.length === 49 && doc.notes.length === 1 && doc.notes[0].text === 'teste', `revision=${doc.revision} strokes=${doc.strokes.length} notes=${doc.notes.length}`)
  report.check('camera is persisted', doc.camera.x === -60 && doc.camera.y === -40 && Math.abs(doc.camera.zoom - 1.21) < 1e-9, JSON.stringify(doc.camera))
  report.check('element ids are unique', new Set(ids).size === ids.length)
  await screenshot(page, report.file('l2-01-before-kill.png'))
}

async function killAndRestore() {
  const before = await readRaw(app.page, DOC_KEY)
  const digestBefore = await canvasDigest(app.page)
  report.measure('WebView2 exit after canvie.exe was killed ms', await app.stop('kill'))
  const page = await app.launch('after kill', { edit: true })
  const after = await readRaw(page, DOC_KEY)
  const digestAfter = await canvasDigest(page)
  report.check('killed process reopens with the same stored document', after === before, `${after?.length ?? 0} chars`)
  report.check('restored document is drawn', digestAfter.ink > 0 && digestAfter.ink === digestBefore.ink, `ink before=${digestBefore.ink} after=${digestAfter.ink}`)
  report.check('restore shows no notice', (await notice(page)) === null)
  await screenshot(page, report.file('l2-02-after-restart.png'))

  const restored = JSON.parse(after)
  const maxId = Math.max(...restored.strokes.map((stroke) => stroke.id), ...restored.notes.map((note) => note.id))
  const rect = await areaRect(page)
  await drag(page, longStroke(rect, rect.y + 90, 8))
  await sleep(SETTLE_MS)
  const next = await readDoc(page)
  const added = next.strokes.at(-1)
  report.check('new ids continue beyond restored ids', added.id === maxId + 1 && next.revision === restored.revision + 1, `id=${added.id} max restored=${maxId}`)
}

async function writeFailure() {
  const page = app.page
  const rect = await areaRect(page)
  const before = await readDoc(page)
  const inkBefore = (await canvasDigest(page)).ink
  report.measure('localStorage free chars next to the stored document', await fillStorage(page, 2_000))

  await drag(page, longStroke(rect, rect.y + rect.height - 50, 150))
  await sleep(SETTLE_MS)
  const failed = await notice(page)
  report.check('quota error shows the save failure with a retry action', failed?.role === 'alert' && failed.text.includes('Não foi possível salvar') && failed.text.includes('Tentar novamente'), failed?.text)
  report.check('last valid document stays in storage during the failure', (await readDoc(page)).revision === before.revision)
  report.check('session keeps the unsaved stroke in memory', (await canvasDigest(page)).ink > inkBefore)

  await drag(page, longStroke(rect, rect.y + rect.height - 90, 100))
  await sleep(SETTLE_MS)
  report.check('next edit retries and still keeps the last valid document', (await readDoc(page)).revision === before.revision && (await notice(page))?.role === 'alert')

  await page.evaluate(`localStorage.removeItem(${JSON.stringify(FILLER_KEY)})`)
  await clickElement(page, '.canvas-notice .notice-action')
  await sleep(300)
  const saved = await readDoc(page)
  report.check('Tentar novamente saves both kept edits', saved.revision === before.revision + 2 && saved.strokes.length === before.strokes.length + 2, `revision=${saved.revision}`)
  report.check('failure notice clears after a successful save', (await notice(page)) === null)
  report.check('process stayed alive through the failure', app.child.exitCode === null)
}

async function invalidPayloads() {
  const valid = { version: 1, revision: 4, area: { x: 20, y: 70, width: 400, height: 300 }, background: 'paper', strokes: [], notes: [], camera: { x: 0, y: 0, zoom: 1 } }
  const stroke = { id: 1, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#1F2328', width: 3 }
  const payloads = [
    ['truncated JSON', '{"version":1,"revision":3,"strokes":[{"id":1'],
    ['future version with 2 MB of content', JSON.stringify({ ...valid, version: 2, layers: 'x'.repeat(2_000_000) })],
    ['L2 document without area or background', JSON.stringify({ version: 1, revision: 5, strokes: [stroke], notes: [], camera: { x: 0, y: 0, zoom: 1 } })],
    ['duplicate ids', JSON.stringify({ ...valid, strokes: [stroke], notes: [{ id: 1, x: 0, y: 0, text: 'a', size: 'medium', kind: 'text' }] })],
    ['zoom outside the camera range', JSON.stringify({ ...valid, camera: { x: 0, y: 0, zoom: 99 } })],
  ]
  for (const [index, [name, payload]] of payloads.entries()) {
    await writeRaw(app.page, DOC_KEY, payload)
    await app.stop('kill')
    const page = await app.launch(`invalid: ${name}`, { edit: true })
    await sleep(2_000)
    const shown = await notice(page)
    const empty = await page.evaluate("document.querySelector('.canvas-area') === null && document.querySelector('.area-selector') !== null")
    report.check(`invalid payload (${name}) boots an empty canvas without crashing`, app.child.exitCode === null && empty && shown?.role === 'status' && shown.text.includes('inválido'), shown?.text)
    report.check(`invalid payload (${name}) is backed up and left untouched`, (await readRaw(page, BACKUP_KEY)) === payload && (await readRaw(page, DOC_KEY)) === payload, `${payload.length} chars`)
    if (index === 0) {
      await screenshot(page, report.file('l2-03-invalid-json.png'))
      const rect = await ensureArea(page)
      await drag(page, longStroke(rect, rect.y + 130, 8))
      await sleep(SETTLE_MS)
      const doc = await readDoc(page)
      report.check('first edits after recovery replace the invalid payload and keep the backup', doc?.revision === 2 && doc.strokes.length === 1 && (await readRaw(page, BACKUP_KEY)) === payload)
    }
  }
}

async function closeRightAfterEdit() {
  const page = app.page
  const rect = await ensureArea(page)
  await drag(page, longStroke(rect, rect.y + 150, 8))
  await sleep(SETTLE_MS)
  const saved = await readDoc(page)
  await drag(page, longStroke(rect, rect.y + 190, 8))
  await app.stop('close')
  const reopened = await readDoc(await app.launch('after close', { edit: true }))
  report.check('closing the window right after an edit keeps that edit', reopened.revision === saved.revision + 1, `stored revision=${reopened.revision}, edit was revision ${saved.revision + 1}`)
}

async function treeKillDurability() {
  const outcomes = []
  for (const delayMs of [600, 2_000, 6_000, 12_000]) {
    const page = app.page
    const rect = await areaRect(page)
    await drag(page, longStroke(rect, rect.y + 230, 8))
    await sleep(SETTLE_MS)
    const expected = (await readDoc(page)).revision
    await sleep(Math.max(0, delayMs - SETTLE_MS))
    await app.stop('tree')
    const stored = (await readDoc(await app.launch(`after tree kill ${delayMs} ms`, { edit: true }))).revision
    outcomes.push({ msAfterEdit: delayMs, kept: stored === expected, stored, expected })
  }
  report.measure('process tree killed N ms after the last edit', outcomes)
}

async function editDuringSave() {
  await writeRaw(app.page, DOC_KEY, JSON.stringify(largeDocument(600, 80, 1_000)))
  await app.stop('kill')
  const page = await app.launch('large document', { edit: true })
  const loaded = await readDoc(page)
  report.check('large document loads', loaded.strokes.length === 600 && (await canvasDigest(page)).ink > 0)
  report.measure('large document chars', (await readRaw(page, DOC_KEY)).length)

  await page.evaluate(`(() => {
    window.__canvieE2E = { longTasks: [] }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__canvieE2E.longTasks.push(Math.round(entry.duration))
    }).observe({ type: 'longtask' })
    return true
  })()`)
  const rect = await areaRect(page)
  for (let index = 0; index < 12; index += 1) {
    // The previous stroke's save fires about 200 ms into this stroke.
    await drag(page, longStroke(rect, rect.y + 60 + index * 35, 38), 16)
    await sleep(150)
  }
  await sleep(SETTLE_MS)
  const doc = await readDoc(page)
  const longTasks = await page.evaluate('window.__canvieE2E.longTasks')
  const worst = longTasks.length === 0 ? 0 : Math.max(...longTasks)
  report.check('strokes drawn while saves run are all kept', doc.strokes.length === 612 && doc.revision === 1_012, `strokes=${doc.strokes.length} revision=${doc.revision}`)
  report.check('no main-thread task reaches 100 ms while drawing over saves', worst < 100, `long tasks=${JSON.stringify(longTasks)}`)
  const cost = await page.evaluate(`(() => {
    const raw = localStorage.getItem(${JSON.stringify(DOC_KEY)})
    const doc = JSON.parse(raw)
    const started = performance.now()
    const serialized = JSON.stringify(doc)
    localStorage.setItem('canvie.e2e.timing', serialized)
    const confirmed = localStorage.getItem('canvie.e2e.timing') === serialized
    const elapsed = performance.now() - started
    localStorage.removeItem('canvie.e2e.timing')
    return { chars: raw.length, stringifyWriteReadMs: Math.round(elapsed * 10) / 10, confirmed }
  })()`)
  report.measure('save cost for the large document', cost)
  await screenshot(page, report.file('l2-04-large-document.png'))
}

async function realProfileLocation() {
  const env = { ...process.env }
  delete env.WEBVIEW2_USER_DATA_FOLDER
  delete env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
  const child = spawn(exe, [], { env, stdio: 'ignore' })
  const exited = new Promise((resolve) => child.once('exit', resolve))
  const expected = join(process.env.APPDATA ?? '', 'com.canvie.app', 'EBWebView').toLowerCase()
  let found = false
  for (let attempt = 0; attempt < 30 && !found; attempt += 1) {
    await sleep(500)
    found = webviewCommandLines().some((line) => line.toLowerCase().includes(expected))
  }
  app.launches += 1
  report.check('default launch keeps the WebView2 profile under %APPDATA%\\com.canvie.app', found)
  // A real profile without an area opens in Edit, where the frontend answers
  // WM_CLOSE, and it may still be loading. Nothing was edited, so ending the
  // process writes nothing to the real profile.
  closeWindow(child.pid)
  const closed = await withTimeout(exited, 5_000, 'still running').then(() => true, () => false)
  if (!closed) {
    execFileSync('taskkill', ['/PID', String(child.pid), '/F'], { stdio: 'ignore' })
    await withTimeout(exited, 20_000, 'Canvie did not exit after taskkill')
  }
}

const scenarios = [freshBoot, l1Workload, killAndRestore, writeFailure, invalidPayloads, closeRightAfterEdit, treeKillDurability, editDuringSave]
try {
  for (const scenario of scenarios) {
    console.log(`\n== ${scenario.name}`)
    await scenario()
  }
  await app.stop('close')
  console.log('\n== realProfileLocation')
  await realProfileLocation()
} catch (error) {
  report.check('E2E run completed', false, error instanceof Error ? error.message : String(error))
} finally {
  if (app.current) await app.stop('kill').catch(() => undefined)
  app.removeProfile()
}

report.checkLog(app.launches)
process.exit(report.finish({ exe, executable: statSync(exe).mtime }))
