# L7 E2E: keyboard, focus and resource use on the installed build. It sends
# real keys and shows the canvas over your windows for about 3 minutes.
# Run from frontend after l7-install.ps1 left Canvie installed:
#   powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l7-installed.ps1
param(
  [string]$Exe = (Join-Path $env:LOCALAPPDATA 'Canvie\canvie.exe'),
  [int]$Port = 9333,
  [string]$Evidence = ''
)

if (-not (Test-Path -LiteralPath $Exe)) {
  Write-Error "Installed Canvie not found at $Exe. Run l7-install.ps1 first."
  exit 2
}
if (Get-Process -Name canvie -ErrorAction SilentlyContinue) {
  Write-Error 'Canvie is running. Quit it first so single-instance does not redirect the test launches.'
  exit 2
}

$driver = Join-Path $PSScriptRoot 'l7-installed.mjs'
$arguments = @($driver, '--exe', $Exe, '--port', $Port)
if ($Evidence) { $arguments += @('--evidence', $Evidence) }
node @arguments
exit $LASTEXITCODE
