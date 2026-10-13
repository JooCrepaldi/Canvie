// Launches the release build on a throwaway WebView2 profile with the
// DevTools endpoint open, and ends it the way a user or a crash would.
import { execFileSync, spawn } from 'node:child_process'
import { basename } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { DevTools, withTimeout } from './devtools.mjs'

const WEBVIEW2_DEFAULT_ARGS = '--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection'
const READY = "document.querySelector('.canvie-shell') !== null && (document.querySelector('.canvas-area') === null || (document.querySelector('canvas')?.width ?? 0) > 1)"

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

  async launch(label) {
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
    return page
  }

  // mode: 'kill' ends canvie.exe only, 'tree' also ends its WebView2
  // processes, 'close' sends WM_CLOSE like the window close button.
  async stop(mode) {
    const { child, page, exited } = this.current
    this.current = null
    page.close()
    const flags = { kill: ['/F'], tree: ['/T', '/F'], close: [] }[mode]
    execFileSync('taskkill', ['/PID', String(child.pid), ...flags], { stdio: 'ignore' })
    await withTimeout(exited, 20_000, `Canvie did not exit after ${mode}`)
    return this.waitForProfileRelease()
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
