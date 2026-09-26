param(
  [Parameter(Mandatory = $true)][string]$AgentToken,
  [string]$MetaBspUrl = 'https://metabsp.onrender.com'
)

$ErrorActionPreference = 'Stop'
$InstallDir = Join-Path $env:ProgramData 'MetaBSPLeadFinder'
$RawBase = 'https://raw.githubusercontent.com/mesanjusk/Metabsp/main/tools/lead-finder-local'
$TaskName = 'MetaBSP Lead Finder Agent'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run PowerShell as Administrator, then run this installer again.'
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host 'Docker Desktop is required. Installing with winget...'
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'Docker Desktop is not installed and winget is unavailable. Install Docker Desktop manually, then run this installer again.'
  }
  winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
}

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Invoke-WebRequest "$RawBase/docker-compose.yml" -UseBasicParsing -OutFile (Join-Path $InstallDir 'docker-compose.yml')
Invoke-WebRequest "$RawBase/lead-finder-agent.ps1" -UseBasicParsing -OutFile (Join-Path $InstallDir 'lead-finder-agent.ps1')

$config = @{
  metaBspUrl = $MetaBspUrl.TrimEnd('/')
  agentToken = $AgentToken
} | ConvertTo-Json
Set-Content -Path (Join-Path $InstallDir 'config.json') -Value $config -Encoding UTF8

$dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
try { docker info | Out-Null } catch {
  if (Test-Path $dockerDesktop) {
    Start-Process $dockerDesktop
    Write-Host 'Starting Docker Desktop...'
  }
}

$dockerReady = $false
for ($i = 0; $i -lt 36; $i++) {
  try { docker info | Out-Null; $dockerReady = $true; break } catch { Start-Sleep -Seconds 5 }
}
if (-not $dockerReady) {
  throw 'Docker Desktop did not become ready. Open Docker Desktop once, finish its first-run setup, then rerun this installer.'
}

docker compose -f (Join-Path $InstallDir 'docker-compose.yml') up -d
$healthy = $false
for ($i = 0; $i -lt 18; $i++) {
  try {
    Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/jobs' -TimeoutSec 5 | Out-Null
    $healthy = $true
    break
  } catch { Start-Sleep -Seconds 5 }
}
if (-not $healthy) { throw 'Google Maps scraper did not become healthy on localhost:8080.' }

$agentPath = Join-Path $InstallDir 'lead-finder-agent.ps1'
$configPath = Join-Path $InstallDir 'config.json'
$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agentPath`" -ConfigPath `"$configPath`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Description 'Runs the MetaBSP Google Maps Lead Finder on this PC.' -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host ''
Write-Host 'MetaBSP Lead Finder local agent installed successfully.'
Write-Host 'Scraper: http://127.0.0.1:8080 (localhost only)'
Write-Host "Startup task: $TaskName"
Write-Host 'Open MetaBSP > Business Lead Finder. Office PC should show Online within about 30 seconds.'
