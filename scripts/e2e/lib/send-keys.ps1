# Presses a key chord through the Windows input queue, like a keyboard.
# -Chord: names joined by '+', for example ctrl+alt+t, escape or e.
param([Parameter(Mandatory = $true)][string]$Chord)

Add-Type -Namespace CanvieInput -Name Keyboard -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);'

$KEYEVENTF_KEYUP = 0x2
$names = @{ ctrl = 0x11; alt = 0x12; shift = 0x10; escape = 0x1B; enter = 0x0D; f4 = 0x73; tab = 0x09 }
$codes = @(foreach ($name in $Chord.ToLower().Split('+')) {
  if ($names.ContainsKey($name)) { [byte]$names[$name] }
  elseif ($name.Length -eq 1) { [byte][char]$name.ToUpper() }
  else { throw "Unknown key: $name" }
})

foreach ($code in $codes) { [CanvieInput.Keyboard]::keybd_event($code, 0, 0, [UIntPtr]::Zero) }
Start-Sleep -Milliseconds 40
[array]::Reverse($codes)
foreach ($code in $codes) { [CanvieInput.Keyboard]::keybd_event($code, 0, $KEYEVENTF_KEYUP, [UIntPtr]::Zero) }
