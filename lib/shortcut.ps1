param(
  [Parameter(Mandatory = $true)][ValidateSet('create', 'read', 'remove')][string]$Action,
  [Parameter(Mandatory = $true)][string]$LnkPath,
  [string]$TargetPath = '',
  [string]$WorkingDirectory = '',
  [string]$Arguments = '',
  [string]$Description = ''
)

# Shortcut CRUD for the Startup folder. ASCII only: Windows PowerShell 5.1
# reads a BOM-less script as ANSI, so non-ASCII source would be mangled.
$ErrorActionPreference = 'Stop'

$shell = New-Object -ComObject WScript.Shell

if ($Action -eq 'remove') {
  if (Test-Path -LiteralPath $LnkPath) {
    Remove-Item -LiteralPath $LnkPath -Force
  }
  [ordered]@{ removed = (-not (Test-Path -LiteralPath $LnkPath)); exists = (Test-Path -LiteralPath $LnkPath) } | ConvertTo-Json -Compress
  exit 0
}

if ($Action -eq 'create') {
  if (-not $TargetPath) { throw 'TargetPath is required for create' }
  $parent = Split-Path -Parent $LnkPath
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  $shortcut = $shell.CreateShortcut($LnkPath)
  $shortcut.TargetPath = $TargetPath
  if ($WorkingDirectory) { $shortcut.WorkingDirectory = $WorkingDirectory }
  if ($Arguments) { $shortcut.Arguments = $Arguments }
  if ($Description) { $shortcut.Description = $Description }
  if (-not $shortcut.IconLocation) { $shortcut.IconLocation = "$TargetPath,0" }
  $shortcut.Save()
}

if (Test-Path -LiteralPath $LnkPath) {
  $shortcut = $shell.CreateShortcut($LnkPath)
  [ordered]@{
    exists           = $true
    target           = [string]$shortcut.TargetPath
    workingDirectory = [string]$shortcut.WorkingDirectory
    arguments        = [string]$shortcut.Arguments
    description      = [string]$shortcut.Description
  } | ConvertTo-Json -Compress
} else {
  '{"exists":false}'
}
