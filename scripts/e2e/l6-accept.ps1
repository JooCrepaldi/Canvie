Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

$exe = "$env:LOCALAPPDATA\Canvie\canvie.exe"
$GWL_EXSTYLE = -20
$WS_EX_TOPMOST = 0x8

# 1. launch + time to window (<5s)
Get-Process canvie -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
$sw = [Diagnostics.Stopwatch]::StartNew()
$p = Start-Process -FilePath $exe -PassThru
$win = $null
for ($i = 0; $i -lt 50 -and -not $win; $i++) {
  Start-Sleep -Milliseconds 100
  $c = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
  if ($c -and $c.MainWindowHandle -ne 0) { $win = $c }
}
$sw.Stop()
if ($win) { Write-Output "OPEN OK: window in $($sw.Elapsed.TotalSeconds.ToString('0.0'))s pid $($p.Id)" }
else { Write-Output "OPEN FAIL"; exit 1 }

# 2. idle sample
Start-Sleep -Seconds 5
$m = Get-Process -Id $p.Id
Write-Output ("IDLE: RAM {0}MB CPU {1}s" -f [math]::Round($m.WorkingSet64/1MB,1), $m.TotalProcessorTime.TotalSeconds)

$wshell = New-Object -ComObject WScript.Shell

# 3. overlay via hotkey -> must become TOPMOST
$wshell.SendKeys("^%t")
Start-Sleep -Seconds 3
$style = [Win]::GetWindowLong($win.MainWindowHandle, $GWL_EXSTYLE)
Write-Output ("OVERLAY TOPMOST: {0}" -f ((($style -band $WS_EX_TOPMOST) -ne 0)))

# 4. Esc -> back (topmost cleared)
[Win]::SetForegroundWindow($win.MainWindowHandle) | Out-Null
Start-Sleep -Seconds 1
$wshell.SendKeys("{ESC}")
Start-Sleep -Seconds 2
$style2 = [Win]::GetWindowLong($win.MainWindowHandle, $GWL_EXSTYLE)
Write-Output ("OVERLAY EXITED (topmost cleared): {0}" -f ((($style2 -band $WS_EX_TOPMOST) -eq 0)))

# 5. lock toggle twice, no crash
$wshell.SendKeys("^l"); Start-Sleep -Seconds 2
$wshell.SendKeys("^l"); Start-Sleep -Seconds 2
$alive = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
Write-Output ("LOCK TOGGLE NO-CRASH: {0}" -f ($null -ne $alive))

# 6. close -> tray (alive, installed build)
$alive.CloseMainWindow() | Out-Null
Start-Sleep -Seconds 3
$hid = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
Write-Output ("CLOSE->TRAY: {0}" -f ($null -ne $hid))

# 7. autostart points to installed path?
$run = (Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue).PSObject.Properties |
  Where-Object { $_.Name -like "*anvie*" } | Select-Object -ExpandProperty Value
Write-Output "AUTOSTART VALUE: $run"

Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Write-Output done
