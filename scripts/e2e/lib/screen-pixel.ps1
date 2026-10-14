# Prints the screen color at physical pixels as JSON: [[r, g, b], ...].
# -Points: "x,y;x,y".
param([Parameter(Mandatory = $true)][string]$Points)

Add-Type -AssemblyName System.Drawing
Add-Type -Namespace CanviePixel -Name Dpi -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
[void][CanviePixel.Dpi]::SetProcessDPIAware()

$bitmap = New-Object System.Drawing.Bitmap(1, 1)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  # A list, because PowerShell flattens a pipeline that yields one array.
  $colors = New-Object System.Collections.Generic.List[object]
  foreach ($pair in $Points.Split(';')) {
    $x, $y = $pair.Split(',') | ForEach-Object { [int]$_ }
    $graphics.CopyFromScreen($x, $y, 0, 0, $bitmap.Size)
    $pixel = $bitmap.GetPixel(0, 0)
    $colors.Add(@($pixel.R, $pixel.G, $pixel.B))
  }
  ConvertTo-Json -InputObject $colors.ToArray() -Compress
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
