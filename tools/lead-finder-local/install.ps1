param(
  [string]$SetupCode = '',
  [string]$AgentToken = '',
  [string]$MetaBspUrl = 'https://meta.sanjusk.in'
)

$ErrorActionPreference = 'Stop'
$InstallDir = Join-Path $env:ProgramData 'MetaBSPLeadFinder'
$RawBase = 'https://raw.githubusercontent.com/mesanjusk/Metabsp/main/tools/lead-finder-local'
$TaskName = 'MetaBSP Lead Finder Agent'
$DockerInstallerUrl = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe'
$MetaBspUrl = $MetaBspUrl.TrimEnd('/')

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run PowerShell as Administrator, then run this installer again.'
}

Write-Host 'Checking Windows requirements...'
$os = Get-CimInstance Win32_OperatingSystem
$build = [int]$os.BuildNumber
if ($build -lt 19045) {
  throw "Docker Desktop requires Windows 10 22H2 build 19045 or newer. This PC is build $build. Run Windows Update first."
}
$ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ramGb -lt 8) {
  throw "Docker Desktop requires at least 8 GB RAM. This PC reports $ramGb GB."
}
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
if ($cpu.VirtualizationFirmwareEnabled -eq $false) {
  throw 'Hardware virtualization is disabled. Enable Intel VT-x/AMD-V (Virtualization Technology) in BIOS/UEFI, restart Windows, then run this installer again.'
}

Write-Host 'Checking WSL 2 prerequisites...'
$restartNeeded = $false
foreach ($featureName in @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')) {
  $feature = Get-WindowsOptionalFeature -Online -FeatureName $featureName
  if ($feature.State -ne 'Enabled') {
    Write-Host "Enabling Windows feature: $featureName"
    $result = Enable-WindowsOptionalFeature -Online -FeatureName $featureName -All -NoRestart
    if ($result.RestartNeeded) { $restartNeeded = $true }
  }
}
if ($restartNeeded) {
  Write-Host ''
  Write-Host 'WSL 2 prerequisites were enabled successfully.' -ForegroundColor Green
  Write-Host 'RESTART WINDOWS. After restart, open MetaBSP > Business Lead Finder > Local PC Setup, generate a fresh setup code, and run the installer again.' -ForegroundColor Yellow
  exit 3010
}

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw 'WSL is not available yet. Restart Windows first. If this continues after restart, run Windows Update and try again.'
}

Write-Host 'Updating WSL...'
& wsl.exe --update
if ($LASTEXITCODE -ne 0) {
  Write-Host 'WSL update returned a warning. Continuing; Docker Desktop will verify WSL during startup.' -ForegroundColor Yellow
}
& wsl.exe --set-default-version 2

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

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
$config = @{
  metaBspUrl = $MetaBspUrl
  agentToken = $AgentToken
} | ConvertTo-Json
Set-Content -Path (Join-Path $InstallDir 'config.json') -Value $config -Encoding UTF8

function Find-DockerCli {
  $command = Get-Command docker.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  foreach ($candidate in @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'),
    'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
  )) {
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

function Find-DockerDesktop {
  foreach ($candidate in @(
    (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'),
    'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  )) {
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

$DockerExe = Find-DockerCli
if (-not $DockerExe) {
  Write-Host 'Docker Desktop is not installed. Downloading the official installer...'
  $dockerInstaller = Join-Path $env:TEMP 'DockerDesktopInstaller.exe'
  Invoke-WebRequest -UseBasicParsing $DockerInstallerUrl -OutFile $dockerInstaller
  Write-Host 'Installing Docker Desktop with the WSL 2 backend...'
  $process = Start-Process $dockerInstaller -Wait -PassThru -ArgumentList @('install', '--user', '--backend=wsl-2', '--accept-license')
  if ($process.ExitCode -ne 0) {
    throw "Docker Desktop installer failed with exit code $($process.ExitCode). Verify Windows is fully updated and virtualization is enabled, then run this installer again."
  }
  $DockerExe = Find-DockerCli
  if (-not $DockerExe) {
    throw 'Docker Desktop finished installing but docker.exe was not found. Restart Windows once, then run this installer again.'
  }
}

Invoke-WebRequest "$RawBase/docker-compose.yml" -UseBasicParsing -OutFile (Join-Path $InstallDir 'docker-compose.yml')
Invoke-WebRequest "$RawBase/lead-finder-agent.ps1" -UseBasicParsing -OutFile (Join-Path $InstallDir 'lead-finder-agent.ps1')

$dockerDesktop = Find-DockerDesktop
try { & $DockerExe info | Out-Null } catch {
  if ($dockerDesktop) {
    Start-Process $dockerDesktop
    Write-Host 'Starting Docker Desktop...'
  }
}

$dockerReady = $false
for ($i = 0; $i -lt 48; $i++) {
  try { & $DockerExe info | Out-Null; $dockerReady = $true; break } catch { Start-Sleep -Seconds 5 }
}
if (-not $dockerReady) {
  throw 'Docker Desktop did not become ready. Open Docker Desktop once, accept any first-run agreement, make sure it shows Engine running, then run this installer again.'
}

& $DockerExe compose -f (Join-Path $InstallDir 'docker-compose.yml') up -d
if ($LASTEXITCODE -ne 0) { throw 'Could not start the Google Maps scraper container.' }

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
Write-Host 'MetaBSP Lead Finder local agent installed successfully.' -ForegroundColor Green
Write-Host 'Scraper: http://127.0.0.1:8080 (localhost only)'
Write-Host "Startup task: $TaskName"
Write-Host 'Open MetaBSP > Business Lead Finder. Office PC should show Online within about 30 seconds.'
