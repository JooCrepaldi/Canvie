# L2 E2E: persistent document on the release build.
# Run from frontend after `npm run tauri build`:
#   powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l2-persistence.ps1
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

$driver = Join-Path $PSScriptRoot 'l2-persistence.mjs'
if ($Evidence) {
  node $driver --exe $Exe --port $Port --evidence $Evidence
} else {
  node $driver --exe $Exe --port $Port
}
exit $LASTEXITCODE
