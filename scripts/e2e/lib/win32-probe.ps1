# Reads the Canvie window state from Win32 and prints one JSON object.
# -ProcessId: canvie.exe PID. -X/-Y: physical screen point to hit-test.
# -ScanStep: grid step in physical pixels; lists the points of the canvas
# window's rectangle where a click lands on the desktop icon layer.
param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [int]$X = -1,
  [int]$Y = -1,
  [int]$ScanStep = 0
)

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class CanvieProbe {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lparam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr lparam);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc proc, IntPtr lparam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string name);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hwnd, uint cmd);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsChild(IntPtr parent, IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();

  public static string ClassOf(IntPtr hwnd) {
    var name = new StringBuilder(256);
    GetClassName(hwnd, name, name.Capacity);
    return name.ToString();
  }

  public static uint ProcessOf(IntPtr hwnd) {
    uint pid;
    GetWindowThreadProcessId(hwnd, out pid);
    return pid;
  }

  public static bool IsDesktopClass(string name) {
    return name == "SysListView32" || name == "SHELLDLL_DefView" || name == "WorkerW" || name == "Progman";
  }

  public static List<int[]> ExposedDesktop(RECT area, int step) {
    var points = new List<int[]>();
    for (int y = area.Top + step / 2; y < area.Bottom; y += step) {
      for (int x = area.Left + step / 2; x < area.Right; x += step) {
        var point = new POINT { X = x, Y = y };
        if (IsDesktopClass(ClassOf(WindowFromPoint(point)))) points.Add(new[] { x, y });
      }
    }
    return points;
  }

  // The canvas window is the largest visible tao window of the process,
  // either top-level or a child of Progman.
  public static IntPtr MainWindow(uint pid, IntPtr progman) {
    var candidates = new List<IntPtr>();
    EnumProc collect = (hwnd, _) => {
      if (ProcessOf(hwnd) == pid && IsWindowVisible(hwnd) && ClassOf(hwnd) == "Tauri Window") candidates.Add(hwnd);
      return true;
    };
    EnumWindows(collect, IntPtr.Zero);
    if (progman != IntPtr.Zero) EnumChildWindows(progman, collect, IntPtr.Zero);
    IntPtr best = IntPtr.Zero;
    long bestArea = -1;
    foreach (var hwnd in candidates) {
      RECT rect;
      GetWindowRect(hwnd, out rect);
      long area = (long)(rect.Right - rect.Left) * (rect.Bottom - rect.Top);
      if (area > bestArea) { best = hwnd; bestArea = area; }
    }
    return best;
  }
}
"@

# Physical pixels at any Windows scale.
[void][CanvieProbe]::SetProcessDPIAware()

$GA_PARENT = 1
$GW_CHILD = 5
$WS_CHILD = 0x40000000
$WS_EX_TOPMOST = 0x8
$WS_EX_TRANSPARENT = 0x20
$WS_EX_LAYERED = 0x80000

# PowerShell turns $null into an empty string for string parameters.
$progman = [CanvieProbe]::FindWindow('Progman', [NullString]::Value)
$main = [CanvieProbe]::MainWindow([uint32]$ProcessId, $progman)
$result = [ordered]@{ found = ($main -ne [IntPtr]::Zero) }
if ($result.found) {
  $style = [CanvieProbe]::GetWindowLongPtr($main, -16).ToInt64()
  $exStyle = [CanvieProbe]::GetWindowLongPtr($main, -20).ToInt64()
  $rect = New-Object CanvieProbe+RECT
  [void][CanvieProbe]::GetWindowRect($main, [ref]$rect)
  $result.parentIsProgman = ([CanvieProbe]::GetAncestor($main, $GA_PARENT) -eq $progman)
  $result.firstProgmanChild = ([CanvieProbe]::GetWindow($progman, $GW_CHILD) -eq $main)
  $result.child = (($style -band $WS_CHILD) -ne 0)
  $result.topmost = (($exStyle -band $WS_EX_TOPMOST) -ne 0)
  $result.transparent = (($exStyle -band $WS_EX_TRANSPARENT) -ne 0)
  $result.layered = (($exStyle -band $WS_EX_LAYERED) -ne 0)
  $result.visible = [CanvieProbe]::IsWindowVisible($main)
  $result.rect = [ordered]@{ left = $rect.Left; top = $rect.Top; right = $rect.Right; bottom = $rect.Bottom }
  $result.foreground = ([CanvieProbe]::ProcessOf([CanvieProbe]::GetForegroundWindow()) -eq $ProcessId)
  if ($ScanStep -gt 0) {
    $result.exposed = @([CanvieProbe]::ExposedDesktop($rect, $ScanStep) | ForEach-Object { , @($_[0], $_[1]) })
  }
}
if ($X -ge 0 -and $Y -ge 0) {
  $point = New-Object CanvieProbe+POINT
  $point.X = $X
  $point.Y = $Y
  $hit = [CanvieProbe]::WindowFromPoint($point)
  # The WebView2 render window belongs to msedgewebview2.exe, so ownership is
  # decided by the window tree, not by the process.
  $inCanvas = ($main -ne [IntPtr]::Zero) -and (($hit -eq $main) -or [CanvieProbe]::IsChild($main, $hit))
  $root = [CanvieProbe]::GetAncestor($hit, 2)
  $result.hit = [ordered]@{ class = [CanvieProbe]::ClassOf($hit); rootClass = [CanvieProbe]::ClassOf($root); ownedByCanvie = $inCanvas }
}

# Working set of canvie.exe and every process it started, in MB.
$all = Get-CimInstance Win32_Process
$tree = @($ProcessId)
do {
  $added = @($all | Where-Object { $tree -contains $_.ParentProcessId -and $tree -notcontains $_.ProcessId } | ForEach-Object { $_.ProcessId })
  $tree += $added
} while ($added.Count -gt 0)
$bytes = ($all | Where-Object { $tree -contains $_.ProcessId } | Measure-Object -Property WorkingSetSize -Sum).Sum
$cpu = (Get-Process -Id $tree -ErrorAction SilentlyContinue | Measure-Object -Property CPU -Sum).Sum
$result.processes = $tree.Count
$result.workingSetMB = [math]::Round($bytes / 1MB, 1)
$result.cpuSeconds = [math]::Round($cpu, 2)

$result | ConvertTo-Json -Compress -Depth 4
