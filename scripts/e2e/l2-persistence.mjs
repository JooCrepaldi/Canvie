// L2 E2E driver: persistent document on the real release build.
//
// The driver talks to the WebView2 page through the DevTools protocol and
// sends real input events. WEBVIEW2_USER_DATA_FOLDER moves the WebView2
// profile to a throwaway folder, so the user's canvas is never read or
// written. The run stops before any write when that redirect is not in effect.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'

const DOC_KEY = 'canvie.document.v1'
const BACKUP_KEY = 'canvie.document.invalid.v1'
const FILLER_KEY = 'canvie.e2e.filler'
const SETTLE_MS = 350 + 400
const WEBVIEW2_DEFAULT_ARGS = '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection'

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
const port = Number(options.port)
const evidenceDir = options.evidence ?? join(tmpdir(), `canvie-e2e-l2-${new Date().toISOString().replace(/[:.]/g, '-')}`)
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const logFile = join(process.env.LOCALAPPDATA ?? '', 'com.canvie.app', 'logs', 'Canvie.log')
mkdirSync(evidenceDir, { recursive: true })

const results = []
const measurements = {}
let app = null
let launches = 0

function check(name, pass, detail = '') {
  results.push({ name, pass: Boolean(pass), detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`)
}

function measure(name, value) {
  measurements[name] = value
  console.log(`INFO  ${name}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
}

function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

class DevTools {
  static async attach(timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      try {
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
        const page = targets.find((target) => target.type === 'page')
        if (page) return await DevTools.open(page.webSocketDebuggerUrl)
      } catch {
        // The DevTools endpoint is not listening yet.
      }
      await sleep(250)
    }
    throw new Error('WebView2 DevTools endpoint did not come up')
  }

  static open(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url)
      socket.addEventListener('open', () => resolve(new DevTools(socket)), { once: true })
      socket.addEventListener('error', () => reject(new Error('DevTools socket failed')), { once: true })
    })
  }

  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.calls = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      const call = this.calls.get(message.id)
      if (!call) return
      this.calls.delete(message.id)
      if (message.error) call.reject(new Error(`${call.method}: ${message.error.message}`))
      else call.resolve(message.result)
    })
    socket.addEventListener('close', () => {
      for (const call of this.calls.values()) call.reject(new Error(`${call.method}: DevTools socket closed`))
      this.calls.clear()
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.calls.set(id, { method, resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (exceptionDetails) throw new Error(`page error: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`)
    return result.value
  }

  async waitFor(expression, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await this.evaluate(expression).catch(() => false)) return
      await sleep(100)
    }
    throw new Error(`timed out waiting for ${expression}`)
  }

  close() {
    this.socket.close()
  }
}

function webviewCommandLines() {
  const script = "Get-CimInstance Win32_Process -Filter \"Name='msedgewebview2.exe'\" | ForEach-Object { $_.CommandLine }"
  return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
}

function profileProcessCount() {
  return webviewCommandLines().filter((line) => line.includes(basename(profileDir))).length
}

async function waitForProfileRelease(timeoutMs = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (profileProcessCount() === 0) return Date.now() - started
    await sleep(500)
  }
  throw new Error('WebView2 processes kept the test profile open')
}

async function launch(label) {
  const started = Date.now()
  const child = spawn(exe, [], {
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: profileDir,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `${WEBVIEW2_DEFAULT_ARGS} --remote-debugging-port=${port}`,
    },
    stdio: 'ignore',
  })
  const exited = new Promise((resolve) => child.once('exit', resolve))
  const page = await DevTools.attach()
  await page.waitFor("(document.querySelector('canvas')?.width ?? 0) > 1")
  await sleep(200)
  launches += 1
  measure(`launch ready ms (${label})`, Date.now() - started)
  app = { child, page, exited }
  return page
}

// mode: 'kill' ends canvie.exe only, 'tree' also ends its WebView2 processes,
// 'close' sends WM_CLOSE like the window close button.
async function stop(mode) {
  const { child, page, exited } = app
  app = null
  page.close()
  const flags = { kill: ['/F'], tree: ['/T', '/F'], close: [] }[mode]
  execFileSync('taskkill', ['/PID', String(child.pid), ...flags], { stdio: 'ignore' })
  await withTimeout(exited, 20_000, `Canvie did not exit after ${mode}`)
  return waitForProfileRelease()
}

async function mouse(page, type, x, y, extra = {}) {
  await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra })
}

async function drawStroke(page, points, stepDelayMs = 0) {
  const [first] = points
  await mouse(page, 'mousePressed', first.x, first.y, { buttons: 1, clickCount: 1 })
  for (const point of points.slice(1)) {
    await mouse(page, 'mouseMoved', point.x, point.y, { buttons: 1 })
    if (stepDelayMs > 0) await sleep(stepDelayMs)
  }
  const last = points.at(-1)
  await mouse(page, 'mouseReleased', last.x, last.y, { buttons: 0, clickCount: 1 })
}

async function click(page, x, y) {
  await mouse(page, 'mousePressed', x, y, { buttons: 1, clickCount: 1 })
  await mouse(page, 'mouseReleased', x, y, { buttons: 0, clickCount: 1 })
}

async function clickElement(page, selector) {
  const center = await page.evaluate(`(() => {
    const rect = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect()
    return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null
  })()`)
  if (!center) throw new Error(`element not found: ${selector}`)
  await click(page, center.x, center.y)
}

async function press(page, key, { code, keyCode, text, modifiers = 0 }) {
  const event = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers }
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', text, ...event })
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...event })
}

function pressLetter(page, letter, modifiers = 0) {
  const upper = letter.toUpperCase()
  return press(page, letter, { code: `Key${upper}`, keyCode: upper.charCodeAt(0), text: modifiers === 0 ? letter : undefined, modifiers })
}

async function typeText(page, text) {
  for (const letter of text) await pressLetter(page, letter)
}

async function wheel(page, x, y, deltaY) {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY })
}

const readRaw = (page, key = DOC_KEY) => page.evaluate(`localStorage.getItem(${JSON.stringify(key)})`)
const writeRaw = (page, key, value) => page.evaluate(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`)

async function readDoc(page) {
  const raw = await readRaw(page)
  return raw === null ? null : JSON.parse(raw)
}

const notice = (page) =>
  page.evaluate(`(() => {
    const element = document.querySelector('.canvas-notice')
    return element ? { role: element.getAttribute('role'), text: element.textContent } : null
  })()`)

const pressed = (page, label) => page.evaluate(`document.querySelector('button[aria-label^="${label}"]')?.getAttribute('aria-pressed')`)

const canvasDigest = (page) =>
  page.evaluate(`(() => {
    const canvas = document.querySelector('canvas')
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    let ink = 0
    let hash = 2166136261
    for (let index = 0; index < data.length; index += 1) {
      hash = Math.imul(hash ^ data[index], 16777619)
      if (index % 4 === 3 && data[index] !== 0) ink += 1
    }
    return { ink, hash: (hash >>> 0).toString(16) }
  })()`)

async function screenshot(page, name) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(evidenceDir, `${name}.png`), Buffer.from(data, 'base64'))
}

function gridStrokes(view, count) {
  const columns = 10
  const rows = Math.ceil(count / columns)
  const top = 170
  const cellWidth = (view.width - 80) / columns
  const cellHeight = (view.height - top - 40) / rows
  return Array.from({ length: count }, (_, index) => {
    const x = 40 + cellWidth * ((index % columns) + 0.5)
    const y = top + cellHeight * (Math.floor(index / columns) + 0.5)
    return Array.from({ length: 6 }, (_, step) => ({ x: Math.round(x - 20 + step * 8), y: Math.round(y + (step % 2 === 0 ? -6 : 6)) }))
  })
}

function longStroke(view, row, points) {
  return Array.from({ length: points }, (_, step) => ({ x: 60 + ((view.width - 120) * step) / (points - 1), y: row + Math.sin(step / 3) * 12 }))
}

function largeDocument(strokeCount, pointsPerStroke, revision) {
  const strokes = Array.from({ length: strokeCount }, (_, index) => ({
    id: index + 1,
    points: Array.from({ length: pointsPerStroke }, (_, step) => ({
      x: (index % 30) * 25 - 375 + step * 0.37 + Math.random(),
      y: Math.floor(index / 30) * 12 - 120 + Math.sin(step / 4) * 9 + Math.random(),
    })),
    color: '#F3F4F6',
    width: 3,
  }))
  return { version: 1, revision, strokes, notes: [], camera: { x: 0, y: 0, zoom: 1 } }
}

async function fillStorage(page, headroom) {
  return page.evaluate(`(() => {
    const key = ${JSON.stringify(FILLER_KEY)}
    const fits = (length) => {
      try {
        localStorage.setItem(key, 'x'.repeat(length))
        return true
      } catch {
        return false
      }
    }
    let low = 0
    let high = 1 << 20
    while (high <= 1 << 25 && fits(high)) {
      low = high
      high *= 2
    }
    while (high - low > 256) {
      const middle = Math.floor((low + high) / 2)
      if (fits(middle)) low = middle
      else high = middle
    }
    localStorage.setItem(key, 'x'.repeat(low - ${headroom}))
    return low
  })()`)
}

async function freshBoot() {
  const page = await launch('fresh profile')
  // Safety: prove WebView2 runs on the throwaway profile before any write.
  const isolated = webviewCommandLines().some((line) => line.includes(basename(profileDir)))
  check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  check('fresh profile boots with no stored document', (await readRaw(page)) === null)
  check('fresh profile shows no notice', (await notice(page)) === null)
  check('fresh profile canvas is empty', (await canvasDigest(page)).ink === 0)
}

async function l1Workload() {
  const page = app.page
  const view = await page.evaluate('({ width: innerWidth, height: innerHeight })')
  measure('viewport', view)
  const strokes = gridStrokes(view, 50)
  for (const points of strokes) await drawStroke(page, points)

  await pressLetter(page, 't')
  await click(page, 60, 125)
  await page.waitFor("document.activeElement?.classList.contains('note-input') === true")
  await typeText(page, 'teste')
  const typed = await page.evaluate("document.querySelector('.note-input').value")
  check('typing in a note does not trigger tool shortcuts', typed === 'teste' && (await pressed(page, 'Nota')) === 'true', `value=${typed}`)
  await press(page, 'Enter', { code: 'Enter', keyCode: 13, text: '\r' })

  await pressLetter(page, 'e')
  const target = strokes[0][2]
  await drawStroke(page, [
    { x: target.x - 4, y: target.y - 4 },
    { x: target.x, y: target.y },
    { x: target.x + 4, y: target.y + 4 },
  ])
  await sleep(SETTLE_MS)
  check('eraser removal is saved', (await readDoc(page)).strokes.length === 49)
  await pressLetter(page, 'z', 2)
  await sleep(SETTLE_MS)
  check('undo is saved', (await readDoc(page)).strokes.length === 50)
  await pressLetter(page, 'y', 2)
  await sleep(SETTLE_MS)
  check('redo is saved', (await readDoc(page)).strokes.length === 49)

  await clickElement(page, 'button[aria-label="Mover, atalho Space"]')
  check('cursor tool is active for the pan', (await pressed(page, 'Mover,')) === 'true')
  const center = { x: Math.round(view.width / 2), y: Math.round(view.height / 2) }
  await drawStroke(page, [center, { x: center.x + 20, y: center.y + 10 }, { x: center.x + 40, y: center.y + 30 }, { x: center.x + 60, y: center.y + 40 }])
  await wheel(page, center.x, center.y, -100)
  await wheel(page, center.x, center.y, -100)
  await sleep(SETTLE_MS)

  const doc = await readDoc(page)
  const ids = [...doc.strokes.map((stroke) => stroke.id), ...doc.notes.map((note) => note.id)]
  check('50 strokes, note, eraser, undo, redo, pan and zoom persist as one document', doc.revision === 57 && doc.strokes.length === 49 && doc.notes.length === 1 && doc.notes[0].text === 'teste', `revision=${doc.revision} strokes=${doc.strokes.length} notes=${doc.notes.length}`)
  check('camera is persisted', doc.camera.x === -60 && doc.camera.y === -40 && Math.abs(doc.camera.zoom - 1.21) < 1e-9, JSON.stringify(doc.camera))
  check('element ids are unique', new Set(ids).size === ids.length)
  await screenshot(page, 'l2-01-before-kill')
}

async function killAndRestore() {
  const before = await readRaw(app.page)
  const digestBefore = await canvasDigest(app.page)
  const releaseMs = await stop('kill')
  measure('WebView2 exit after canvie.exe was killed ms', releaseMs)
  const page = await launch('after kill')
  const after = await readRaw(page)
  const digestAfter = await canvasDigest(page)
  check('killed process reopens with the same stored document', after === before, `${after?.length ?? 0} chars`)
  check('restored document is drawn', digestAfter.ink > 0 && digestAfter.ink === digestBefore.ink, `ink before=${digestBefore.ink} after=${digestAfter.ink}`)
  measure('restored canvas pixels identical', digestAfter.hash === digestBefore.hash)
  check('restore shows no notice', (await notice(page)) === null)
  await screenshot(page, 'l2-02-after-restart')

  const restored = JSON.parse(after)
  const maxId = Math.max(...restored.strokes.map((stroke) => stroke.id), ...restored.notes.map((note) => note.id))
  const view = await page.evaluate('({ width: innerWidth, height: innerHeight })')
  await pressLetter(page, 'b')
  await drawStroke(page, longStroke(view, 140, 8))
  await sleep(SETTLE_MS)
  const next = await readDoc(page)
  const added = next.strokes.at(-1)
  check('new ids continue beyond restored ids', added.id === maxId + 1 && next.revision === restored.revision + 1, `id=${added.id} max restored=${maxId}`)
}

async function writeFailure() {
  const page = app.page
  const view = await page.evaluate('({ width: innerWidth, height: innerHeight })')
  const before = await readDoc(page)
  const inkBefore = (await canvasDigest(page)).ink
  const freeChars = await fillStorage(page, 2_000)
  measure('localStorage free chars next to the stored document', freeChars)

  await drawStroke(page, longStroke(view, view.height - 70, 150))
  await sleep(SETTLE_MS)
  const failed = await notice(page)
  check('quota error shows the save failure with a retry action', failed?.role === 'alert' && failed.text.includes('Não foi possível salvar') && failed.text.includes('Tentar novamente'), failed?.text)
  check('last valid document stays in storage during the failure', (await readDoc(page)).revision === before.revision)
  check('session keeps the unsaved stroke in memory', (await canvasDigest(page)).ink > inkBefore)

  await drawStroke(page, longStroke(view, view.height - 110, 100))
  await sleep(SETTLE_MS)
  check('next edit retries and still keeps the last valid document', (await readDoc(page)).revision === before.revision && (await notice(page))?.role === 'alert')

  await page.evaluate(`localStorage.removeItem(${JSON.stringify(FILLER_KEY)})`)
  await clickElement(page, '.canvas-notice .notice-action')
  await sleep(300)
  const saved = await readDoc(page)
  check('Tentar novamente saves both kept edits', saved.revision === before.revision + 2 && saved.strokes.length === before.strokes.length + 2, `revision=${saved.revision}`)
  check('failure notice clears after a successful save', (await notice(page)) === null)
  check('process stayed alive through the failure', app.child.exitCode === null)
}

async function invalidPayloads() {
  const payloads = [
    ['truncated JSON', '{"version":1,"revision":3,"strokes":[{"id":1'],
    ['future version with 2 MB of content', JSON.stringify({ version: 2, revision: 9, strokes: [], notes: [], camera: { x: 0, y: 0, zoom: 1 }, layers: 'x'.repeat(2_000_000) })],
    ['duplicate ids', JSON.stringify({ version: 1, revision: 4, strokes: [{ id: 1, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#F3F4F6', width: 3 }], notes: [{ id: 1, x: 0, y: 0, text: 'a' }], camera: { x: 0, y: 0, zoom: 1 } })],
    ['zoom outside the camera range', JSON.stringify({ version: 1, revision: 2, strokes: [], notes: [], camera: { x: 0, y: 0, zoom: 99 } })],
  ]
  for (const [index, [name, payload]] of payloads.entries()) {
    await writeRaw(app.page, DOC_KEY, payload)
    await stop('kill')
    const page = await launch(`invalid: ${name}`)
    await sleep(2_000)
    const shown = await notice(page)
    const backup = await readRaw(page, BACKUP_KEY)
    const main = await readRaw(page)
    const ink = (await canvasDigest(page)).ink
    check(`invalid payload (${name}) boots an empty canvas without crashing`, app.child.exitCode === null && ink === 0 && shown?.role === 'status' && shown.text.includes('inválido'), shown?.text)
    check(`invalid payload (${name}) is backed up and left untouched`, backup === payload && main === payload, `${payload.length} chars`)
    if (index === 0) {
      await screenshot(page, 'l2-03-invalid-json')
      const view = await page.evaluate('({ width: innerWidth, height: innerHeight })')
      await drawStroke(page, longStroke(view, 200, 8))
      await sleep(SETTLE_MS)
      const doc = await readDoc(page)
      check('first edit after recovery replaces the invalid payload and keeps the backup', doc?.revision === 1 && doc.strokes.length === 1 && (await readRaw(page, BACKUP_KEY)) === payload)
    }
  }
}

async function closeRightAfterEdit() {
  const page = app.page
  const view = await page.evaluate('({ width: innerWidth, height: innerHeight })')
  await drawStroke(page, longStroke(view, 220, 8))
  await sleep(SETTLE_MS)
  const saved = await readDoc(page)
  await drawStroke(page, longStroke(view, 260, 8))
  await stop('close')
  const reopened = await readDoc(await launch('after close'))
  check('closing the window right after an edit keeps that edit', reopened.revision === saved.revision + 1, `stored revision=${reopened.revision}, edit was revision ${saved.revision + 1}`)
}

async function treeKillDurability() {
  const outcomes = []
  for (const delayMs of [600, 2_000, 6_000, 12_000]) {
    const page = app.page
    const view = await page.evaluate('({ width: innerWidth, height: innerHeight })')
    await drawStroke(page, longStroke(view, 300, 8))
    await sleep(SETTLE_MS)
    const expected = (await readDoc(page)).revision
    await sleep(Math.max(0, delayMs - SETTLE_MS))
    await stop('tree')
    const stored = (await readDoc(await launch(`after tree kill ${delayMs} ms`))).revision
    outcomes.push({ msAfterEdit: delayMs, kept: stored === expected, stored, expected })
  }
  measure('process tree killed N ms after the last edit', outcomes)
}

async function editDuringSave() {
  const big = largeDocument(600, 80, 1_000)
  await writeRaw(app.page, DOC_KEY, JSON.stringify(big))
  await stop('kill')
  const page = await launch('large document')
  const loaded = await readDoc(page)
  check('large document loads', loaded.strokes.length === 600 && (await canvasDigest(page)).ink > 0)
  measure('large document chars', (await readRaw(page)).length)

  await page.evaluate(`(() => {
    window.__canvieE2E = { longTasks: [] }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__canvieE2E.longTasks.push(Math.round(entry.duration))
    }).observe({ type: 'longtask' })
    return true
  })()`)
  const view = await page.evaluate('({ width: innerWidth, height: innerHeight })')
  for (let index = 0; index < 12; index += 1) {
    // The previous stroke's save fires about 200 ms into this stroke.
    await drawStroke(page, longStroke(view, 150 + index * 25, 38), 16)
    await sleep(150)
  }
  await sleep(SETTLE_MS)
  const doc = await readDoc(page)
  const longTasks = await page.evaluate('window.__canvieE2E.longTasks')
  const worst = longTasks.length === 0 ? 0 : Math.max(...longTasks)
  check('strokes drawn while saves run are all kept', doc.strokes.length === 612 && doc.revision === 1_012, `strokes=${doc.strokes.length} revision=${doc.revision}`)
  check('no main-thread task reaches 100 ms while drawing over saves', worst < 100, `long tasks=${JSON.stringify(longTasks)}`)
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
  measure('save cost for the large document', cost)
  await screenshot(page, 'l2-04-large-document')
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
  launches += 1
  check('default launch keeps the WebView2 profile under %APPDATA%\\com.canvie.app', found)
  execFileSync('taskkill', ['/PID', String(child.pid)], { stdio: 'ignore' })
  await withTimeout(exited, 20_000, 'Canvie did not exit after close')
}

function logLines(offset) {
  if (!existsSync(logFile)) return []
  const content = readFileSync(logFile, 'utf8')
  // A shorter file means the log plugin rotated it during the run.
  return (content.length >= offset ? content.slice(offset) : content).split(/\r?\n/).filter(Boolean)
}

const logOffset = existsSync(logFile) ? readFileSync(logFile, 'utf8').length : 0
const scenarios = [freshBoot, l1Workload, killAndRestore, writeFailure, invalidPayloads, closeRightAfterEdit, treeKillDurability, editDuringSave]
try {
  for (const scenario of scenarios) {
    console.log(`\n== ${scenario.name}`)
    await scenario()
  }
  await stop('close')
  console.log('\n== realProfileLocation')
  await realProfileLocation()
} catch (error) {
  check('E2E run completed', false, error instanceof Error ? error.message : String(error))
} finally {
  if (app) await stop('kill').catch(() => undefined)
  rmSync(profileDir, { recursive: true, force: true })
}

const lines = logLines(logOffset)
const startups = lines.filter((line) => line.includes('Canvie startup')).length
check('release log records one startup per launch', startups === launches, `startups=${startups} launches=${launches}`)
check('release log has no error lines', !lines.some((line) => /\[ERROR\]|panicked/.test(line)))

writeFileSync(join(evidenceDir, 'report.json'), JSON.stringify({ exe, executable: statSync(exe).mtime, results, measurements }, null, 2))
const failed = results.filter((result) => !result.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Evidence: ${evidenceDir}`)
process.exit(failed.length === 0 ? 0 : 1)
