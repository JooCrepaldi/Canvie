// L10 and L11 E2E driver: the right-click menu and the new toolbar on the
// release build. The toolbar opens centered above the taskbar, shows its drag
// tab on hover or focus, opens the tool options in popovers and keeps a
// dragged place across launches; the menu opens with the right button or
// Shift + F10 and changes the theme, the zoom, the framing and clears the
// canvas after a confirmation.
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp, placementOf } from './lib/app.mjs'
import {
  activeTool,
  areaRect,
  center,
  chooseInk,
  click,
  clickElement,
  defineArea,
  drag,
  menuAction,
  mouse,
  openMenu,
  press,
  pressEnter,
  pressEscape,
  pressLetter,
  pressShiftF10,
  pressed,
  readRaw,
  screenshot,
  typeText,
  writeRaw,
} from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'
import { captureScreen } from './lib/win32.mjs'

const DOC_KEY = 'canvie.document'
const TOOLBAR_KEY = 'canvie.toolbar'
const SETTLE_MS = 350 + 400
const THEMES = [
  ['Branco', 'white'],
  ['Preto', 'black'],
  ['Amarelo', 'yellow'],
  ['Transparente', 'transparent'],
  ['Bege', 'paper'],
]
const BAR_ORDER = ['Mover toolbar', 'Texto, atalho T', 'Post-it, atalho P', 'Pincel, atalho B', 'Mão, atalho H', 'Fixar no desktop, atalho Ctrl + Alt + T']
const editorOpen = "document.activeElement?.classList.contains('note-editor') === true"
const RESET_LOG = 'saved toolbar position was invalid or off screen'

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
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l10-l11-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const app = new CanvieApp({ exe, port: Number(options.port), profileDir, onReady: (label, ms) => report.measure(`launch ready ms (${label})`, ms) })

const readDoc = async (page) => JSON.parse(await readRaw(page, DOC_KEY))
const rectOf = (page, selector) =>
  page.evaluate(`(() => {
    const rect = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect()
    return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
  })()`)
const tabOpacity = (page) => page.evaluate("getComputedStyle(document.querySelector('.toolbar-tab')).opacity")
const popoverName = (page) => page.evaluate("document.querySelector('.toolbar-popover')?.getAttribute('aria-label') ?? null")
const focusedName = (page) => page.evaluate("document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent.trim() ?? null")
const pressTab = (page) => press(page, 'Tab', { code: 'Tab', keyCode: 9 })
const pressArrowDown = (page) => press(page, 'ArrowDown', { code: 'ArrowDown', keyCode: 40 })
const near = (a, b) => Math.abs(a - b) <= 1

// Types a percentage in the menu's zoom field and applies it with Enter.
async function typeZoom(page, text) {
  await openMenu(page)
  await clickElement(page, '.menu-zoom-field')
  await page.evaluate("document.querySelector('.menu-zoom-field').select(); true")
  await page.send('Input.insertText', { text })
  await pressEnter(page)
  await page.waitFor("document.querySelector('.context-menu') === null", 5_000)
  await sleep(SETTLE_MS)
}

const notesInside = (page, area) =>
  page.evaluate(`[...document.querySelectorAll('.note')].map((note) => {
    const rect = note.getBoundingClientRect()
    return rect.left >= ${area.x} && rect.top >= ${area.y} && rect.right <= ${area.x + area.width} && rect.bottom <= ${area.y + area.height}
  })`)

// The bottom of the monitor's work area, where the taskbar starts, in CSS pixels.
const workAreaBottom = (page) => page.evaluate('Math.min(innerHeight, (screen.availTop ?? 0) + screen.availHeight)')

async function hoverToolbar(page) {
  const bar = await center(page, '.toolbar-bar')
  await mouse(page, 'mouseMoved', bar.x, bar.y, { buttons: 0 })
  await sleep(300)
}

async function leaveToolbar(page) {
  const rect = await areaRect(page)
  await mouse(page, 'mouseMoved', rect.x + 20, rect.y + 20, { buttons: 0 })
  await sleep(700)
}

// A photo of the real screen around the toolbar, in physical pixels.
async function photo(page, name, rect) {
  const scale = await page.evaluate('window.devicePixelRatio || 1')
  captureScreen({ x: rect.x * scale, y: rect.y * scale, width: rect.width * scale, height: rect.height * scale }, report.file(name))
}

async function firstRun() {
  const page = await app.launch('fresh profile', { edit: true })
  const isolated = app.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  await defineArea(page, { x: 160, y: 140 }, { x: 1000, y: 640 })
  await leaveToolbar(page)

  const bar = await rectOf(page, '.toolbar-bar')
  const width = await page.evaluate('innerWidth')
  const bottom = await workAreaBottom(page)
  report.measure('toolbar bar', bar)
  report.check('the toolbar opens centered above the taskbar', near(bar.x + bar.width / 2, width / 2) && near(bar.y + bar.height, bottom - 20), `center=${bar.x + bar.width / 2} bottom=${bar.y + bar.height} workArea=${bottom}`)
  const names = await page.evaluate("[...document.querySelectorAll('.toolbar button')].map((button) => button.getAttribute('aria-label'))")
  report.check('the toolbar holds the tab, Texto, Post-it, Pincel, Mão and Fixar, in order', names.join('|') === BAR_ORDER.join('|'), names.join('|'))
  report.check('no tool is pressed in Seleção and no popover is open', (await activeTool(page)) === 'select' && (await popoverName(page)) === null)
  report.check('the drag tab is hidden while the pointer is away', (await tabOpacity(page)) === '0')
  await hoverToolbar(page)
  const hovered = await tabOpacity(page)
  report.check('the drag tab shows while the pointer is over the toolbar', hovered === '1', `opacity ${hovered}`)
  await photo(page, 'l11-01-toolbar-hover.png', { x: bar.x - 40, y: bar.y - 300, width: bar.width + 80, height: bar.height + 340 })
  await leaveToolbar(page)

  // Tab order, before any note exists, so focus starts at the toolbar.
  await page.evaluate('document.activeElement?.blur(); true')
  const visited = []
  for (let step = 0; step < BAR_ORDER.length; step += 1) {
    await pressTab(page)
    visited.push(await focusedName(page))
    if (step === 0) {
      await sleep(250)
      report.check('focus on the drag tab shows it', (await tabOpacity(page)) === '1')
    }
  }
  report.check('Tab visits the toolbar controls in order', visited.join('|') === BAR_ORDER.join('|'), visited.join('|'))
  await page.evaluate('document.activeElement?.blur(); true')
}

async function popovers() {
  const page = app.page
  const bar = await rectOf(page, '.toolbar-bar')
  await pressLetter(page, 'b')
  const brushPopover = await popoverName(page)
  const popover = await rectOf(page, '.toolbar-popover')
  report.check('Pincel opens its options above the toolbar', brushPopover === 'Opções do pincel' && popover.y + popover.height < bar.y && (await pressed(page, 'Caneta')) === 'true', JSON.stringify(popover))
  await pressLetter(page, 'e')
  report.check('Borracha is chosen in the popover and keeps Pincel pressed', (await activeTool(page)) === 'eraser' && (await pressed(page, 'Borracha,')) === 'true' && (await pressed(page, 'Pincel,')) === 'true')
  await chooseInk(page, 'Tinta vermelha')
  report.check('an ink goes back to the Caneta', (await activeTool(page)) === 'brush' && (await pressed(page, 'Tinta vermelha')) === 'true')
  const rect = await areaRect(page)
  await drag(page, Array.from({ length: 10 }, (_, step) => ({ x: rect.x + 60 + step * 30, y: rect.y + 80 + Math.sin(step) * 8 })))
  await sleep(SETTLE_MS)
  report.check('the Caneta draws in red', (await readDoc(page)).strokes.at(-1)?.color === '#DC2626')
  const after = await rectOf(page, '.toolbar-bar')
  report.check('clicking tools never moves the toolbar', after.x === bar.x && after.y === bar.y)

  await pressEscape(page)
  await sleep(200)
  report.check('the first Esc closes the popover and keeps the tool and Edit', (await popoverName(page)) === null && (await activeTool(page)) === 'brush' && (await placementOf(page)).placement === 'edit')
  await pressLetter(page, 't')
  report.check('Texto opens the sizes, with the current one pressed', (await popoverName(page)) === 'Opções do texto' && (await pressed(page, 'Texto médio')) === 'true')
  await pressLetter(page, 't')
  report.check('repeating the letter closes the tool and its popover', (await activeTool(page)) === 'select' && (await popoverName(page)) === null)
}

async function caretOnlyEditor() {
  const page = app.page
  const rect = await areaRect(page)
  const at = { x: rect.x + 120, y: rect.y + 220 }
  await click(page, at.x, at.y, 1)
  await click(page, at.x, at.y, 2)
  await page.waitFor(editorOpen)
  const look = await page.evaluate(`(() => {
    const editor = document.querySelector('.note-editor')
    const style = getComputedStyle(editor)
    return { border: style.borderTopWidth, background: style.backgroundColor, outline: style.outlineStyle, placeholder: editor.getAttribute('placeholder') }
  })()`)
  report.check('writing shows only the caret: no border, field, outline or placeholder', look.border === '0px' && look.background === 'rgba(0, 0, 0, 0)' && look.outline === 'none' && look.placeholder === null, JSON.stringify(look))
  report.check('the sizes show while an existing or new note is written in Seleção', (await activeTool(page)) === 'select' && (await popoverName(page)) === 'Opções do texto')
  await typeText(page, 'Plano da semana')
  const editor = await rectOf(page, '.note-editor')
  await clickElement(page, 'button[aria-label="Texto grande"]')
  report.check('a size keeps the editor open', await page.evaluate(editorOpen))
  await typeText(page, ' ok')
  const sized = await rectOf(page, '.note-editor')
  await pressEnter(page, 2)
  await sleep(SETTLE_MS)
  const note = (await readDoc(page)).notes.at(-1)
  const rendered = await page.evaluate(`(() => {
    const element = [...document.querySelectorAll('.note-text')].find((candidate) => candidate.textContent.includes('Plano'))
    const rect = element?.getBoundingClientRect()
    return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
  })()`)
  report.check('the note keeps the large size', note?.text === 'Plano da semana ok' && note.size === 'lg', JSON.stringify(note))
  report.check('the written note stays where the caret wrote it', near(rendered.x, sized.x) && near(rendered.y, sized.y) && near(rendered.width, sized.width), `${JSON.stringify(editor)} -> ${JSON.stringify(sized)} -> ${JSON.stringify(rendered)}`)
  report.check('the sizes close with the editor', (await popoverName(page)) === null)
}

async function menuOpens() {
  const page = app.page
  const rect = await areaRect(page)
  await pressLetter(page, 'b')
  const strokes = (await readDoc(page)).strokes.length
  const point = { x: rect.x + rect.width - 140, y: rect.y + 60 }
  await openMenu(page, point)
  const menu = await rectOf(page, '.context-menu')
  await sleep(SETTLE_MS)
  report.check('the right button opens the menu at the pointer', near(menu.x, point.x) && near(menu.y, point.y), JSON.stringify(menu))
  report.check('the right button draws nothing', (await readDoc(page)).strokes.length === strokes)
  report.check('the menu focuses its first item', (await focusedName(page)) === 'Reposicionar toolbar')
  await pressArrowDown(page)
  report.check('arrows move through the items', (await focusedName(page))?.startsWith('Bege'))
  await press(page, 'Home', { code: 'Home', keyCode: 36 })
  const cycle = []
  for (const modifiers of [8, 8, 0, 0]) {
    await press(page, 'Tab', { code: 'Tab', keyCode: 9, modifiers })
    cycle.push(await focusedName(page))
  }
  report.check('Tab stays inside the menu and reaches the zoom field', cycle.join('|') === 'Limpar canvas…|Zoom em porcentagem|Limpar canvas…|Reposicionar toolbar', cycle.join('|'))
  await photo(page, 'l10-01-menu.png', { x: menu.x - 20, y: menu.y - 20, width: menu.width + 40, height: menu.height + 40 })
  await pressEscape(page)
  await sleep(200)
  report.check('Esc closes the menu and stays in Edit', (await rectOf(page, '.context-menu')) === null && (await placementOf(page)).placement === 'edit')

  await mouse(page, 'mousePressed', rect.x - 40, rect.y - 40, { button: 'right', buttons: 2, clickCount: 1 })
  await mouse(page, 'mouseReleased', rect.x - 40, rect.y - 40, { button: 'right', buttons: 0, clickCount: 1 })
  await sleep(300)
  report.check('outside the area the right button opens nothing', (await rectOf(page, '.context-menu')) === null)

  await pressShiftF10(page)
  await page.waitFor("document.querySelector('.context-menu') !== null", 5_000)
  const keyboard = await rectOf(page, '.context-menu')
  report.check('Shift + F10 opens the menu at the center of the area', near(keyboard.x, rect.x + rect.width / 2) && near(keyboard.y, rect.y + rect.height / 2), JSON.stringify(keyboard))
  await pressEscape(page)
  await pressLetter(page, 'b')
}

async function themes() {
  const page = app.page
  const results = []
  for (const [label, id] of THEMES) {
    await menuAction(page, label)
    await sleep(SETTLE_MS)
    const doc = await readDoc(page)
    const painted = await page.evaluate(`document.querySelector('.canvas-area').classList.contains('background-${id}')`)
    results.push(`${label}:${doc.background === id && painted}`)
    if (id === 'black') {
      await openMenu(page)
      const checked = await page.evaluate("document.querySelector('[role=menuitemradio][aria-checked=true]')?.textContent.trim()")
      report.check('the menu marks the current theme', checked === 'Preto', checked)
      await pressEscape(page)
      await photo(page, 'l10-02-black.png', await areaRect(page))
    }
  }
  report.check('every theme applies and is stored', results.every((result) => result.endsWith('true')), results.join(' '))
}

async function zoomAndFit() {
  const page = app.page
  const zoom = async () => (await readDoc(page)).camera.zoom
  await menuAction(page, '200%')
  await sleep(SETTLE_MS)
  const twice = await zoom()
  await menuAction(page, '50%')
  await sleep(SETTLE_MS)
  const half = await zoom()
  await typeZoom(page, '150')
  const typed = await zoom()
  report.check('Zoom 200%, 50% and a typed 150 apply', twice === 2 && half === 0.5 && typed === 1.5, `${twice} ${half} ${typed}`)
  await typeZoom(page, '1000')
  report.check('a zoom beyond 400% stops at 400%', (await zoom()) === 4, String(await zoom()))

  // The Mão pushes the content out of view before the framing.
  await menuAction(page, '100%')
  const area = await areaRect(page)
  await pressLetter(page, 'h')
  const middle = { x: area.x + area.width / 2, y: area.y + area.height / 2 }
  await drag(page, [middle, { x: middle.x - 200, y: middle.y }, { x: middle.x - 400, y: middle.y + 200 }, { x: middle.x - 700, y: middle.y + 300 }])
  await pressLetter(page, 'h')
  await sleep(SETTLE_MS)
  const before = (await readDoc(page)).camera
  const hidden = await notesInside(page, area)
  await menuAction(page, 'Ajustar à tela')
  await sleep(SETTLE_MS)
  const fitted = (await readDoc(page)).camera
  const inside = await notesInside(page, area)
  report.check('Ajustar à tela brings content out of view back inside the area', hidden.some((shown) => !shown) && inside.every(Boolean) && fitted.zoom >= 0.25 && fitted.zoom <= 4, `${JSON.stringify(hidden)} -> ${JSON.stringify(inside)} ${JSON.stringify(fitted)}`)
  await pressLetter(page, 'z', 2)
  await sleep(SETTLE_MS)
  report.check('Ctrl + Z undoes the framing', JSON.stringify((await readDoc(page)).camera) === JSON.stringify(before))
  await menuAction(page, '100%')
}

async function clearCanvas() {
  const page = app.page
  const before = await readDoc(page)
  await menuAction(page, 'Limpar canvas…')
  await page.waitFor("document.querySelector('.clear-dialog') !== null", 5_000)
  report.check('Limpar asks first, with the focus on Cancelar', (await focusedName(page)) === 'Cancelar')
  await pressEnter(page)
  await sleep(SETTLE_MS)
  report.check('Enter on Cancelar keeps everything', (await rectOf(page, '.clear-dialog')) === null && JSON.stringify(await readDoc(page)) === JSON.stringify(before))

  await menuAction(page, 'Limpar canvas…')
  await page.waitFor("document.querySelector('.clear-dialog') !== null", 5_000)
  await pressEscape(page)
  await sleep(200)
  report.check('Esc cancels Limpar and stays in Edit', (await rectOf(page, '.clear-dialog')) === null && (await placementOf(page)).placement === 'edit' && (await readDoc(page)).notes.length === before.notes.length)

  await menuAction(page, 'Limpar canvas…')
  await page.waitFor("document.querySelector('.clear-dialog') !== null", 5_000)
  await photo(page, 'l10-03-clear.png', await rectOf(page, '.clear-dialog').then((rect) => ({ x: rect.x - 30, y: rect.y - 30, width: rect.width + 60, height: rect.height + 60 })))
  await pressTab(page)
  report.check('Tab moves to Limpar inside the dialog', (await focusedName(page)) === 'Limpar')
  await pressEnter(page)
  await sleep(SETTLE_MS)
  const cleared = await readDoc(page)
  report.check('Limpar removes strokes and notes and keeps area, theme and camera', cleared.strokes.length === 0 && cleared.notes.length === 0 && JSON.stringify(cleared.area) === JSON.stringify(before.area) && cleared.background === before.background && JSON.stringify(cleared.camera) === JSON.stringify(before.camera))
  await pressLetter(page, 'z', 2)
  await sleep(SETTLE_MS)
  const restored = await readDoc(page)
  report.check('Ctrl + Z brings the cleared content back', restored.strokes.length === before.strokes.length && restored.notes.length === before.notes.length)
}

async function dragAndKeep() {
  const page = app.page
  await hoverToolbar(page)
  const bar = await rectOf(page, '.toolbar-bar')
  const tab = await center(page, '.toolbar-tab')
  const to = { x: tab.x - 500, y: tab.y - 420 }
  await drag(page, [tab, { x: tab.x - 100, y: tab.y - 80 }, { x: tab.x - 300, y: tab.y - 250 }, to], 16)
  await sleep(SETTLE_MS)
  const moved = await rectOf(page, '.toolbar-bar')
  const saved = JSON.parse((await readRaw(page, TOOLBAR_KEY)) ?? 'null')
  report.check('dragging the tab moves the toolbar by the pointer distance', near(moved.x, bar.x - 500) && near(moved.y, bar.y - 420), `${bar.x},${bar.y} -> ${moved.x},${moved.y}`)
  report.check('the dragged place is saved as a preference', saved !== null && Number.isFinite(saved.left) && Number.isFinite(saved.top), JSON.stringify(saved))
  report.check('the toolbar place stays out of the document', !(await readRaw(page, DOC_KEY)).includes('toolbar'))

  await app.stop('kill')
  const reopened = await app.launch('saved toolbar place after kill', { edit: true })
  const kept = await rectOf(reopened, '.toolbar-bar')
  report.check('a relaunch opens the toolbar where it was left', near(kept.x, moved.x) && near(kept.y, moved.y), `${kept.x},${kept.y}`)

  await menuAction(reopened, 'Reposicionar toolbar')
  await sleep(200)
  const reset = await rectOf(reopened, '.toolbar-bar')
  report.check('Reposicionar toolbar goes back to the default place and forgets the saved one', near(reset.x, bar.x) && near(reset.y, bar.y) && (await readRaw(reopened, TOOLBAR_KEY)) === null, `${reset.x},${reset.y}`)
}

async function badPlaces() {
  for (const [label, value] of [
    ['off-screen toolbar place', JSON.stringify({ left: 99999, top: 99999 })],
    ['invalid toolbar place', 'not json'],
  ]) {
    await writeRaw(app.page, TOOLBAR_KEY, value)
    await app.stop('close')
    const page = await app.launch(label, { edit: true })
    const bar = await rectOf(page, '.toolbar-bar')
    const width = await page.evaluate('innerWidth')
    report.check(`an ${label} opens at the default place and is removed`, near(bar.x + bar.width / 2, width / 2) && (await readRaw(page, TOOLBAR_KEY)) === null, `${bar.x},${bar.y}`)
  }
  const lines = report.newLogLines().filter((line) => line.includes(RESET_LOG))
  report.check('each reset leaves one warning in the release log', lines.length === 2 && lines.every((line) => line.includes('WARN')), `${lines.length} lines`)
}

try {
  for (const scenario of [firstRun, popovers, caretOnlyEditor, menuOpens, themes, zoomAndFit, clearCanvas, dragAndKeep, badPlaces]) {
    console.log(`\n== ${scenario.name}`)
    await scenario()
  }
  await screenshot(app.page, report.file('l11-02-final.png'))
  await app.stop('close')
} catch (error) {
  report.check('E2E run completed', false, error instanceof Error ? error.message : String(error))
} finally {
  if (app.current) await app.stop('kill').catch(() => undefined)
  app.removeProfile()
}

report.checkLog(app.launches)
process.exit(report.finish({ exe, executable: statSync(exe).mtime }))
