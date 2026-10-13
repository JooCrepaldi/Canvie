// Launches the release build on a throwaway WebView2 profile with the
// DevTools endpoint open, and ends it the way a user or a crash would.
import { execFileSync, spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { DevTools, withTimeout } from './devtools.mjs'

const WEBVIEW2_DEFAULT_ARGS = '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection'
const READY = "document.querySelector('.canvie-shell') !== null && (document.querySelector('.canvas-area') === null || (document.querySelector('canvas')?.width ?? 0) > 1)"

export const placementOf = (page) => page.evaluate("window.__TAURI_INTERNALS__.invoke('get_placement')")

export async function waitForPlacement(page, placement, timeoutMs = 10_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const snapshot = await placementOf(page).catch(() => null)
    if (snapshot?.placement === placement) return Date.now() - started
    await sleep(50)
  }
  throw new Error(`placement did not become ${placement}`)
}

// WM_CLOSE to the Canvie window, like Alt + F4 or a close button.
export function closeWindow(pid) {
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(import.meta.dirname, 'close-window.ps1'), '-ProcessId', String(pid)], { stdio: 'ignore' })
}

export function webviewCommandLines() {
  const script = "Get-CimInstance Win32_Process -Filter \"Name='msedgewebview2.exe'\" | ForEach-Object { $_.CommandLine }"
  return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
}

export class CanvieApp {
  constructor({ exe, port, profileDir, onReady }) {
    this.exe = exe
    this.port = port
    this.profileDir = profileDir
    this.onReady = onReady
    this.launches = 0
    this.current = null
  }

  get page() {
    return this.current?.page
  }

  get child() {
    return this.current?.child
  }

  // True when WebView2 runs on the throwaway profile instead of the user's.
  isolated() {
    return webviewCommandLines().some((line) => line.includes(basename(this.profileDir)))
  }

  // edit: after boot, bring the canvas to Edit through the real enter_edit
  // command, so suites that draw can interact with it.
  async launch(label, { edit = false } = {}) {
    const started = Date.now()
    const child = spawn(this.exe, [], {
      env: {
        ...process.env,
        WEBVIEW2_USER_DATA_FOLDER: this.profileDir,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `${WEBVIEW2_DEFAULT_ARGS} --remote-debugging-port=${this.port}`,
      },
      stdio: 'ignore',
    })
    const exited = new Promise((resolve) => child.once('exit', resolve))
    const page = await DevTools.attach(this.port)
    await page.waitFor(READY)
    await sleep(200)
    this.launches += 1
    this.current = { child, page, exited }
    this.onReady?.(label, Date.now() - started)
    if (edit) {
      // The first launch may already be asking for Edit; a second request is harmless.
      if ((await placementOf(page))?.placement !== 'edit') await page.evaluate("window.__TAURI_INTERNALS__.invoke('enter_edit').catch(() => null)")
      await waitForPlacement(page, 'edit')
      await page.waitFor("document.querySelector('.toolbar') !== null")
    }
    return page
  }

  // mode: 'kill' ends canvie.exe only, 'tree' also ends its WebView2
  // processes, 'close' sends WM_CLOSE to the Canvie window, like Alt + F4.
  async stop(mode) {
    const { child, page, exited } = this.current
    this.current = null
    page.close()
    if (mode === 'close') {
      closeWindow(child.pid)
    } else {
      execFileSync('taskkill', ['/PID', String(child.pid), ...(mode === 'tree' ? ['/T', '/F'] : ['/F'])], { stdio: 'ignore' })
    }
    await withTimeout(exited, 20_000, `Canvie did not exit after ${mode}`)
    return this.waitForProfileRelease()
  }

  // WebView2 can hold profile files for a moment after the last process
  // exits; a leftover temp folder is reported instead of failing the run.
  removeProfile() {
    try {
      rmSync(this.profileDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 })
    } catch (error) {
      console.warn(`WARN  could not remove the E2E profile ${this.profileDir}: ${error.message}`)
    }
  }

  async waitForProfileRelease(timeoutMs = 30_000) {
    const started = Date.now()
    const name = basename(this.profileDir)
    while (Date.now() - started < timeoutMs) {
      if (!webviewCommandLines().some((line) => line.includes(name))) return Date.now() - started
      await sleep(500)
    }
    throw new Error('WebView2 processes kept the test profile open')
  }
}
