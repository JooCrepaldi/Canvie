# Samples one physical screen pixel as fast as GDI allows, from a given Unix
# time in ms and for a given duration, and writes "ms,r,g,b" lines to Path.
param(
  [Parameter(Mandatory = $true)][int]$X,
  [Parameter(Mandatory = $true)][int]$Y,
  [Parameter(Mandatory = $true)][long]$StartAtMs,
  [int]$DurationMs = 500,
  [Parameter(Mandatory = $true)][string]$Path
)

Add-Type -Namespace CanvieSeries -Name Gdi -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern System.IntPtr GetDC(System.IntPtr hwnd);
[DllImport("user32.dll")] public static extern int ReleaseDC(System.IntPtr hwnd, System.IntPtr dc);
[DllImport("gdi32.dll")] public static extern uint GetPixel(System.IntPtr dc, int x, int y);
'@
[void][CanvieSeries.Gdi]::SetProcessDPIAware()
while ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt $StartAtMs) { Start-Sleep -Milliseconds 1 }
$dc = [CanvieSeries.Gdi]::GetDC([IntPtr]::Zero)
$watch = [Diagnostics.Stopwatch]::StartNew()
$samples = New-Object System.Collections.Generic.List[string]
try {
  while ($watch.ElapsedMilliseconds -lt $DurationMs) {
    $color = [CanvieSeries.Gdi]::GetPixel($dc, $X, $Y)
    $samples.Add(('{0},{1},{2},{3}' -f $watch.ElapsedMilliseconds, ($color -band 0xFF), (($color -shr 8) -band 0xFF), (($color -shr 16) -band 0xFF)))
  }
} finally {
  [void][CanvieSeries.Gdi]::ReleaseDC([IntPtr]::Zero, $dc)
}
$samples | Set-Content -Path $Path
