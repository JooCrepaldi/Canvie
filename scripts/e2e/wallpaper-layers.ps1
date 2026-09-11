Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WE {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cls, string t);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  public static string Cls(IntPtr h) {
    var sb = new StringBuilder(256);
    GetClassName(h, sb, 256);
    return sb.ToString();
  }
}
"@
$exe = "C:\Users\joaop\AppData\Local\canvie-target\release\canvie.exe"
Get-Process canvie -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item "$env:LOCALAPPDATA\com.canvie.app\logs\*" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$p = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 8
$targetPid = $p.Id
$wshell = New-Object -ComObject WScript.Shell

function Find-Tauri {
  $box = @{ h = [IntPtr]::Zero; top = $false }
  $cTop = {
    param($w, $l)
    if ([WE]::Cls($w) -eq "Tauri Window") {
      $pp = 0; [WE]::GetWindowThreadProcessId($w, [ref]$pp) | Out-Null
      if ($pp -eq $targetPid) { $box.h = $w; $box.top = $true; return $false }
    }
    return $true
  }.GetNewClosure()
  [WE]::EnumWindows($cTop, [IntPtr]::Zero) | Out-Null
  if ($box.h -ne [IntPtr]::Zero) { return $box }
  $prog = @{ h = [IntPtr]::Zero }
  $cP = { param($w, $l) if ([WE]::Cls($w) -eq "Progman") { $prog.h = $w; return $false }; return $true }.GetNewClosure()
  [WE]::EnumWindows($cP, [IntPtr]::Zero) | Out-Null
  $cC = {
    param($w, $l)
    if ([WE]::Cls($w) -eq "Tauri Window") {
      $pp = 0; [WE]::GetWindowThreadProcessId($w, [ref]$pp) | Out-Null
      if ($pp -eq $targetPid) { $box.h = $w; $box.top = $false; return $false }
    }
    return $true
  }.GetNewClosure()
  [WE]::EnumChildWindows($prog.h, $cC, [IntPtr]::Zero) | Out-Null
  return $box
}

function Sibling-Order([IntPtr]$h) {
  $prog = @{ h = [IntPtr]::Zero }
  $cP = { param($w, $l) if ([WE]::Cls($w) -eq "Progman") { $prog.h = $w; return $false }; return $true }.GetNewClosure()
  [WE]::EnumWindows($cP, [IntPtr]::Zero) | Out-Null
  $def = [WE]::FindWindowEx($prog.h, [IntPtr]::Zero, "SHELLDLL_DefView", $null)
  $kids = New-Object Collections.Generic.List[IntPtr]
  $kcb = { param($w, $l) $kids.Add($w); return $true }.GetNewClosure()
  [WE]::EnumChildWindows($prog.h, $kcb, [IntPtr]::Zero) | Out-Null
  $iDef = -1; $iUs = -1
  for ($i = 0; $i -lt $kids.Count; $i++) {
    if ($kids[$i] -eq $def) { $iDef = $i }
    if ($kids[$i] -eq $h) { $iUs = $i }
  }
  return "defIdx=$iDef canvasIdx=$iUs"
}

function Show-State([string]$tag) {
  $f = Find-Tauri
  if ($f.h -eq [IntPtr]::Zero) { Write-Output "$tag MISSING"; return $null }
  $par = [WE]::GetParent($f.h)
  $pcls = if ($par -ne [IntPtr]::Zero) { [WE]::Cls($par) } else { "(desktop-top)" }
  $extra = ""
  if ($pcls -eq "Progman") { $extra = " " + (Sibling-Order $f.h) }
  Write-Host "$tag parent=[$pcls]$extra"
  return $f.h
}

# v1: boot rests raised above the icon layer (defIdx vs canvasIdx proves
# order inside Progman). No raise/lower toggle anymore: cursor tool frees
# the desktop via click-through, Overlay detaches on top.
Show-State "BOOT   " | Out-Null
$wshell.SendKeys("^%t"); Start-Sleep -Seconds 3
$oh = Show-State "OVERLAY"
if ($oh) { [WE]::SetForegroundWindow($oh) | Out-Null; Start-Sleep -Seconds 1 }
$wshell.SendKeys("{ESC}"); Start-Sleep -Seconds 2
Show-State "BACK   " | Out-Null

Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Write-Output "--- log file ---"
Get-ChildItem "$env:LOCALAPPDATA\com.canvie.app\logs" -ErrorAction SilentlyContinue | Select-Object Name
$lf = Get-ChildItem "$env:LOCALAPPDATA\com.canvie.app\logs\*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1
if ($lf) { Select-String -Path $lf.FullName -Pattern "wallpaper embedded|canvie layer|canvie mode|hotkey registered|passthrough|show requested" | Select-Object -ExpandProperty Line }
