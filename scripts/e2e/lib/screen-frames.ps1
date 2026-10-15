# Captures a physical-pixel rectangle of the screen several times in a row
# and joins the frames side by side into one strip, scaled down.
param(
  [Parameter(Mandatory = $true)][int]$X,
  [Parameter(Mandatory = $true)][int]$Y,
  [Parameter(Mandatory = $true)][int]$Width,
  [Parameter(Mandatory = $true)][int]$Height,
  [Parameter(Mandatory = $true)][int]$Count,
  [Parameter(Mandatory = $true)][int]$IntervalMs,
  [Parameter(Mandatory = $true)][string]$Path,
  [double]$Scale = 0.5,
  # Unix time in ms to take the first frame at, so the capture lines up with
  # an action the caller starts at the same moment.
  [long]$StartAtMs = 0
)

Add-Type -AssemblyName System.Drawing
Add-Type -Namespace CanvieFrames -Name Dpi -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
[void][CanvieFrames.Dpi]::SetProcessDPIAware()

$frames = New-Object System.Collections.Generic.List[System.Drawing.Bitmap]
while ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt $StartAtMs) { Start-Sleep -Milliseconds 1 }
$watch = [Diagnostics.Stopwatch]::StartNew()
for ($index = 0; $index -lt $Count; $index++) {
  $due = $index * $IntervalMs
  while ($watch.ElapsedMilliseconds -lt $due) { Start-Sleep -Milliseconds 2 }
  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($X, $Y, 0, 0, $bitmap.Size)
  $graphics.Dispose()
  $frames.Add($bitmap)
}

$frameWidth = [int]($Width * $Scale)
$frameHeight = [int]($Height * $Scale)
$gap = 8
$strip = New-Object System.Drawing.Bitmap(($frameWidth * $Count + $gap * ($Count - 1)), $frameHeight)
$canvas = [System.Drawing.Graphics]::FromImage($strip)
$canvas.Clear([System.Drawing.Color]::FromArgb(255, 32, 33, 35))
$canvas.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
for ($index = 0; $index -lt $frames.Count; $index++) {
  $target = New-Object System.Drawing.Rectangle(($index * ($frameWidth + $gap)), 0, $frameWidth, $frameHeight)
  $canvas.DrawImage($frames[$index], $target)
  $frames[$index].Dispose()
}
$canvas.Dispose()
$strip.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
$strip.Dispose()
