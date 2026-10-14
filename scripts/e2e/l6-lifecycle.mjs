// L6 E2E driver: the background lifecycle on the release build. Alt + F4 in
// Edit pins instead of quitting, and quits only before the first area exists,
// a frontend save failure reaches the release
// log, a window outside Progman is embedded again, an Explorer restart puts
// the area back on the desktop, and WM_CLOSE in Wall quits. It restarts the
// Windows shell twice.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp, closeWindow, isRunning, placementOf, waitForPlacement } from './lib/app.mjs'
import { areaRect, clickElement, defineArea, drag, FILLER_KEY, fillStorage, notice, readRaw, screenshot, withTimeout } from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'
import { probeWindow } from './lib/win32.mjs'

const DOC_KEY = 'canvie.document.v1'

const { values: options } = parseArgs({
  options: {
    exe: { type: 'string' },
    port: { type: 'string', default: '9333' },
    evidence: { type: 'string' },
    'skip-explorer': { type: 'boolean', default: false },
  },
})
if (!options.exe || !existsSync(options.exe)) {
  console.error(`Release executable not found: ${options.exe ?? '(missing --exe)'}`)
  process.exit(2)
}

const exe = options.exe
const port = Number(options.port)
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l6-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const app = new CanvieApp({ exe, port, profileDir, onReady: (label, ms) => report.measure(`launch ready ms (${label})`, ms) })

const powershell = (script, args) =>
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(import.meta.dirname, 'lib', script), ...args], { encoding: 'utf8' })
const sendKeys = (chord) => powershell('send-keys.ps1', ['-Chord', chord])
const restartExplorer = (mode) => JSON.parse(powershell('restart-explorer.ps1', ['-Mode', mode]).trim())

const readDoc = (page) => readRaw(page, DOC_KEY)
const logHas = (text) => report.newLogLines().some((line) => line.includes(text))
const countLog = (text) => report.newLogLines().filter((line) => line.includes(text)).length
const recoveries = () => countLog('wall: embedding the window') + countLog('restarting Canvie on the new desktop')

async function strokeInArea(page, row) {
  const rect = await areaRect(page)
  const y = rect.y + 40 + row * 30
  await drag(page, Array.from({ length: 10 }, (_, step) => ({ x: rect.x + 40 + step * 25, y: y + Math.sin(step) * 6 })))
}

const onWall = (window) => window.found && window.parentIsProgman && window.firstProgmanChild && window.child && window.transparent && window.layered && !window.topmost

// Polls the Win32 state until the window is back in Progman, above the icons.
async function waitForWall(timeoutMs) {
  const started = Date.now()
  let window = null
  while (Date.now() - started < timeoutMs) {
    window = probeWindow(app.child.pid)
    if (onWall(window)) return { ms: Date.now() - started, window }
    await sleep(250)
  }
  return { ms: -1, window }
}

// After the shell restarts, the window is either embedded again by the same
// process or comes back with a restarted process.
async function waitForRecovery(timeoutMs) {
  const started = Date.now()
  const pid = app.child.pid
  while (Date.now() - started < timeoutMs) {
    if (!isRunning(pid)) {
      await app.adoptRestart()
      const back = await waitForWall(30_000)
      return { path: 'restart', ms: back.ms < 0 ? -1 : Date.now() - started }
    }
    if (onWall(probeWindow(pid))) return { path: 're-embed', ms: Date.now() - started }
    await sleep(250)
  }
  return { path: 'none', ms: -1 }
}

// Before the first area there is nothing to pin, so Alt + F4 quits.
async function altF4WithoutAreaQuits() {
  const page = await app.launch('fresh profile')
  const isolated = app.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  await waitForPlacement(page, 'edit')
  if (!probeWindow(app.child.pid).foreground) {
    report.check('Alt + F4 before the first area quits the app', false, 'skipped: Canvie did not hold the foreground')
    await app.stop('kill')
    return
  }
  const { exited } = app.current
  app.current = null
  sendKeys('alt+f4')
  const code = await withTimeout(exited, 20_000, 'Canvie did not quit after Alt + F4 without an area')
  page.close()
  await app.waitForProfileRelease()
  report.check('Alt + F4 before the first area quits the app', code === 0, `exit code ${code}`)
}

async function firstRun() {
  const page = await app.launch('first area')
  await waitForPlacement(page, 'edit')
  await defineArea(page, { x: 200, y: 160 }, { x: 980, y: 700 })
  await strokeInArea(page, 0)
}

async function altF4Pins() {
  const page = app.page
  if (!probeWindow(app.child.pid).foreground) {
    report.check('Alt + F4 in Edit saves and pins without quitting', false, 'skipped: Canvie did not hold the foreground')
    await clickElement(page, 'button.toolbar-pin')
    await waitForPlacement(page, 'wall')
    return
  }
  sendKeys('alt+f4')
  report.measure('Alt + F4 to Wall ms', await waitForPlacement(page, 'wall'))
  await sleep(500)
  const strokes = JSON.parse(await readDoc(page)).strokes.length
  report.check('Alt + F4 in Edit saves and pins without quitting', isRunning(app.child.pid) && strokes === 1, `strokes=${strokes}`)
  report.check('after Alt + F4 the window is back in Progman, click-through and not topmost', onWall(probeWindow(app.child.pid)))
}

async function saveFailureReachesLog() {
  const page = app.page
  sendKeys('ctrl+alt+t')
  await waitForPlacement(page, 'edit')
  await fillStorage(page, 500)
  const rect = await areaRect(page)
  await drag(page, Array.from({ length: 150 }, (_, step) => ({ x: rect.x + 30 + step * 4, y: rect.y + rect.height - 60 + Math.sin(step / 3) * 10 })))
  await sleep(1_500)
  const shown = await notice(page)
  report.check('a failed save shows Tentar novamente', shown?.role === 'alert' && shown.text.includes('Tentar novamente'), shown?.text)
  report.check('the release log records the frontend save failure', logHas('frontend: document save failed'))
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(FILLER_KEY)})`)
  await clickElement(page, 'button.toolbar-pin')
  await waitForPlacement(page, 'wall')
  report.check('the save works again once storage has room', JSON.parse(await readDoc(page)).strokes.length === 2)
}

// After a recovery, Ctrl + Alt + T and Fixar no desktop still move the window.
async function roundTrip(label) {
  const page = app.page
  sendKeys('ctrl+alt+t')
  await waitForPlacement(page, 'edit')
  await clickElement(page, 'button.toolbar-pin')
  await waitForPlacement(page, 'wall')
  report.check(`${label}: Ctrl + Alt + T and Fixar no desktop still work`, onWall(probeWindow(app.child.pid)))
}

async function outsideProgmanReEmbeds() {
  powershell('detach-window.ps1', ['-ProcessId', String(app.child.pid)])
  report.measure('window detached from Progman', probeWindow(app.child.pid))
  const back = await waitForWall(15_000)
  report.measure('detached window back in Progman ms', back.ms)
  report.check('a living window outside Progman is embedded again', back.ms >= 0 && isRunning(app.child.pid), JSON.stringify(back.window))
  await roundTrip('after the re-embed')
}

async function explorerRestart(mode, label) {
  const before = await readDoc(app.page)
  const shell = restartExplorer(mode)
  report.measure(`Explorer ${label}`, shell)
  if (!shell.exited) {
    report.check(`after Explorer ${label} the area returns to the desktop`, false, 'the shell did not exit')
    return
  }
  const recovery = await waitForRecovery(60_000)
  report.measure(`Explorer ${label}: recovery`, recovery)
  report.check(`after Explorer ${label} the area returns to Progman, above the icons`, recovery.ms >= 0, JSON.stringify(probeWindow(app.child.pid)))
  if (recovery.ms < 0) return
  const page = app.page
  report.check(`after Explorer ${label} the document is unchanged`, (await readDoc(page)) === before)
  report.check(`after Explorer ${label} the backend reports an embedded Wall`, (await placementOf(page))?.embedded === true)
  await screenshot(page, report.file(`l6-explorer-${mode}.png`))
  await roundTrip(`after Explorer ${label}`)
}

const explorerCrash = () => explorerRestart('crash', 'crash')
const explorerCleanExit = () => explorerRestart('clean', 'clean exit')

async function idleKeepsPlace() {
  const before = recoveries()
  await sleep(10_000)
  report.check('the watchdog leaves a settled Wall alone for 10 s', recoveries() === before && onWall(probeWindow(app.child.pid)))
}

// A fresh launch, so the exit code comes from a child of the driver.
async function closeInWallQuits() {
  await app.stop('kill')
  await app.launch('close in Wall')
  await waitForPlacement(app.page, 'wall')
  const { child, page, exited } = app.current
  app.current = null
  closeWindow(child.pid)
  const code = await withTimeout(exited, 20_000, 'Canvie did not exit after WM_CLOSE in Wall')
  page.close()
  await app.waitForProfileRelease()
  report.check('WM_CLOSE in Wall quits the app', code === 0, `exit code ${code}`)
}

// --skip-explorer leaves the shell alone, for a rerun while someone works on the machine.
const explorerScenarios = options['skip-explorer'] ? [] : [explorerCrash, explorerCleanExit]
if (options['skip-explorer']) report.measure('Explorer restarts', 'skipped by --skip-explorer')
const scenarios = [altF4WithoutAreaQuits, firstRun, altF4Pins, saveFailureReachesLog, outsideProgmanReEmbeds, ...explorerScenarios, idleKeepsPlace, closeInWallQuits]
try {
  for (const scenario of scenarios) {
    console.log(`\n== ${scenario.name}`)
    await scenario()
  }
} catch (error) {
  report.check('E2E run completed', false, error instanceof Error ? error.message : String(error))
} finally {
  if (app.current) await app.stop('kill').catch(() => undefined)
  app.removeProfile()
}

const lines = report.checkLog(app.launches)
const has = (text) => lines.some((line) => line.includes(text))
report.check('log records the close requests in Edit', has('close requested in Edit'))
report.check('log records the quit without an area', has('close requested without an area: quit'))
report.check('log records the window outside Progman', has('wall: the window is outside Progman'))
report.check('log records the re-embed', has('wall: embedding the window in the new Progman'))
report.check('log records the quit from WM_CLOSE in Wall', has('close requested in Wall: quit'))
report.measure('log lines about a lost window', lines.filter((line) => /window is gone|destroyed outside a quit|restarting Canvie/.test(line)))
process.exit(report.finish({ exe, executable: statSync(exe).mtime }))
