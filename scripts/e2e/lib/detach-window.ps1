# Takes the Canvie window out of Progman, leaving it alive with no desktop
# parent, the state of a Wall that started before Explorer. Only the Canvie
# window of the given process is touched.
param([Parameter(Mandatory = $true)][int]$ProcessId)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class CanvieDetach {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lparam);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc proc, IntPtr lparam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string cls, string name);
  [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetParent(IntPtr child, IntPtr parent);

  public static bool Detach(uint pid) {
    IntPtr found = IntPtr.Zero;
    EnumChildWindows(FindWindow("Progman", null), (hwnd, _) => {
      uint owner;
      GetWindowThreadProcessId(hwnd, out owner);
      var name = new StringBuilder(64);
      GetClassName(hwnd, name, name.Capacity);
      if (owner == pid && name.ToString() == "Tauri Window") found = hwnd;
      return true;
    }, IntPtr.Zero);
    return found != IntPtr.Zero && SetParent(found, IntPtr.Zero) != IntPtr.Zero;
  }
}
"@

if (-not [CanvieDetach]::Detach([uint32]$ProcessId)) {
  Write-Error "No Canvie window of process $ProcessId was found in Progman"
  exit 1
}
