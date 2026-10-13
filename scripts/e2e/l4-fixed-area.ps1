# L4 E2E: the canvas area fixed on the desktop, on the release build.
# Run from frontend after `npm run tauri build`:
#   powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l4-fixed-area.ps1
# The run never moves your windows; the paint check uses a part of the
# desktop that no window covers, when there is one.
param(
  [string]$Exe = (Join-Path $env:LOCALAPPDATA 'canvie-target\release\canvie.exe'),
  [int]$Port = 9333,
  [string]$Evidence = ''
)

if (-not (Test-Path -LiteralPath $Exe)) {
  Write-Error "Release build not found at $Exe. Run npm run tauri build first."
  exit 2
}
if (Get-Process -Name canvie -ErrorAction SilentlyContinue) {
  Write-Error 'Canvie is running. Quit it first so single-instance does not redirect the test launches.'
  exit 2
}

$arguments = @((Join-Path $PSScriptRoot 'l4-fixed-area.mjs'), '--exe', $Exe, '--port', $Port)
if ($Evidence) { $arguments += @('--evidence', $Evidence) }
node @arguments
exit $LASTEXITCODE
