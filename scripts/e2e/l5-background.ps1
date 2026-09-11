Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Kb {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

$exe = "C:\Users\joaop\AppData\Local\canvie-target\debug\canvie.exe"
$logOut = "C:\Users\joaop\AppData\Local\Temp\opencode\l5-out.log"
$logErr = "C:\Users\joaop\AppData\Local\Temp\opencode\l5-err.log"
Remove-Item $logOut, $logErr -ErrorAction SilentlyContinue
Get-Process canvie -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

$p = Start-Process -FilePath $exe -PassThru -RedirectStandardOutput $logOut -RedirectStandardError $logErr
Write-Output "started pid $($p.Id)"
Start-Sleep -Seconds 10

# 1. autostart registry entry?
$run = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue
$auto = $run.PSObject.Properties | Where-Object { $_.Name -like "*anvie*" } | Select-Object Name, Value
if ($auto) { Write-Output "AUTOSTART KEY: $($auto.Name) = $($auto.Value)" } else { Write-Output "AUTOSTART KEY: missing" }

# 2. close main window -> must hide to tray, process stays alive
$proc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
if ($proc) { $proc.CloseMainWindow() | Out-Null }
Start-Sleep -Seconds 3
$still = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
if ($still) { Write-Output "CLOSE->HIDE OK: process alive pid $($still.Id)" } else { Write-Output "CLOSE->HIDE FAIL: process exited" }

# 3. second instance -> must exit fast, first instance shows window again
$p2 = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 6
$second = Get-Process -Id $p2.Id -ErrorAction SilentlyContinue
if ($second) { Write-Output "SINGLE-INSTANCE FAIL: second still alive"; Stop-Process -Id $p2.Id -Force } else { Write-Output "SINGLE-INSTANCE OK: second exited" }
$first = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
if ($first) {
  $hasWin = $first.MainWindowHandle -ne 0
  Write-Output "FIRST ALIVE pid $($first.Id) hasWindow=$hasWin title=[$($first.MainWindowTitle)]"
} else { Write-Output "FIRST DEAD (unexpected)" }

Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Output "--- relevant log lines ---"
Select-String -Path $logOut -Pattern "autostart|tray|second instance|hidden to tray|hotkey registered" | Select-Object -ExpandProperty Line
