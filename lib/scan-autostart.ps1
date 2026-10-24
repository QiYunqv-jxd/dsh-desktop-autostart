param()

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$needle = 'deepseek harness'
$hits = New-Object System.Collections.ArrayList

function Add-Hit($list, $source, $name, $command) {
  if (-not $command) { return }
  $text = [string]$command
  if (-not $text.ToLower().Contains($needle)) { return }
  $null = $list.Add([ordered]@{ source = $source; name = [string]$name; command = $text })
}

$runKeys = @(
  @{ Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; Label = 'HKCU Run' },
  @{ Path = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run'; Label = 'HKLM Run' },
  @{ Path = 'HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Run'; Label = 'HKLM Run (32-bit)' }
)

foreach ($key in $runKeys) {
  if (-not (Test-Path -LiteralPath $key.Path)) { continue }
  try {
    $props = Get-ItemProperty -LiteralPath $key.Path
    foreach ($prop in $props.PSObject.Properties) {
      if ($prop.Name -like 'PS*') { continue }
      Add-Hit $hits $key.Label $prop.Name ([string]$prop.Value)
    }
  } catch {}
}

try {
  $tasks = Get-ScheduledTask -ErrorAction Stop
  foreach ($task in $tasks) {
    foreach ($action in $task.Actions) {
      $cmd = [string]$action.Execute
      if (-not $cmd) { continue }
      $full = ($cmd + ' ' + [string]$action.Arguments).Trim()
      Add-Hit $hits 'Scheduled task' $task.TaskName $full
    }
  }
} catch {}

if ($hits.Count -eq 0) {
  '[]'
} else {
  $items = $hits | ForEach-Object { ConvertTo-Json -InputObject $_ -Compress }
  '[' + ($items -join ',') + ']'
}
