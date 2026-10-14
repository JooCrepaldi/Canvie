// L7 E2E driver: keyboard, focus and resource use on the installed build.
// Tab, letters, Ctrl + Z and the global shortcut go through the Windows input
// queue while Canvie holds the foreground. Wall and Edit each idle for 60 s
// to measure working set and CPU.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp, waitForPlacement } from './lib/app.mjs'
import { areaRect, chooseTool, clickElement, defineArea, drag, readRaw } from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'
import { probeWindow } from './lib/win32.mjs'

const DOC_KEY = 'canvie.document'
const IDLE_MS = 60_000

const { values: options } = parseArgs({
  options: {
    exe: { type: 'string' },
    port: { type: 'string', default: '9333' },
    evidence: { type: 'string' },
  },
})
if (!options.exe || !existsSync(options.exe)) {
  console.error(`Executable not found: ${options.exe ?? '(missing --exe)'}`)
  process.exit(2)
}

const exe = options.exe
const port = Number(options.port)
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l7-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const app = new CanvieApp({ exe, port, profileDir, onReady: (label, ms) => report.measure(`launch ready ms (${label})`, ms) })

const sendKeys = (chord) =>
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(import.meta.dirname, 'lib', 'send-keys.ps1'), '-Chord', chord])
const strokes = async (page) => JSON.parse(await readRaw(page, DOC_KEY)).strokes.length

// The focused control, its accessible name and whether it draws a focus ring.
const focused = (page) =>
  page.evaluate(`(() => {
    const element = document.activeElement
    if (!element || element === document.body) return null
    const style = getComputedStyle(element)
    return {
      name: element.getAttribute('aria-label') ?? element.textContent.trim(),
      ring: element.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
    }
  })()`)

// Accessible names of the enabled toolbar controls, in DOM order.
const toolbarOrder = (page) =>
  page.evaluate("[...document.querySelectorAll('.toolbar button:not(:disabled)')].map((button) => button.getAttribute('aria-label') ?? button.textContent.trim())")

async function firstRun() {
  const page = await app.launch('installed build')
  const isolated = app.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  await waitForPlacement(page, 'edit')
  await defineArea(page, { x: 200, y: 160 }, { x: 980, y: 700 })
  await chooseTool(page, 'Pincel')
  const rect = await areaRect(page)
  await drag(page, Array.from({ length: 10 }, (_, step) => ({ x: rect.x + 40 + step * 25, y: rect.y + 60 + Math.sin(step) * 6 })))
}

async function tabOrder() {
  const page = app.page
  if (!probeWindow(app.child.pid).foreground) {
    report.check('Tab reaches every toolbar control in order, with a visible focus ring', false, 'skipped: Canvie did not hold the foreground')
    return
  }
  const expected = await toolbarOrder(page)
  const visited = []
  let rings = true
  for (let press = 0; press < expected.length; press += 1) {
    sendKeys('tab')
    await sleep(120)
    const current = await focused(page)
    visited.push(current?.name ?? '(nothing)')
    rings &&= current?.ring === true
  }
  report.measure('Tab order', visited)
  report.check('Tab starts at the drag handle', visited[0] === expected[0], visited[0])
  report.check('Tab reaches every toolbar control in DOM order', visited.join('|') === expected.join('|'), `${visited.length} of ${expected.length}`)
  report.check('every control reached by Tab draws a 2 px focus ring', rings)
  report.check('every control reached by Tab has an accessible name', visited.every((name) => name && name !== '(nothing)'))
}

async function keyboardShortcuts() {
  const page = app.page
  await page.evaluate('document.activeElement?.blur(); true')
  sendKeys('e')
  await sleep(200)
  const eraser = await page.evaluate(`document.querySelector('button[aria-label^="Borracha"]')?.getAttribute('aria-pressed')`)
  sendKeys('b')
  await sleep(200)
  const brush = await page.evaluate(`document.querySelector('button[aria-label^="Pincel"]')?.getAttribute('aria-pressed')`)
  report.check('E and B switch between Borracha and Pincel', eraser === 'true' && brush === 'true')
  const before = await strokes(page)
  sendKeys('ctrl+z')
  await sleep(600)
  const undone = await strokes(page)
  sendKeys('ctrl+y')
  await sleep(600)
  const redone = await strokes(page)
  report.check('Ctrl + Z undoes and Ctrl + Y redoes the stroke', undone === before - 1 && redone === before, `${before} → ${undone} → ${redone}`)
}

// Working set and CPU of canvie.exe and its WebView2 processes after IDLE_MS.
async function idle(label) {
  const start = probeWindow(app.child.pid)
  await sleep(IDLE_MS)
  const end = probeWindow(app.child.pid)
  const cost = { workingSetMB: end.workingSetMB, processes: end.processes, cpuSecondsPerMinute: Math.round(((end.cpuSeconds - start.cpuSeconds) * 60_000 / IDLE_MS) * 100) / 100 }
  report.measure(`${label} after 60 s`, cost)
  return cost
}

async function resources() {
  const page = app.page
  await clickElement(page, 'button.toolbar-pin')
  report.measure('Fixar no desktop to Wall ms', await waitForPlacement(page, 'wall'))
  const wall = await idle('Wall')
  sendKeys('ctrl+alt+t')
  report.measure('Ctrl + Alt + T to Edit ms', await waitForPlacement(page, 'edit'))
  const edit = await idle('Edit')
  report.check('Wall idles under 1 s of CPU per minute', wall.cpuSecondsPerMinute < 1, String(wall.cpuSecondsPerMinute))
  report.check('Edit idles under 1 s of CPU per minute', edit.cpuSecondsPerMinute < 1, String(edit.cpuSecondsPerMinute))
}

try {
  for (const scenario of [firstRun, tabOrder, keyboardShortcuts, resources]) {
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
