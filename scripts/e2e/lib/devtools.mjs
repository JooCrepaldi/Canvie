// DevTools protocol client and real-input helpers shared by the E2E drivers.
import { writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

export function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export class DevTools {
  static async attach(port, timeoutMs = 30_000) {
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
    throw new Error('DevTools endpoint did not come up')
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

export async function mouse(page, type, x, y, extra = {}) {
  await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', ...extra })
}

export async function drag(page, points, stepDelayMs = 0) {
  const [first] = points
  await mouse(page, 'mousePressed', first.x, first.y, { buttons: 1, clickCount: 1 })
  for (const point of points.slice(1)) {
    await mouse(page, 'mouseMoved', point.x, point.y, { buttons: 1 })
    if (stepDelayMs > 0) await sleep(stepDelayMs)
  }
  const last = points.at(-1)
  await mouse(page, 'mouseReleased', last.x, last.y, { buttons: 0, clickCount: 1 })
}

export async function click(page, x, y, clickCount = 1) {
  await mouse(page, 'mousePressed', x, y, { buttons: 1, clickCount })
  await mouse(page, 'mouseReleased', x, y, { buttons: 0, clickCount })
}

export async function center(page, selector) {
  const point = await page.evaluate(`(() => {
    const rect = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect()
    return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null
  })()`)
  if (!point) throw new Error(`element not found: ${selector}`)
  return point
}

export async function clickElement(page, selector, clickCount = 1) {
  const point = await center(page, selector)
  if (clickCount === 2) {
    await click(page, point.x, point.y, 1)
    await click(page, point.x, point.y, 2)
  } else {
    await click(page, point.x, point.y)
  }
}

export async function press(page, key, { code, keyCode, text, modifiers = 0 }) {
  const event = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers }
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', text, ...event })
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...event })
}

export function pressLetter(page, letter, modifiers = 0) {
  const upper = letter.toUpperCase()
  return press(page, letter, { code: `Key${upper}`, keyCode: upper.charCodeAt(0), text: modifiers === 0 ? letter : undefined, modifiers })
}

export const pressEnter = (page, modifiers = 0) => press(page, 'Enter', { code: 'Enter', keyCode: 13, text: modifiers === 0 ? '\r' : undefined, modifiers })
export const pressEscape = (page) => press(page, 'Escape', { code: 'Escape', keyCode: 27 })

export async function typeText(page, text) {
  for (const character of text) {
    if (character === '\n') await pressEnter(page)
    else if (/^[a-z]$/i.test(character)) await pressLetter(page, character)
    else await page.send('Input.insertText', { text: character })
  }
}

export async function wheel(page, x, y, deltaY) {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY })
}

export async function screenshot(page, path) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(path, Buffer.from(data, 'base64'))
}

// Drags the canvas area through the real selector, from start to end.
export async function defineArea(page, start, end) {
  await page.waitFor("document.querySelector('.area-selector') !== null")
  const steps = 6
  const points = Array.from({ length: steps + 1 }, (_, step) => ({
    x: start.x + ((end.x - start.x) * step) / steps,
    y: start.y + ((end.y - start.y) * step) / steps,
  }))
  await drag(page, points)
  await page.waitFor("document.querySelector('.area-selector') === null && document.querySelector('.canvas-area') !== null")
}

export const readRaw = (page, key) => page.evaluate(`localStorage.getItem(${JSON.stringify(key)})`)
export const writeRaw = (page, key, value) => page.evaluate(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`)

export const notice = (page) =>
  page.evaluate(`(() => {
    const element = document.querySelector('.canvas-notice')
    return element ? { role: element.getAttribute('role'), text: element.textContent } : null
  })()`)

export const pressed = (page, label) => page.evaluate(`document.querySelector('button[aria-label^=${JSON.stringify(label)}]')?.getAttribute('aria-pressed')`)

export const areaRect = (page) =>
  page.evaluate(`(() => {
    const rect = document.querySelector('.canvas-area')?.getBoundingClientRect()
    return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
  })()`)

export const canvasDigest = (page) =>
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

export const FILLER_KEY = 'canvie.e2e.filler'

// Fills localStorage up to its quota, minus headroom characters, so the next
// larger save fails for real. Returns the free characters measured.
export async function fillStorage(page, headroom) {
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
