param(
  [string]$MetaBspUrl = 'https://meta.sanjusk.in'
)

$ErrorActionPreference = 'Stop'
$InstallDir = Join-Path $env:ProgramData 'MetaBSPLeadFinder'
$TaskName = 'MetaBSP Lead Finder Agent'
$RawBase = 'https://raw.githubusercontent.com/mesanjusk/Metabsp/main/tools/lead-finder-local'
$ConfigPath = Join-Path $InstallDir 'config.json'
$AgentPath = Join-Path $InstallDir 'lead-finder-agent.ps1'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run PowerShell as Administrator, then run this repair command again.'
}

if (-not (Test-Path $ConfigPath)) {
  throw 'Lead Finder is not installed on this PC yet. Use the full Setup Guide first.'
}

Write-Host 'Updating MetaBSP Lead Finder agent...'
$tempAgent = Join-Path $env:TEMP 'metabsp-lead-finder-agent.ps1'
Invoke-WebRequest -UseBasicParsing "$RawBase/lead-finder-agent.ps1" -OutFile $tempAgent
Move-Item $tempAgent $AgentPath -Force

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
if (-not $config.metaBspUrl) { $config | Add-Member -NotePropertyName metaBspUrl -NotePropertyValue $MetaBspUrl -Force }
$config.metaBspUrl = ([string]$config.metaBspUrl).TrimEnd('/')
$config | ConvertTo-Json -Depth 6 | Set-Content -Path $ConfigPath -Encoding UTF8

$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$AgentPath`" -ConfigPath `"$ConfigPath`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -MultipleInstances IgnoreNew

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Runs the MetaBSP Google Maps Lead Finder on this PC and automatically restarts if interrupted.' -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host ''
Write-Host 'MetaBSP Lead Finder agent updated and restarted successfully.' -ForegroundColor Green
Write-Host 'It will start automatically at Windows sign-in and automatically restart if interrupted.' -ForegroundColor Green
Write-Host 'No PowerShell command is required for normal searches.' -ForegroundColor Green
