# Posts WM_CLOSE to the Canvie window of a process, like Alt + F4 or a close
# button. taskkill without /F picks a top-level window on its own, which can
# be one of tao's hidden helper windows.
param([Parameter(Mandatory = $true)][int]$ProcessId)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class CanvieClose {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lparam);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr lparam);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc proc, IntPtr lparam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string cls, string name);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wparam, IntPtr lparam);

  public static bool Close(uint pid) {
    IntPtr found = IntPtr.Zero;
    EnumProc match = (hwnd, _) => {
      uint owner;
      GetWindowThreadProcessId(hwnd, out owner);
      var name = new StringBuilder(64);
      GetClassName(hwnd, name, name.Capacity);
      if (owner == pid && name.ToString() == "Tauri Window") found = hwnd;
      return true;
    };
    EnumWindows(match, IntPtr.Zero);
    if (found == IntPtr.Zero) EnumChildWindows(FindWindow("Progman", null), match, IntPtr.Zero);
    return found != IntPtr.Zero && PostMessage(found, 0x0010, IntPtr.Zero, IntPtr.Zero);
  }
}
"@

if (-not [CanvieClose]::Close([uint32]$ProcessId)) {
  Write-Error "No Canvie window found for process $ProcessId"
  exit 1
}
