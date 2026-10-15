# L7 install check: installs the release NSIS bundle for the current user,
# opens Canvie from its Start menu shortcut, uninstalls it, checks that the
# canvas data survives, and installs it again so the other suites can run on
# the installed build. The shortcut launch uses the real profile and only
# opens and closes the app, so nothing is written to it.
# Run from frontend after `npm run tauri build`:
#   powershell -ExecutionPolicy Bypass -File ..\scripts\e2e\l7-install.ps1
param(
  [string]$Installer = '',
  [string]$Evidence = ''
)

$bundle = Join-Path $env:LOCALAPPDATA 'canvie-target\release\bundle\nsis'
if (-not $Installer) {
  $Installer = Get-ChildItem $bundle -Filter 'Canvie_*_x64-setup.exe' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $Installer -or -not (Test-Path -LiteralPath $Installer)) {
  Write-Error "NSIS installer not found under $bundle. Run npm run tauri build first."
  exit 2
}
if (Get-Process -Name canvie -ErrorAction SilentlyContinue) {
  Write-Error 'Canvie is running. Quit it first.'
  exit 2
}

$results = New-Object System.Collections.Generic.List[object]
$measurements = [ordered]@{ installer = (Split-Path $Installer -Leaf); installerBytes = (Get-Item $Installer).Length }
function Check([string]$Name, [bool]$Pass, [string]$Detail = '') {
  $results.Add([ordered]@{ name = $Name; pass = $Pass; detail = $Detail })
  $line = if ($Pass) { 'PASS' } else { 'FAIL' }
  if ($Detail) { Write-Output "$line  $Name ($Detail)" } else { Write-Output "$line  $Name" }
}
function Wait-Until([scriptblock]$Condition, [int]$TimeoutMs) {
  $watch = [Diagnostics.Stopwatch]::StartNew()
  while ($watch.ElapsedMilliseconds -lt $TimeoutMs) {
    if (& $Condition) { return $true }
    Start-Sleep -Milliseconds 200
  }
  return $false
}
function Get-Install {
  Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
    Get-ItemProperty | Where-Object { $_.DisplayName -eq 'Canvie' } | Select-Object -First 1
}
function Get-Shortcut {
  Get-ChildItem (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs') -Recurse -Filter 'Canvie*.lnk' -ErrorAction SilentlyContinue | Select-Object -First 1
}
function Get-InstalledExe($entry) {
  if (-not $entry) { return $null }
  Get-ChildItem $entry.InstallLocation.Trim('"') -Filter '*.exe' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike 'uninstall*' } | Select-Object -First 1 -ExpandProperty FullName
}
function Install([string]$Label) {
  $watch = [Diagnostics.Stopwatch]::StartNew()
  $process = Start-Process -FilePath $Installer -ArgumentList '/S' -PassThru -Wait
  $measurements["$Label ms"] = $watch.ElapsedMilliseconds
  return $process.ExitCode
}

$appData = Join-Path $env:APPDATA 'com.canvie.app'
$hadData = Test-Path $appData
if (Get-Install) { $measurements.previousInstall = 'an installed Canvie was found; the installer upgrades it' }

# Install for the current user, without elevation.
$code = Install 'install'
$entry = Get-Install
$exe = Get-InstalledExe $entry
Check 'the silent installer exits with code 0' ($code -eq 0) "exit code $code"
Check 'the install is registered for the current user only (HKCU)' ($null -ne $entry) "$($entry.DisplayName) $($entry.DisplayVersion)"
Check 'the installed executable exists under %LOCALAPPDATA%' ($exe -and $exe.StartsWith($env:LOCALAPPDATA, [StringComparison]::OrdinalIgnoreCase)) $exe
$shortcut = Get-Shortcut
$target = if ($shortcut) { (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut.FullName).TargetPath } else { '' }
Check 'the Start menu shortcut points to the installed executable' ($shortcut -and $target -eq $exe) $target
$measurements.installLocation = if ($entry) { $entry.InstallLocation } else { '' }

# Open from the Start menu shortcut, like a user would.
$log = Join-Path $env:LOCALAPPDATA 'com.canvie.app\logs\Canvie.log'
$logBefore = if (Test-Path $log) { (Get-Content $log -Raw).Length } else { 0 }
if ($shortcut) { Start-Process -FilePath $shortcut.FullName }
$started = Wait-Until { Get-Process -Name canvie -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe } } 15000
# Setup ends with the shortcut line. A WM_CLOSE sent while setup still embeds
# the window destroys it, and the watchdog restarts Canvie (OPERATIONS.md).
$logged = Wait-Until { (Test-Path $log) -and ((Get-Content $log -Raw).Length -lt $logBefore -or (Get-Content $log -Raw).Substring($logBefore) -match 'Canvie startup[\s\S]*shortcut') } 15000
Start-Sleep -Milliseconds 500
Check 'the shortcut opens the installed Canvie, which logs its startup' ($started -and $logged)
$running = Get-Process -Name canvie -ErrorAction SilentlyContinue
foreach ($process in $running) {
  & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'lib\close-window.ps1') -ProcessId $process.Id 2>$null | Out-Null
  if (-not $process.WaitForExit(10000)) { Stop-Process -Id $process.Id -Force }
}
Check 'the shortcut launch ends cleanly' (-not (Get-Process -Name canvie -ErrorAction SilentlyContinue))

# Uninstall. The NSIS uninstaller copies itself to a temporary folder and returns at once.
$uninstall = if ($entry) { $entry.UninstallString.Trim('"') } else { '' }
if ($uninstall) { Start-Process -FilePath $uninstall -ArgumentList '/S' -Wait }
$removed = Wait-Until { -not (Test-Path -LiteralPath $exe) -and -not (Get-Install) } 30000
Check 'the silent uninstaller removes the executable and the registration' $removed
Check 'the uninstaller removes the Start menu shortcut' (-not (Get-Shortcut))
Check 'the canvas data in %APPDATA%\com.canvie.app survives the uninstall' ((-not $hadData) -or (Test-Path (Join-Path $appData 'EBWebView'))) $appData

# Install again so the other suites run on the installed build.
$code = Install 'reinstall'
$exe = Get-InstalledExe (Get-Install)
Check 'a second install works after the uninstall' ($code -eq 0 -and $exe -and (Test-Path -LiteralPath $exe)) $exe
$measurements.installedExe = $exe

$failed = @($results | Where-Object { -not $_.pass }).Count
if ($Evidence) {
  New-Item -ItemType Directory -Force -Path $Evidence | Out-Null
  [ordered]@{ results = $results; measurements = $measurements } | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $Evidence 'report.json') -Encoding utf8
}
Write-Output ("INFO  installed executable: {0}" -f $exe)
Write-Output ("{0}/{1} checks passed." -f ($results.Count - $failed), $results.Count)
if ($failed -eq 0) { exit 0 } else { exit 1 }
