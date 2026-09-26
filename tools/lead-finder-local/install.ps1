param(
  [string]$SetupCode = '',
  [string]$AgentToken = '',
  [string]$MetaBspUrl = 'https://meta.sanjusk.in'
)

$ErrorActionPreference = 'Stop'
$InstallDir = Join-Path $env:ProgramData 'MetaBSPLeadFinder'
$DataDir = Join-Path $InstallDir 'data'
$RawBase = 'https://raw.githubusercontent.com/mesanjusk/Metabsp/main/tools/lead-finder-local'
$TaskName = 'MetaBSP Lead Finder Agent'
$ScraperVersion = '1.18.1'
$ScraperExe = Join-Path $InstallDir 'google-maps-scraper.exe'
$ScraperUrl = "https://github.com/gosom/google-maps-scraper/releases/download/v$ScraperVersion/google_maps_scraper-$ScraperVersion-windows-amd64.exe"
$ScraperSha256 = 'c124fab30f12e4aae25ef52f38eb2bea5422ece708b3171ca0f34be56cf7848f'
$MetaBspUrl = $MetaBspUrl.TrimEnd('/')

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run PowerShell as Administrator, then run this installer again.'
}

if (-not [Environment]::Is64BitOperatingSystem) {
  throw 'This Lead Finder installer currently requires 64-bit Windows.'
}

function New-LocalAgentToken {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-Sha256Hex {
  param([string]$Value)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hash = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))
    return -join ($hash | ForEach-Object { $_.ToString('x2') })
  } finally { $sha.Dispose() }
}

Write-Host 'Preparing MetaBSP Lead Finder local runtime...'
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

$downloadScraper = $true
if (Test-Path $ScraperExe) {
  try {
    $existingHash = (Get-FileHash -Algorithm SHA256 -Path $ScraperExe).Hash.ToLowerInvariant()
    if ($existingHash -eq $ScraperSha256) { $downloadScraper = $false }
  } catch {}
}

if ($downloadScraper) {
  Write-Host "Downloading Google Maps Scraper v$ScraperVersion for Windows..."
  $tempScraper = Join-Path $env:TEMP "google-maps-scraper-$ScraperVersion.exe"
  Invoke-WebRequest -UseBasicParsing $ScraperUrl -OutFile $tempScraper
  $actualHash = (Get-FileHash -Algorithm SHA256 -Path $tempScraper).Hash.ToLowerInvariant()
  if ($actualHash -ne $ScraperSha256) {
    Remove-Item $tempScraper -Force -ErrorAction SilentlyContinue
    throw 'Downloaded Google Maps scraper failed SHA-256 verification.'
  }
  Move-Item $tempScraper $ScraperExe -Force
  Unblock-File -Path $ScraperExe -ErrorAction SilentlyContinue
}

Write-Host 'Verifying native scraper executable...'
$verifyStdout = Join-Path $env:TEMP 'metabsp-leadfinder-scraper-help.out'
$verifyStderr = Join-Path $env:TEMP 'metabsp-leadfinder-scraper-help.err'
try {
  Remove-Item $verifyStdout, $verifyStderr -Force -ErrorAction SilentlyContinue
  $verifyProcess = Start-Process -FilePath $ScraperExe -ArgumentList '-h' -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $verifyStdout -RedirectStandardError $verifyStderr
  $helpOutput = ''
  if (Test-Path $verifyStdout) { $helpOutput += Get-Content -Raw -Path $verifyStdout -ErrorAction SilentlyContinue }
  if (Test-Path $verifyStderr) { $helpOutput += Get-Content -Raw -Path $verifyStderr -ErrorAction SilentlyContinue }
  if ($verifyProcess.ExitCode -ne 0 -and [string]::IsNullOrWhiteSpace($helpOutput)) {
    throw 'The native Google Maps scraper could not start on this Windows PC.'
  }
} finally {
  Remove-Item $verifyStdout, $verifyStderr -Force -ErrorAction SilentlyContinue
}

Invoke-WebRequest "$RawBase/lead-finder-agent.ps1" -UseBasicParsing -OutFile (Join-Path $InstallDir 'lead-finder-agent.ps1')

if (-not $AgentToken) {
  if (-not $SetupCode) {
    throw 'A SetupCode is required. Open MetaBSP > Business Lead Finder > Local PC Setup and copy the current install command.'
  }
  Write-Host 'Registering this PC with MetaBSP...'
  $AgentToken = New-LocalAgentToken
  $body = @{
    setupCode = $SetupCode
    authTokenHash = Get-Sha256Hex -Value $AgentToken
    hostname = $env:COMPUTERNAME
  } | ConvertTo-Json -Compress
  Invoke-RestMethod -Uri "$MetaBspUrl/api/lead-finder/agent/bootstrap" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 60 | Out-Null
}

$config = @{
  metaBspUrl = $MetaBspUrl
  agentToken = $AgentToken
  scraperExe = $ScraperExe
  scraperDataDir = $DataDir
} | ConvertTo-Json
Set-Content -Path (Join-Path $InstallDir 'config.json') -Value $config -Encoding UTF8

$agentPath = Join-Path $InstallDir 'lead-finder-agent.ps1'
$configPath = Join-Path $InstallDir 'config.json'
$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agentPath`" -ConfigPath `"$configPath`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Runs the MetaBSP Google Maps Lead Finder on this PC and automatically restarts if interrupted.' -RunLevel Highest -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host 'Starting native scraper and checking localhost API...'
$healthy = $false
for ($i = 0; $i -lt 36; $i++) {
  try {
    Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/jobs' -TimeoutSec 5 | Out-Null
    $healthy = $true
    break
  } catch { Start-Sleep -Seconds 5 }
}
if (-not $healthy) {
  Write-Host ''
  Write-Host 'The native scraper was installed, but its localhost API is not ready yet.' -ForegroundColor Yellow
  Write-Host 'The Windows task will keep retrying automatically.' -ForegroundColor Yellow
  throw 'Google Maps scraper did not become healthy on localhost:8080.'
}

Write-Host ''
Write-Host 'MetaBSP Lead Finder local agent installed successfully.' -ForegroundColor Green
Write-Host "Scraper: $ScraperExe"
Write-Host 'API: http://127.0.0.1:8080 (localhost only)'
Write-Host "Startup task: $TaskName"
Write-Host 'Docker and WSL are not required for this setup.' -ForegroundColor Green
Write-Host 'The agent will start automatically at Windows sign-in and automatically restart if interrupted.' -ForegroundColor Green
Write-Host 'Open MetaBSP > Business Lead Finder. Office PC should show Online within about 30 seconds.'
