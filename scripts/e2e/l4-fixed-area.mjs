// L4 E2E driver: the canvas area fixed on the desktop. The release build
// runs on a throwaway WebView2 profile; Win32 state comes from win32-probe.ps1.
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp } from './lib/app.mjs'
import { areaRect, screenshot, writeRaw } from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'
import { captureScreen, probeWindow, screenPixels } from './lib/win32.mjs'

const DOC_KEY = 'canvie.document.v1'
const AREA = { x: 160, y: 140, width: 520, height: 340 }
const IDLE_MS = 20_000
const DOCUMENT = {
  version: 1,
  revision: 3,
  area: AREA,
  background: 'paper',
  strokes: [{ id: 1, points: Array.from({ length: 12 }, (_, step) => ({ x: -200 + step * 20, y: 80 + Math.sin(step) * 10 })), color: '#2563EB', width: 3 }],
  notes: [
    { id: 2, x: -230, y: -140, text: '## Fixo no desktop\n\n| a | b |\n| --- | --- |\n| 1 | 2 |', size: 'medium', kind: 'text' },
    { id: 3, x: 20, y: -130, text: 'Post-it **fixo**', size: 'large', kind: 'postit' },
  ],
  camera: { x: 0, y: 0, zoom: 1 },
}

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
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l4-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const app = new CanvieApp({ exe, port: Number(options.port), profileDir, onReady: (label, ms) => report.measure(`launch ready ms (${label})`, ms) })

const placement = (page) => page.evaluate("window.__TAURI_INTERNALS__.invoke('get_placement')")
const chrome = (page) =>
  page.evaluate(`({
    toolbar: document.querySelector('.toolbar') !== null,
    selector: document.querySelector('.area-selector') !== null,
    frame: document.querySelector('.area-frame') !== null,
    notice: document.querySelector('.canvas-notice') !== null,
  })`)

// A launch without an area opens Edit to drag one, so the area is stored
// first and the app opens again on the desktop.
async function wallOnBoot() {
  const first = await app.launch('fresh profile')
  const isolated = app.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  await writeRaw(first, DOC_KEY, JSON.stringify(DOCUMENT))
  await app.stop('kill')
  const page = await app.launch('with an area')
  await page.waitFor("document.querySelectorAll('.note').length === 2")
  await sleep(300)

  const state = await placement(page)
  report.check('backend reports Wall, embedded', state?.placement === 'wall' && state.embedded === true, JSON.stringify(state))
  const window = probeWindow(app.child.pid)
  report.measure('window on boot', window)
  report.check('window is a child of Progman', window.found && window.parentIsProgman && window.child, JSON.stringify(window))
  report.check('window is first among Progman children, above the icons', window.firstProgmanChild)
  report.check('window is click-through and not topmost', window.transparent && window.layered && !window.topmost)
  const dpr = await page.evaluate('devicePixelRatio')
  const view = await page.evaluate('({ width: innerWidth, height: innerHeight })')
  const width = window.rect.right - window.rect.left
  const height = window.rect.bottom - window.rect.top
  report.check('window covers the primary monitor', Math.abs(width - view.width * dpr) <= 1 && Math.abs(height - view.height * dpr) <= 1, `${width}x${height} at dpr ${dpr}`)
}

async function areaOnDesktop() {
  const page = app.page
  const rect = await areaRect(page)
  report.check('Wall draws the stored area', rect.x === AREA.x && rect.y === AREA.y && rect.width === AREA.width && rect.height === AREA.height, JSON.stringify(rect))
  const shown = await chrome(page)
  report.check('Wall shows the area without toolbar, border, dim or notice', !shown.toolbar && !shown.frame && !shown.selector && !shown.notice, JSON.stringify(shown))
  const backgrounds = await page.evaluate(`['html', 'body', '#root', 'main'].map((selector) => getComputedStyle(document.querySelector(selector)).backgroundColor)`)
  report.check('everything outside the area is transparent', backgrounds.every((color) => color === 'rgba(0, 0, 0, 0)'), JSON.stringify(backgrounds))
  await screenshot(page, report.file('l4-01-wall-page.png'))

  const window = probeWindow(app.child.pid)
  const dpr = await page.evaluate('devicePixelRatio')
  const toScreen = (x, y) => ({ x: window.rect.left + x * dpr, y: window.rect.top + y * dpr })
  const inside = probeWindow(app.child.pid, toScreen(AREA.x + AREA.width / 2, AREA.y + AREA.height / 2)).hit
  const outside = probeWindow(app.child.pid, toScreen(AREA.x + AREA.width + 60, AREA.y + 20)).hit
  report.check('a click inside the area reaches what is under it', !inside.ownedByCanvie, `hit ${inside.class}`)
  report.check('a click outside the area reaches what is under it', !outside.ownedByCanvie, `hit ${outside.class}`)
  report.check('Wall does not hold the foreground', !window.foreground)
  const origin = toScreen(AREA.x, AREA.y)
  captureScreen({ x: origin.x, y: origin.y, width: AREA.width * dpr, height: AREA.height * dpr }, report.file('l4-02-screen-at-area.png'))
}

// Without touching the user's windows: find a part of the primary monitor
// where a click lands on the desktop icons, move the area there, and check
// that the area is painted and still lets the click through.
async function onExposedDesktop() {
  const page = app.page
  const dpr = await page.evaluate('devicePixelRatio')
  const step = 40
  const columns = 7
  const rows = 5
  const { rect, exposed } = probeWindow(app.child.pid, undefined, step)
  const free = new Set(exposed.map(([x, y]) => `${x},${y}`))
  const origin = exposed.find(([x, y]) => {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) if (!free.has(`${x + column * step},${y + row * step}`)) return false
    }
    return true
  })
  if (!origin) {
    report.measure('exposed desktop', 'no uncovered desktop region of 240 × 160 px; paint on the desktop not observable without moving windows')
    return
  }
  const area = {
    x: Math.round((origin[0] - rect.left) / dpr),
    y: Math.round((origin[1] - rect.top) / dpr),
    width: Math.round(((columns - 1) * step) / dpr),
    height: Math.round(((rows - 1) * step) / dpr),
  }
  await writeRaw(page, DOC_KEY, JSON.stringify({ ...DOCUMENT, area, strokes: [], notes: [] }))
  await page.evaluate('location.reload(); true')
  await page.waitFor("(document.querySelector('canvas')?.width ?? 0) > 1")
  await sleep(500)
  const toScreen = (x, y) => ({ x: rect.left + x * dpr, y: rect.top + y * dpr })
  const middle = toScreen(area.x + area.width / 2, area.y + area.height / 2)
  const hit = probeWindow(app.child.pid, middle).hit
  const [paper] = screenPixels([middle])
  const isPaper = (color) => Math.abs(color[0] - 244) <= 6 && Math.abs(color[1] - 236) <= 6 && Math.abs(color[2] - 220) <= 6
  report.measure('exposed desktop area', area)
  report.check('the area is painted on the exposed desktop', isPaper(paper), `rgb(${paper})`)
  report.check('a click on the painted area reaches the desktop icons', !hit.ownedByCanvie && /SysListView32|SHELLDLL_DefView|WorkerW|Progman/.test(hit.class), `hit ${hit.class}`)
  const corner = toScreen(area.x - 40, area.y - 40)
  captureScreen({ x: Math.max(rect.left, corner.x), y: Math.max(rect.top, corner.y), width: (area.width + 80) * dpr, height: (area.height + 80) * dpr }, report.file('l4-03-area-on-desktop.png'))
}

async function idleCost() {
  const start = probeWindow(app.child.pid)
  await sleep(IDLE_MS)
  const end = probeWindow(app.child.pid)
  report.measure('Wall idle cost', {
    workingSetMB: end.workingSetMB,
    processes: end.processes,
    cpuSecondsPerMinute: Math.round(((end.cpuSeconds - start.cpuSeconds) * 60_000) / IDLE_MS * 100) / 100,
  })
}

try {
  const scenarios = [wallOnBoot, areaOnDesktop, onExposedDesktop, idleCost]
  for (const scenario of scenarios) {
    console.log(`\n== ${scenario.name}`)
    await scenario()
  }
  await app.stop('kill')
} catch (error) {
  report.check('E2E run completed', false, error instanceof Error ? error.message : String(error))
} finally {
  if (app.current) await app.stop('kill').catch(() => undefined)
  app.removeProfile()
}

const lines = report.checkLog(app.launches)
report.check('release log records the embedded Wall placement', lines.some((line) => line.includes('placement -> wall (embedded in Progman)')))
process.exit(report.finish({ exe, executable: statSync(exe).mtime }))
