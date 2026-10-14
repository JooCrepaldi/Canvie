# L8 E2E: the v2 document and the migration from v1, on the release build.
# The legacy build writes a real v1 document first; by default it is the
# Canvie installed by l7-install.ps1, which predates L8. It shows the canvas
# over your windows while it runs.
# Run from frontend after `npm run tauri build`:
#   powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l8-document-v2.ps1
param(
  [string]$Exe = (Join-Path $env:LOCALAPPDATA 'canvie-target\release\canvie.exe'),
  [string]$LegacyExe = (Join-Path $env:LOCALAPPDATA 'Canvie\canvie.exe'),
  [int]$Port = 9333,
  [string]$Evidence = ''
)

foreach ($path in @($Exe, $LegacyExe)) {
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Error "Executable not found at $path."
    exit 2
  }
}
if (Get-Process -Name canvie -ErrorAction SilentlyContinue) {
  Write-Error 'Canvie is running. Quit it first so single-instance does not redirect the test launches.'
  exit 2
}

$driver = Join-Path $PSScriptRoot 'l8-document-v2.mjs'
$arguments = @($driver, '--exe', $Exe, '--legacy-exe', $LegacyExe, '--port', $Port)
if ($Evidence) { $arguments += @('--evidence', $Evidence) }
node @arguments
exit $LASTEXITCODE
