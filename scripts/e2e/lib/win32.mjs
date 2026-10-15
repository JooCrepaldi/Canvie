// Node wrappers for the Win32 probes, which run in PowerShell.
import { execFile, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

// Starts capturing count frames of a physical-pixel rectangle, interval ms
// apart, into one strip at path. It runs in the background; await the
// returned promise once the motion being filmed is over.
export function captureFrames(rect, { count, interval, path, startAt = 0 }) {
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(import.meta.dirname, 'screen-frames.ps1')]
  args.push('-X', String(Math.round(rect.x)), '-Y', String(Math.round(rect.y)), '-Width', String(Math.round(rect.width)), '-Height', String(Math.round(rect.height)))
  args.push('-Count', String(count), '-IntervalMs', String(interval), '-Path', path, '-StartAtMs', String(startAt))
  return new Promise((resolve, reject) => {
    execFile('powershell', args, (error) => (error ? reject(error) : resolve(path)))
  })
}

// Samples one physical pixel from startAt for duration ms; resolves to
// [ms, r, g, b] rows. It runs in the background like captureFrames.
export function pixelSeries(point, { startAt, duration, path }) {
  const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(import.meta.dirname, 'pixel-series.ps1')]
  args.push('-X', String(Math.round(point.x)), '-Y', String(Math.round(point.y)), '-StartAtMs', String(startAt), '-DurationMs', String(duration), '-Path', path)
  return new Promise((resolve, reject) => {
    execFile('powershell', args, (error) => {
      if (error) reject(error)
      else resolve(readFileSync(path, 'utf8').trim().split(/\r?\n/).map((line) => line.split(',').map(Number)))
    })
  })
}

export function captureScreen(rect, path) {
  powershell('screen-capture.ps1', ['-X', String(Math.round(rect.x)), '-Y', String(Math.round(rect.y)), '-Width', String(Math.round(rect.width)), '-Height', String(Math.round(rect.height)), '-Path', path])
}
