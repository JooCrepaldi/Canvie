# L6 E2E: the background lifecycle on the release build. It presses the real
# Alt + F4 and Ctrl + Alt + T, shows the canvas over your windows, and
# restarts the Windows shell twice, which closes open File Explorer windows.
# Run from frontend after `npm run tauri build`, with the computer idle:
#   powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l6-lifecycle.ps1
# -SkipExplorer runs everything except the two shell restarts.
param(
  [string]$Exe = (Join-Path $env:LOCALAPPDATA 'canvie-target\release\canvie.exe'),
  [int]$Port = 9333,
  [string]$Evidence = '',
  [switch]$SkipExplorer
)

if (-not (Test-Path -LiteralPath $Exe)) {
  Write-Error "Release build not found at $Exe. Run npm run tauri build first."
  exit 2
}
if (Get-Process -Name canvie -ErrorAction SilentlyContinue) {
  Write-Error 'Canvie is running. Quit it first so single-instance does not redirect the test launches.'
  exit 2
}

$driver = Join-Path $PSScriptRoot 'l6-lifecycle.mjs'
$arguments = @($driver, '--exe', $Exe, '--port', $Port)
if ($Evidence) { $arguments += @('--evidence', $Evidence) }
if ($SkipExplorer) { $arguments += '--skip-explorer' }
node @arguments
exit $LASTEXITCODE
