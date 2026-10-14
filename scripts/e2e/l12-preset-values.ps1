# L12 E2E: fonts, sizes, the highlighter and the inks on the release build. It shows
# the canvas over your windows while it runs.
# Run from frontend after `npm run tauri build`:
#   powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l12-preset-values.ps1
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

$driver = Join-Path $PSScriptRoot 'l12-preset-values.mjs'
$arguments = @($driver, '--exe', $Exe, '--port', $Port)
if ($Evidence) { $arguments += @('--evidence', $Evidence) }
node @arguments
exit $LASTEXITCODE
