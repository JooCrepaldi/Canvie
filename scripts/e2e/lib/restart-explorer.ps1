# Restarts the Windows shell and prints one JSON object. It closes open
# File Explorer windows and flickers the taskbar, so the L6 suite asks first.
# -Mode crash: ends explorer.exe by force, like a crash; Windows restarts it.
# -Mode clean: asks the shell to exit, like Exit Explorer, then starts it.
# Either way the script makes sure the shell is running before it returns.
param([Parameter(Mandatory = $true)][ValidateSet('crash', 'clean')][string]$Mode)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Security.Principal;

public static class CanvieShell {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string name);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string name);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wparam, IntPtr lparam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("userenv.dll", SetLastError = true)] static extern bool CreateEnvironmentBlock(out IntPtr block, IntPtr token, bool inherit);
  [DllImport("userenv.dll")] static extern bool DestroyEnvironmentBlock(IntPtr block);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool CreateProcess(string application, string commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string directory, ref STARTUPINFO startup, out PROCESS_INFORMATION process);

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct STARTUPINFO {
    public int cb;
    public string reserved, desktop, title;
    public int x, y, width, height, xChars, yChars, fillAttribute, flags;
    public short showWindow, reserved2;
    public IntPtr reserved3, stdInput, stdOutput, stdError;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct PROCESS_INFORMATION {
    public IntPtr process, thread;
    public int processId, threadId;
  }

  public static uint ShellProcess() {
    IntPtr tray = FindWindow("Shell_TrayWnd", null);
    uint pid = 0;
    if (tray != IntPtr.Zero) GetWindowThreadProcessId(tray, out pid);
    return pid;
  }

  // The undocumented Exit Explorer command of the taskbar: the shell closes
  // its windows, Progman included, and the process exits normally.
  public static bool AskShellToExit() {
    IntPtr tray = FindWindow("Shell_TrayWnd", null);
    return tray != IntPtr.Zero && PostMessage(tray, 0x5B4, IntPtr.Zero, IntPtr.Zero);
  }

  public static bool DesktopReady() {
    IntPtr progman = FindWindow("Progman", null);
    return progman != IntPtr.Zero && FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero;
  }

  // A fresh environment for the user, as at sign-in, and no inherited
  // handles, so the new shell keeps neither the variables nor the output
  // pipe of the test process. An inherited pipe would hold the caller open.
  public static void StartShell() {
    IntPtr block;
    if (!CreateEnvironmentBlock(out block, WindowsIdentity.GetCurrent().Token, false)) throw new InvalidOperationException("CreateEnvironmentBlock failed");
    try {
      const uint CREATE_UNICODE_ENVIRONMENT = 0x400;
      var startup = new STARTUPINFO { cb = Marshal.SizeOf(typeof(STARTUPINFO)) };
      PROCESS_INFORMATION process;
      string explorer = Environment.ExpandEnvironmentVariables(@"%SystemRoot%\explorer.exe");
      if (!CreateProcess(explorer, null, IntPtr.Zero, IntPtr.Zero, false, CREATE_UNICODE_ENVIRONMENT, block, null, ref startup, out process)) {
        throw new InvalidOperationException("CreateProcess failed: " + Marshal.GetLastWin32Error());
      }
      CloseHandle(process.thread);
      CloseHandle(process.process);
    } finally {
      DestroyEnvironmentBlock(block);
    }
  }
}
"@

function Wait-Until([scriptblock]$Condition, [int]$TimeoutMs) {
  $watch = [Diagnostics.Stopwatch]::StartNew()
  while ($watch.ElapsedMilliseconds -lt $TimeoutMs) {
    if (& $Condition) { return $true }
    Start-Sleep -Milliseconds 100
  }
  return $false
}

$result = [ordered]@{ mode = $Mode; exited = $false; startedByScript = $false; desktopBackMs = -1 }
$shell = [CanvieShell]::ShellProcess()
$watch = [Diagnostics.Stopwatch]::StartNew()
try {
  if ($shell -eq 0) { throw 'No running shell (Shell_TrayWnd) was found' }
  if ($Mode -eq 'crash') {
    Stop-Process -Id $shell -Force
  } elseif (-not [CanvieShell]::AskShellToExit()) {
    throw 'The shell did not accept the exit message'
  }
  $result.exited = Wait-Until { -not (Get-Process -Id $shell -ErrorAction SilentlyContinue) } 15000
  $watch.Restart()
  # Windows restarts a shell that crashed. A shell that exited on request stays down.
  if ($Mode -eq 'crash') { [void](Wait-Until { [CanvieShell]::DesktopReady() } 15000) }
} finally {
  if (-not [CanvieShell]::DesktopReady() -and -not (Wait-Until { [CanvieShell]::ShellProcess() -ne 0 } 1000)) {
    [CanvieShell]::StartShell()
    $result.startedByScript = $true
  }
  if (Wait-Until { [CanvieShell]::DesktopReady() } 30000) { $result.desktopBackMs = $watch.ElapsedMilliseconds }
}
$result | ConvertTo-Json -Compress
