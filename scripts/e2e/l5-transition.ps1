# L5 E2E: the Fixo to Edicao transition on the release build. It presses the real
# Ctrl + Alt + T and shows the canvas over your windows while it runs.
# Run from frontend after `npm run tauri build`:
#   powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l5-transition.ps1
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

$driver = Join-Path $PSScriptRoot 'l5-transition.mjs'
if ($Evidence) {
  node $driver --exe $Exe --port $Port --evidence $Evidence
} else {
  node $driver --exe $Exe --port $Port
}
exit $LASTEXITCODE
