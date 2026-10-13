// Node wrappers for the Win32 probes, which run in PowerShell.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const powershell = (script, args) =>
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(import.meta.dirname, script), ...args], { encoding: 'utf8' })

// point is optional and uses physical screen pixels. scanStep lists the
// grid points where the desktop icon layer is exposed.
export function probeWindow(pid, point, scanStep = 0) {
  const args = ['-ProcessId', String(pid)]
  if (point) args.push('-X', String(Math.round(point.x)), '-Y', String(Math.round(point.y)))
  if (scanStep > 0) args.push('-ScanStep', String(scanStep))
  return JSON.parse(powershell('win32-probe.ps1', args))
}

// Screen colors at physical pixels, as [r, g, b] per point.
export function screenPixels(points) {
  return JSON.parse(powershell('screen-pixel.ps1', ['-Points', points.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(';')]))
}

export function captureScreen(rect, path) {
  powershell('screen-capture.ps1', ['-X', String(Math.round(rect.x)), '-Y', String(Math.round(rect.y)), '-Width', String(Math.round(rect.width)), '-Height', String(Math.round(rect.height)), '-Path', path])
}
