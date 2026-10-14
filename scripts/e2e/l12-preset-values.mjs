// L12 E2E driver: the preset values of decision 0008 on the release build.
// The Pincel draws with the Caneta or the Marca-texto in six inks; the Texto
// writes in Serifa, Sem serifa or Mono, in six sizes. Everything is saved and
// comes back after the process is killed. At least one ink stays readable
// on every opaque theme.
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { CanvieApp } from './lib/app.mjs'
import {
  activeTool,
  areaRect,
  canvasDigest,
  chooseInk,
  click,
  clickElement,
  defineArea,
  drag,
  menuAction,
  notice,
  pressEnter,
  pressLetter,
  pressed,
  readRaw,
  screenshot,
  typeText,
} from './lib/devtools.mjs'
import { Report } from './lib/report.mjs'
import { captureScreen } from './lib/win32.mjs'

const DOC_KEY = 'canvie.document'
const SETTLE_MS = 350 + 400
const INKS = [
  ['Tinta preta', '#1F2328'],
  ['Tinta azul', '#2563EB'],
  ['Tinta vermelha', '#DC2626'],
  ['Tinta verde', '#16A34A'],
  ['Tinta amarela', '#FACC15'],
  ['Tinta branca', '#F8FAFC'],
]
const FONTS = [
  ['Fonte Serifa', 'serif', 'Georgia'],
  ['Fonte Sem serifa', 'sans', '"Segoe UI Variable"'],
  ['Fonte Mono', 'mono', '"Cascadia Mono"'],
]
const SIZES = [
  ['Texto muito pequeno', 'xs', '12px'],
  ['Texto pequeno', 'sm', '14px'],
  ['Texto médio', 'md', '18px'],
  ['Texto grande', 'lg', '24px'],
  ['Texto muito grande', 'xl', '32px'],
  ['Texto extra grande', 'xxl', '48px'],
]
const THEMES = [
  ['Bege', 'paper'],
  ['Branco', 'white'],
  ['Preto', 'black'],
  ['Amarelo', 'yellow'],
]
const editorOpen = "document.activeElement?.classList.contains('note-editor') === true"

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
const report = new Report(options.evidence ?? join(tmpdir(), `canvie-e2e-l12-${new Date().toISOString().replace(/[:.]/g, '-')}`))
const profileDir = mkdtempSync(join(tmpdir(), 'canvie-e2e-profile-'))
const app = new CanvieApp({ exe, port: Number(options.port), profileDir, onReady: (label, ms) => report.measure(`launch ready ms (${label})`, ms) })

const readDoc = async (page) => JSON.parse(await readRaw(page, DOC_KEY))
const strokeY = (rect, index) => rect.y + rect.height - 140 + index * 17
const strokePoints = (rect, index) => Array.from({ length: 14 }, (_, step) => ({ x: rect.x + 60 + step * 30, y: strokeY(rect, index) }))

// The canvas pixel under a point of the window, as [r, g, b, a].
const pixelAt = (page, x, y) =>
  page.evaluate(`(() => {
    const canvas = document.querySelector('canvas.canvas-surface')
    const rect = canvas.getBoundingClientRect()
    const scale = canvas.width / rect.width
    return [...canvas.getContext('2d').getImageData(Math.round((${x} - rect.left) * scale), Math.round((${y} - rect.top) * scale), 1, 1).data]
  })()`)

const noteStyles = (page) =>
  page.evaluate(`[...document.querySelectorAll('.note-text:not(.note-editor)')].map((element) => {
    const style = getComputedStyle(element)
    return { text: element.textContent.trim(), size: style.fontSize, family: style.fontFamily }
  })`)

const parseColor = (value) => {
  if (value.startsWith('#')) return [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16))
  return value.match(/\d+/g).slice(0, 3).map(Number)
}
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((channel) => {
    const unit = channel / 255
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

async function firstRun() {
  const page = await app.launch('fresh profile', { edit: true })
  const isolated = app.isolated()
  report.check('WebView2 uses the throwaway E2E profile', isolated)
  if (!isolated) throw new Error('WEBVIEW2_USER_DATA_FOLDER was ignored; refusing to write to the real profile')
  await defineArea(page, { x: 120, y: 100 }, { x: 1500, y: 780 })
}

async function inksAndBrushes() {
  const page = app.page
  const rect = await areaRect(page)
  await pressLetter(page, 'b')
  const offered = await page.evaluate("[...document.querySelectorAll('.toolbar-popover button')].map((button) => button.getAttribute('aria-label'))")
  report.check('the Pincel offers Caneta, Marca-texto, Borracha and six inks', offered.join('|') === ['Caneta', 'Marca-texto', 'Borracha, atalho E', ...INKS.map(([label]) => label)].join('|'), offered.join('|'))

  for (const [index, [label]] of INKS.entries()) {
    await chooseInk(page, label)
    await drag(page, strokePoints(rect, index))
  }
  await clickElement(page, 'button[aria-label="Marca-texto"]')
  await chooseInk(page, 'Tinta amarela')
  report.check('Marca-texto is pressed and the Pincel stays the tool', (await pressed(page, 'Marca-texto')) === 'true' && (await pressed(page, 'Caneta')) === 'false' && (await activeTool(page)) === 'brush')
  await drag(page, strokePoints(rect, INKS.length))
  await clickElement(page, 'button[aria-label="Caneta"]')
  await sleep(SETTLE_MS)

  const strokes = (await readDoc(page)).strokes.map(({ color, brush, width }) => `${color}/${brush}/${width}`)
  const expected = [...INKS.map(([, color]) => `${color}/pen/3`), '#FACC15/highlighter/18']
  report.check('six pen strokes and one highlighter stroke are stored with their ink and width', strokes.join(' ') === expected.join(' '), strokes.join(' '))
  const pen = await pixelAt(page, rect.x + 60 + 6 * 30, strokeY(rect, 1))
  const marker = await pixelAt(page, rect.x + 60 + 6 * 30, strokeY(rect, INKS.length))
  report.measure('pixel on the blue pen stroke', pen)
  report.measure('pixel on the yellow highlighter stroke', marker)
  report.check('the Caneta draws opaque ink', pen[3] === 255 && pen[2] > 200)
  report.check('the Marca-texto draws translucent ink, about 35%', marker[3] >= 80 && marker[3] <= 100 && marker[0] > 200 && marker[1] > 150, `alpha ${marker[3]}`)
}

async function fontsAndSizes() {
  const page = app.page
  const rect = await areaRect(page)
  for (const [index, [sizeLabel, size]] of SIZES.entries()) {
    const [fontLabel, font] = FONTS[index % FONTS.length]
    await pressLetter(page, 't')
    await clickElement(page, `button[aria-label="${fontLabel}"]`)
    await clickElement(page, `button[aria-label="${sizeLabel}"]`)
    await click(page, rect.x + 40 + (index % 3) * 440, rect.y + 40 + Math.floor(index / 3) * 230)
    await page.waitFor(editorOpen)
    await typeText(page, `${font} ${size}`)
    await pressEnter(page, 2)
    await sleep(200)
  }
  await sleep(SETTLE_MS)
  const notes = (await readDoc(page)).notes.map(({ font, size }) => `${font}/${size}`)
  const expected = SIZES.map(([, size], index) => `${FONTS[index % FONTS.length][1]}/${size}`)
  report.check('one note in each font and in each of the six sizes is stored', notes.join(' ') === expected.join(' '), notes.join(' '))
  const styles = await noteStyles(page)
  report.measure('rendered notes', styles)
  const rendered = styles.every((style, index) => style.size === SIZES[index][2] && style.family.startsWith(FONTS[index % FONTS.length][2]))
  report.check('each note renders in its size and font family', rendered && styles.length === SIZES.length)
  report.check('each font keeps a fallback of the same family', styles.every((style) => /serif|monospace/.test(style.family)))
  const installed = await page.evaluate(`({ georgia: document.fonts.check('16px Georgia'), segoe: document.fonts.check('16px "Segoe UI Variable"'), cascadia: document.fonts.check('16px "Cascadia Mono"') })`)
  report.measure('fonts installed on this machine', installed)

  // An existing note takes the font chosen while it is edited.
  await clickElement(page, '.note-text', 2)
  await page.waitFor(editorOpen)
  const shown = await pressed(page, 'Fonte Serifa')
  await clickElement(page, 'button[aria-label="Fonte Mono"]')
  await pressEnter(page, 2)
  await sleep(SETTLE_MS)
  const edited = (await readDoc(page)).notes[0]
  report.check('editing a note shows its font and applies a new one', shown === 'true' && edited.font === 'mono' && edited.size === 'xs', JSON.stringify({ shown, font: edited.font, size: edited.size }))
  await pressLetter(page, 'z', 2)
  await sleep(SETTLE_MS)
  report.check('Ctrl + Z restores the previous font', (await readDoc(page)).notes[0].font === 'serif')
}

async function readableThemes() {
  const page = app.page
  const inks = INKS.map(([, color]) => parseColor(color))
  const results = []
  for (const [label, id] of THEMES) {
    await menuAction(page, label)
    await sleep(200)
    const background = parseColor(await page.evaluate("getComputedStyle(document.querySelector('.canvas-area')).backgroundColor"))
    const best = Math.max(...inks.map((ink) => contrast(ink, background)))
    results.push({ id, best: Math.round(best * 10) / 10 })
  }
  await menuAction(page, 'Bege')
  report.measure('best ink contrast per theme', results)
  report.check('at least one ink reads at 4.5:1 or more on every opaque theme', results.every((result) => result.best >= 4.5), JSON.stringify(results))
}

async function killAndReopen() {
  const page = app.page
  await sleep(SETTLE_MS)
  const rect = await areaRect(page)
  const scale = await page.evaluate('window.devicePixelRatio || 1')
  captureScreen({ x: rect.x * scale, y: rect.y * scale, width: rect.width * scale, height: rect.height * scale }, report.file('l12-01-presets.png'))
  const before = await readRaw(page, DOC_KEY)
  await app.stop('kill')
  const reopened = await app.launch('after kill', { edit: true })
  report.check('the reopened app has the same document', (await readRaw(reopened, DOC_KEY)) === before)
  const styles = await noteStyles(reopened)
  report.check('the reopened notes render in the same sizes and fonts', styles.length === SIZES.length && styles.every((style, index) => style.size === SIZES[index][2]))
  const marker = await pixelAt(reopened, rect.x + 60 + 6 * 30, strokeY(rect, INKS.length))
  report.check('the reopened highlighter stroke is still translucent', marker[3] >= 80 && marker[3] <= 100 && (await canvasDigest(reopened)).ink > 0, `alpha ${marker[3]}`)
  report.check('the reopened app shows no notice', (await notice(reopened)) === null)
  await screenshot(reopened, report.file('l12-02-reopened.png'))
}

try {
  for (const scenario of [firstRun, inksAndBrushes, fontsAndSizes, readableThemes, killAndReopen]) {
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
