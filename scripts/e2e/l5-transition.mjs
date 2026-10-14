// L5 E2E driver: the Fixo ↔ Edição transition on the release build, with
// the real global shortcut sent through the Windows input queue. Plain keys
// go through Windows only while Canvie holds the foreground, so they never
// type into another app.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp, placementOf, waitForPlacement } from './lib/app.mjs'
import { activeTool, areaRect, chooseTool, clickElement, defineArea, drag, FILLER_KEY, fillStorage, notice, pressEscape, readRaw, screenshot, withTimeout } from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'
import { probeWindow } from './lib/win32.mjs'

const DOC_KEY = 'canvie.document'
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
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l5-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const app = new CanvieApp({ exe, port, profileDir, onReady: (label, ms) => report.measure(`launch ready ms (${label})`, ms) })

const sendKeys = (chord) =>
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(import.meta.dirname, 'lib', 'send-keys.ps1'), '-Chord', chord])

async function readDoc(page) {
  const raw = await readRaw(page, DOC_KEY)
  return raw === null ? null : JSON.parse(raw)
}

const toolbarShown = (page) => page.evaluate("document.querySelector('.toolbar') !== null")

async function strokeInArea(page, row) {
  const rect = await areaRect(page)
  const y = rect.y + 40 + row * 30
  await drag(page, Array.from({ length: 10 }, (_, step) => ({ x: rect.x + 40 + step * 25, y: y + Math.sin(step) * 6 })))
}

function checkWall(label) {
  const window = probeWindow(app.child.pid)
  report.check(`${label}: the window is back in Progman, click-through and not topmost`, window.parentIsProgman && window.child && window.transparent && window.layered && !window.topmost, JSON.stringify(window))
}

function checkEdit(label) {
  const window = probeWindow(app.child.pid)
  report.check(`${label}: the window is top-level, topmost and interactive`, window.found && !window.parentIsProgman && !window.child && window.topmost && !window.transparent, JSON.stringify(window))
  return window
}

async function firstRun() {
  const page = await app.launch('fresh profile')
  const isolated = app.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')

  report.measure('first launch to Edit ms', await waitForPlacement(page, 'edit'))
  const window = checkEdit('first launch without an area')
  report.check('first launch shows the area selector and the toolbar', await page.evaluate("document.querySelector('.area-selector') !== null") && (await toolbarShown(page)))
  report.check('Edit holds the foreground', window.foreground)
  await screenshot(page, report.file('l5-01-first-run.png'))

  await defineArea(page, { x: 200, y: 160 }, { x: 980, y: 700 })
  await chooseTool(page, 'Pincel')
  await strokeInArea(page, 0)
  if (window.foreground) {
    sendKeys('e')
    await sleep(300)
    const tool = await activeTool(page)
    sendKeys('b')
    report.check('Edit receives keyboard input from Windows', tool === 'eraser', `tool=${tool}`)
  } else {
    report.check('Edit receives keyboard input from Windows', false, 'skipped: Canvie did not hold the foreground')
  }
}

async function pinWithButton() {
  const page = app.page
  await clickElement(page, 'button.toolbar-pin')
  report.measure('Fixar no desktop to Wall ms', await waitForPlacement(page, 'wall'))
  checkWall('Fixar no desktop')
  const doc = await readDoc(page)
  report.check('Fixar no desktop saved the area and the stroke first', doc?.area !== null && doc?.strokes.length === 1, `strokes=${doc?.strokes.length}`)
  report.check('Wall hides the toolbar', !(await toolbarShown(page)))
}

async function shortcutRoundTrip() {
  const page = app.page
  sendKeys('ctrl+alt+t')
  report.measure('Ctrl + Alt + T to Edit ms', await waitForPlacement(page, 'edit'))
  const window = checkEdit('Ctrl + Alt + T from Wall')
  report.check('Ctrl + Alt + T gives Edit the foreground', window.foreground)
  report.check('Edit shows the same document', (await readDoc(page)).strokes.length === 1 && (await toolbarShown(page)))

  await strokeInArea(page, 1)
  sendKeys('ctrl+alt+t')
  report.measure('Ctrl + Alt + T to Wall ms', await waitForPlacement(page, 'wall'))
  checkWall('Ctrl + Alt + T from Edit')
  report.check('Ctrl + Alt + T saves before pinning', (await readDoc(page)).strokes.length === 2)
}

async function escapePins() {
  const page = app.page
  sendKeys('ctrl+alt+t')
  await waitForPlacement(page, 'edit')
  await strokeInArea(page, 2)
  // With the Pincel, its popover is open, and the first Esc closes it.
  await pressEscape(page)
  await sleep(200)
  report.check('the first Esc closes the Pincel popover and stays in Edit', (await placementOf(page)).placement === 'edit' && (await page.evaluate("document.querySelector('.toolbar-popover') === null")))
  await pressEscape(page)
  await waitForPlacement(page, 'wall')
  report.check('the next Esc saves and pins', (await readDoc(page)).strokes.length === 3)
}

async function failedSaveKeepsEdit() {
  const page = app.page
  sendKeys('ctrl+alt+t')
  await waitForPlacement(page, 'edit')
  await fillStorage(page, 500)
  const rect = await areaRect(page)
  await drag(page, Array.from({ length: 150 }, (_, step) => ({ x: rect.x + 30 + step * 4, y: rect.y + rect.height - 60 + Math.sin(step / 3) * 10 })))
  await clickElement(page, 'button.toolbar-pin')
  await sleep(1_500)
  const shown = await notice(page)
  report.check('a failed save keeps Edit and shows Tentar novamente', (await placementOf(page)).placement === 'edit' && shown?.role === 'alert' && shown.text.includes('Tentar novamente'), shown?.text)
  report.check('the stored document stays at the last saved revision', (await readDoc(page)).strokes.length === 3)
  await screenshot(page, report.file('l5-02-save-failed.png'))
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(FILLER_KEY)})`)
  await clickElement(page, 'button.toolbar-pin')
  await waitForPlacement(page, 'wall')
  report.check('Fixar no desktop works again once saving works', (await readDoc(page)).strokes.length === 4)
}

async function secondInstance() {
  const page = app.page
  const second = spawn(exe, [], {
    env: { ...process.env, WEBVIEW2_USER_DATA_FOLDER: profileDir, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `${WEBVIEW2_DEFAULT_ARGS} --remote-debugging-port=${port}` },
    stdio: 'ignore',
  })
  const code = await withTimeout(new Promise((resolve) => second.once('exit', resolve)), 15_000, 'the second instance did not exit')
  await waitForPlacement(page, 'edit')
  report.check('a second launch exits and brings the canvas to Edit', code === 0 && app.child.exitCode === null, `exit code ${code}`)
  await clickElement(page, 'button.toolbar-pin')
  await waitForPlacement(page, 'wall')
}

try {
  for (const scenario of [firstRun, pinWithButton, shortcutRoundTrip, escapePins, failedSaveKeepsEdit, secondInstance]) {
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
const transitions = lines.filter((line) => line.includes('placement -> ')).map((line) => (line.includes('placement -> edit') ? 'Edit' : 'Wall'))
report.measure('placement sequence in the log', transitions.join(' -> '))
report.check('log records Wall -> Edit -> Wall', transitions.join(',').includes('Wall,Edit,Wall'))
report.check('log records the shortcut registration', lines.some((line) => line.includes('shortcut registered: Ctrl+Alt+T')))
report.check('log records the pin request from the shortcut', lines.some((line) => line.includes('shortcut: pin requested')))
report.check('log records the second instance', lines.some((line) => line.includes('second instance blocked')))
process.exit(report.finish({ exe, executable: statSync(exe).mtime }))
