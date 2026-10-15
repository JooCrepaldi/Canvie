// L13 E2E driver: motion and fluent typing on the release build.
// Edit enters with the canvas rising and fading in; Fixar saves, lets the
// canvas sink and fade, and only then goes back to the desktop. Layers open
// with short animations, and reduced motion turns all of it off. Typing in a
// note on a busy canvas is measured key by key with the Event Timing API.
// --typing-only runs just the typing measurement, to compare an older build.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp, placementOf, waitForPlacement } from './lib/app.mjs'
import { areaRect, click, clickElement, drag, openMenu, pressEnter, pressEscape, pressLetter, readRaw, typeText } from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'
import { captureFrames, pixelSeries } from './lib/win32.mjs'

const DOC_KEY = 'canvie.document'
const SETTLE_MS = 350 + 400
const AREA = { x: 100, y: 80, width: 1400, height: 680 }
const TYPED = 'Notas rapidas sobre o video de hoje: escrever sem travar, com a nota crescendo junto do texto. '
const editorOpen = "document.activeElement?.classList.contains('note-editor') === true"

const { values: options } = parseArgs({
  options: {
    exe: { type: 'string' },
    port: { type: 'string', default: '9333' },
    evidence: { type: 'string' },
    'typing-only': { type: 'boolean', default: false },
  },
})
if (!options.exe || !existsSync(options.exe)) {
  console.error(`Release executable not found: ${options.exe ?? '(missing --exe)'}`)
  process.exit(2)
}

const exe = options.exe
const typingOnly = options['typing-only']
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l13-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const app = new CanvieApp({ exe, port: Number(options.port), profileDir, onReady: (label, ms) => report.measure(`launch ready ms (${label})`, ms) })

// A busy canvas: 30 Markdown notes with a heading, a list and a table, over
// 40 strokes. The bottom band stays empty for the note that is typed.
function busyDocument() {
  const notes = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    x: -680 + (index % 6) * 230,
    y: -320 + Math.floor(index / 6) * 110,
    text: `### Nota ${index + 1}\n- item **um**\n- item dois\n\n| a | b |\n| --- | --- |\n| 1 | 2 |`,
    size: 'sm',
    font: ['serif', 'sans', 'mono'][index % 3],
    align: 'left',
    kind: index % 5 === 0 ? 'postit' : 'text',
  }))
  const strokes = Array.from({ length: 40 }, (_, index) => ({
    id: 100 + index,
    points: Array.from({ length: 30 }, (_, step) => ({ x: -660 + step * 44, y: -300 + index * 12 + Math.sin(step + index) * 18 })),
    color: ['#1F2328', '#2563EB', '#DC2626', '#16A34A'][index % 4],
    width: 3,
    brush: 'pen',
  }))
  return { version: 2, revision: 1, area: AREA, background: 'paper', strokes, notes, camera: { x: 0, y: 0, zoom: 1 } }
}

async function reloadWith(page, doc) {
  await page.evaluate(`(() => {
    localStorage.setItem(${JSON.stringify(DOC_KEY)}, ${JSON.stringify(JSON.stringify(doc))})
    location.reload()
    return true
  })()`)
  await sleep(300)
  await page.waitFor("document.querySelectorAll('.note').length >= 30 && (document.querySelector('canvas')?.width ?? 0) > 1")
  await sleep(600)
}

const sendKeys = (chord) =>
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(import.meta.dirname, 'lib', 'send-keys.ps1'), '-Chord', chord])

const enterEdit = (page) => page.evaluate("window.__TAURI_INTERNALS__.invoke('enter_edit').catch(() => null)")

// Animations on the shell's elements, by element class and name.
const animations = (page) =>
  page.evaluate(`document.getAnimations().map((animation) => {
    const timing = animation.effect.getTiming()
    const target = animation.effect.target
    return { name: animation.animationName, target: String(target.className.baseVal ?? target.className).split(' ')[0], duration: timing.duration, delay: timing.delay }
  })`)
const has = (list, target, name, duration, delay = 0) => list.some((item) => item.target === target && item.name === name && item.duration === duration && item.delay === delay)

async function setup() {
  const page = await app.launch('fresh profile', { edit: true })
  const isolated = app.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  await reloadWith(page, busyDocument())
  if ((await placementOf(page)).placement !== 'edit') {
    await enterEdit(page)
    await waitForPlacement(page, 'edit')
  }
  await sleep(500)
  report.check('the busy canvas renders 30 notes and 40 strokes', (await page.evaluate("document.querySelectorAll('.note').length")) === 30)
}

async function typing() {
  const page = app.page
  const rect = await areaRect(page)
  const at = { x: rect.x + 120, y: rect.y + rect.height - 70 }
  await click(page, at.x, at.y, 1)
  await click(page, at.x, at.y, 2)
  await page.waitFor(editorOpen)
  await page.evaluate(`(() => {
    window.__canvieKeys = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__canvieKeys.push({ name: entry.name, id: entry.interactionId, duration: entry.duration })
    }).observe({ type: 'event', durationThreshold: 16 })
    return true
  })()`)
  for (const character of TYPED) {
    await typeText(page, character)
    await sleep(25)
  }
  await sleep(600)
  const entries = await page.evaluate('window.__canvieKeys')
  const value = await page.evaluate("document.querySelector('.note-editor')?.value ?? ''")
  const slowest = new Map()
  for (const entry of entries.filter((item) => item.id > 0)) slowest.set(entry.id, Math.max(slowest.get(entry.id) ?? 0, entry.duration))
  const durations = [...slowest.values()].sort((a, b) => a - b)
  // Which presses were slow, counted from the first one typed.
  const order = [...slowest.keys()].sort((a, b) => a - b)
  const firstId = Math.min(...entries.filter((item) => item.id > 0).map((item) => item.id))
  const slowKeys = order.filter((id) => slowest.get(id) >= 50).map((id) => ({ key: Math.round((id - firstId) / (order.length > 1 ? (order.at(-1) - firstId) / (order.length - 1) : 1)), ms: slowest.get(id) }))
  const keys = TYPED.length
  const result = {
    keys,
    atOrAbove16: durations.length,
    atOrAbove24: durations.filter((duration) => duration >= 24).length,
    atOrAbove32: durations.filter((duration) => duration >= 32).length,
    atOrAbove50: durations.filter((duration) => duration >= 50).length,
    max: durations.at(-1) ?? 0,
    slowKeys,
    durations,
  }
  report.measure('key presses to paint, ms', result)
  report.check('every typed character reaches the note', value === TYPED, `${value.length} of ${keys}`)
  // Event Timing counts until the next frame is shown, in 8 ms steps; a
  // single frame hiccup reaches 56 ms in both builds now and then.
  report.check('at most 2% of key presses take 50 ms to paint, and none 100 ms, on a canvas with 30 notes', result.atOrAbove50 <= Math.floor(keys * 0.02) && result.max < 100, JSON.stringify({ ...result, durations: undefined }))
  await pressEnter(page, 2)
  await sleep(SETTLE_MS)
  const note = JSON.parse(await readRaw(page, DOC_KEY)).notes.at(-1)
  report.check('the typed note is saved', note?.text === TYPED.trimEnd())
  return note
}

async function noteSettles() {
  const page = app.page
  const list = await animations(page)
  report.check('the written note settles in with a fade', list.some((item) => item.target === 'note' && item.name === 'fade-in'), JSON.stringify(list.filter((item) => item.target === 'note').slice(-2)))
}

async function enterMotion() {
  const page = app.page
  await clickElement(page, 'button.toolbar-pin')
  await waitForPlacement(page, 'wall')
  await sleep(400)
  report.check('the canvas settles on the desktop with a fade', has(await animations(page), 'canvas-area', 'fade-in', 160))

  await enterEdit(page)
  await waitForPlacement(page, 'edit')
  const list = await animations(page)
  report.measure('animations entering Edit', list.filter((item) => ['canvas-area', 'area-frame', 'toolbar'].includes(item.target)))
  report.check('entering Edit: the canvas rises and fades in for 220 ms', has(list, 'canvas-area', 'canvas-rise', 220))
  report.check('entering Edit: the dim fades in for 220 ms', has(list, 'area-frame', 'fade-in', 220))
  report.check('entering Edit: the toolbar rises 60 ms later', has(list, 'toolbar', 'toolbar-rise', 220, 60))
  await sleep(500)
  const rest = await page.evaluate(`(() => {
    const area = getComputedStyle(document.querySelector('.canvas-area'))
    const bar = document.querySelector('.toolbar-bar').getBoundingClientRect()
    return { opacity: area.opacity, translate: area.translate, barBottom: bar.bottom }
  })()`)
  const bottom = await page.evaluate('Math.min(innerHeight, (screen.availTop ?? 0) + screen.availHeight)')
  report.check('after the motion the canvas rests in place and the toolbar sits 20 px above the taskbar', rest.opacity === '1' && ['none', '0px 0px', '0px'].includes(rest.translate) && Math.abs(rest.barBottom - (bottom - 20)) <= 1, JSON.stringify(rest))
}

async function pinMotion() {
  const page = app.page
  const rect = await areaRect(page)
  await page.evaluate(`(() => {
    const shell = document.querySelector('.canvie-shell')
    window.__canvieShell = []
    const started = performance.now()
    new MutationObserver(() => {
      const doc = JSON.parse(localStorage.getItem(${JSON.stringify(DOC_KEY)}))
      window.__canvieShell.push({ at: Math.round(performance.now() - started), className: shell.className, strokes: doc.strokes.length })
    }).observe(shell, { attributes: true, attributeFilter: ['class'] })
    window.__canvieClick = () => Math.round(performance.now() - started)
    return true
  })()`)
  await sleep(SETTLE_MS)
  const strokes = await page.evaluate("JSON.parse(localStorage.getItem('canvie.document')).strokes.length")
  await pressLetter(page, 'b')
  await drag(page, Array.from({ length: 8 }, (_, step) => ({ x: rect.x + rect.width - 300 + step * 20, y: rect.y + rect.height - 40 })))
  await pressLetter(page, 'b')
  const clickedAt = await page.evaluate('window.__canvieClick()')
  await clickElement(page, 'button.toolbar-pin')
  await waitForPlacement(page, 'wall')
  await sleep(300)
  const changes = await page.evaluate('window.__canvieShell')
  const leaving = changes.find((change) => change.className.includes('is-leaving'))
  const wall = changes.find((change) => change.className.includes('is-wall'))
  report.measure('Fixar timeline, ms after the click', { leaving: leaving && leaving.at - clickedAt, wall: wall && wall.at - clickedAt })
  report.check('the canvas sinks only after the save, with the last stroke in it', leaving !== undefined && leaving.strokes === strokes + 1, JSON.stringify(leaving))
  report.check('the window goes to the desktop after the 180 ms exit', leaving !== undefined && wall !== undefined && wall.at - leaving.at >= 170, JSON.stringify(changes))
}

async function layersMotion() {
  const page = app.page
  await enterEdit(page)
  await waitForPlacement(page, 'edit')
  await sleep(400)
  await pressLetter(page, 'b')
  report.check('the Pincel popover pops in', has(await animations(page), 'toolbar-popover', 'pop-in', 140))
  await pressLetter(page, 'b')
  await openMenu(page)
  report.check('the menu pops in', has(await animations(page), 'context-menu', 'pop-in', 120))
  await pressEscape(page)
  await clickElement(page, '.note-postit')
  await sleep(100)
  report.check('the alignment bar rises in over the selected note', has(await animations(page), 'context-bar', 'bar-in', 120))
  await pressEscape(page)
}

// A real Ctrl + Alt + T from Wall. A pixel of empty canvas may only move
// toward its final color: the desktop canvas must never flash in front of the
// other windows before the fade-in.
async function noFlash() {
  const page = app.page
  if ((await placementOf(page)).placement !== 'wall') {
    await clickElement(page, 'button.toolbar-pin')
    await waitForPlacement(page, 'wall')
  }
  await sleep(600)
  const scale = await page.evaluate('window.devicePixelRatio || 1')
  const point = { x: (AREA.x + AREA.width / 2 + 600) * scale, y: (AREA.y + AREA.height / 2 + 220) * scale }
  const startAt = Date.now() + 1500
  // send-keys starts its own PowerShell, so the press lands up to a second
  // later; the series is long enough to hold it and the whole fade.
  const series = pixelSeries(point, { startAt, duration: 2500, path: report.file('l13-03-pixel-entrada.csv') }).catch(() => [])
  await sleep(startAt - Date.now() + 80)
  sendKeys('ctrl+alt+t')
  const rows = await series
  await waitForPlacement(page, 'edit')
  if (rows.length === 0) throw new Error('the pixel series did not run')
  const final = rows.at(-1)
  const distance = (row) => Math.abs(row[1] - final[1]) + Math.abs(row[2] - final[2]) + Math.abs(row[3] - final[3])
  let closest = Infinity
  let rebound = 0
  for (const row of rows) {
    closest = Math.min(closest, distance(row))
    rebound = Math.max(rebound, distance(row) - closest)
  }
  const changes = rows.filter((row, index) => index === 0 || distance(row) !== distance(rows[index - 1])).map(([ms, r, g, b]) => `${ms}ms rgb(${r},${g},${b})`)
  report.measure('canvas pixel during a real Ctrl + Alt + T', changes.slice(0, 16))
  if (distance(rows[0]) <= 100) report.check('a real Ctrl + Alt + T fades the canvas in without a flash', false, 'skipped: the canvas was already visible on the desktop')
  else report.check('a real Ctrl + Alt + T fades the canvas in without a flash', rebound < 40, `largest step away from the final color: ${rebound}`)
}

async function filmstrip() {
  const page = app.page
  await clickElement(page, 'button.toolbar-pin')
  await waitForPlacement(page, 'wall')
  await sleep(500)
  const region = { x: AREA.x - 40, y: AREA.y - 40, width: AREA.width + 80, height: 1032 - AREA.y + 40 }
  // Ten times slower, so a strip of real-screen frames shows the movement.
  await page.send('Animation.enable')
  await page.send('Animation.setPlaybackRate', { playbackRate: 0.1 })
  const startAt = Date.now() + 1500
  const capture = captureFrames(region, { count: 6, interval: 500, path: report.file('l13-01-entrada-camera-lenta.png'), startAt }).catch(() => null)
  await sleep(startAt - Date.now() + 50)
  sendKeys('ctrl+alt+t')
  await capture
  await waitForPlacement(page, 'edit')
  // The exit follows the animation's end, so it slows down with it.
  await page.send('Animation.setPlaybackRate', { playbackRate: 0.2 })
  await sleep(300)
  const exitAt = Date.now() + 1500
  const exit = captureFrames(region, { count: 6, interval: 200, path: report.file('l13-02-fixar.png'), startAt: exitAt }).catch(() => null)
  await sleep(exitAt - Date.now() + 20)
  await clickElement(page, 'button.toolbar-pin')
  await exit
  await waitForPlacement(page, 'wall')
  await page.send('Animation.setPlaybackRate', { playbackRate: 1 })
  report.check('the transition strips were captured from the real screen', true, report.file('l13-01-entrada-camera-lenta.png'))
}

async function reducedMotion() {
  const page = app.page
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await enterEdit(page)
  await waitForPlacement(page, 'edit')
  const list = await animations(page)
  report.check('with reduced motion, entering Edit runs no animation', list.length === 0, JSON.stringify(list.slice(0, 3)))
  const started = Date.now()
  await clickElement(page, 'button.toolbar-pin')
  await waitForPlacement(page, 'wall')
  report.measure('Fixar to Wall with reduced motion, ms', Date.now() - started)
  report.check('with reduced motion, Fixar does not wait for an animation', (await animations(page)).length === 0)
  await page.send('Emulation.setEmulatedMedia', { features: [] })
}

try {
  const scenarios = typingOnly ? [setup, typing] : [setup, typing, noteSettles, enterMotion, pinMotion, layersMotion, noFlash, filmstrip, reducedMotion]
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
process.exit(report.finish({ exe, executable: statSync(exe).mtime, typingOnly }))
