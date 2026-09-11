Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Kb {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

$exe = "C:\Users\joaop\AppData\Local\canvie-target\debug\canvie.exe"
$logOut = "C:\Users\joaop\AppData\Local\Temp\opencode\e2e-out.log"
$logErr = "C:\Users\joaop\AppData\Local\Temp\opencode\e2e-err.log"
Remove-Item $logOut, $logErr -ErrorAction SilentlyContinue
Get-Process canvie -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

$p = Start-Process -FilePath $exe -PassThru -RedirectStandardOutput $logOut -RedirectStandardError $logErr
Write-Output "started pid $($p.Id)"
Start-Sleep -Seconds 8

$wshell = New-Object -ComObject WScript.Shell

# 1. Ctrl+L -> locked
$wshell.SendKeys("^l")
Start-Sleep -Seconds 2
# 2. Ctrl+L -> canvas
$wshell.SendKeys("^l")
Start-Sleep -Seconds 2

# 3. Ctrl+Alt+T -> overlay (MVP-0 substitute for Win+T, reserved by Explorer)
$wshell.SendKeys("^%t")
Start-Sleep -Seconds 3

# 4. Focus Canvie window, Esc -> back to canvas (frontend invoke path)
$proc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
if ($proc -and $proc.MainWindowHandle -ne 0) {
  [Kb]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
  Start-Sleep -Seconds 1
  $wshell.SendKeys("{ESC}")
  Start-Sleep -Seconds 2
} else {
  Write-Output "WARN: no main window handle for Esc test"
}

Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Output "--- relevant log lines ---"
Select-String -Path $logOut -Pattern "hotkey|canvie mode" | Select-Object -ExpandProperty Line
