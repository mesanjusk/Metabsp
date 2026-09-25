param(
  [string]$ConfigPath = "$PSScriptRoot\config.json"
)

$ErrorActionPreference = 'Stop'
$AgentVersion = '1.0.0'
$ScraperUrl = 'http://127.0.0.1:8080'
$ComposeFile = Join-Path $PSScriptRoot 'docker-compose.yml'
$DockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

if (-not (Test-Path $ConfigPath)) {
  throw "Missing config file: $ConfigPath"
}

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$MetaBspUrl = ([string]$config.metaBspUrl).TrimEnd('/')
$AgentToken = [string]$config.agentToken
if (-not $MetaBspUrl -or -not $AgentToken) {
  throw 'config.json must contain metaBspUrl and agentToken'
}

$AgentHeaders = @{ Authorization = "Bearer $AgentToken" }
$DockerStartAttempted = $false

function Invoke-AgentApi {
  param([string]$Path, [hashtable]$Body)
  return Invoke-RestMethod -Uri "$MetaBspUrl$Path" -Method Post -Headers $AgentHeaders -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 60
}

function Ensure-Docker {
  try {
    docker info | Out-Null
    return $true
  } catch {
    if (-not $script:DockerStartAttempted -and (Test-Path $DockerDesktop)) {
      $script:DockerStartAttempted = $true
      Start-Process $DockerDesktop
      Write-Host 'Starting Docker Desktop...'
    }
    return $false
  }
}

function Test-Scraper {
  try {
    Invoke-RestMethod -Uri "$ScraperUrl/api/v1/jobs" -Method Get -TimeoutSec 5 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Ensure-Scraper {
  if (-not (Ensure-Docker)) { return $false }
  if (Test-Scraper) { return $true }
  try {
    & docker compose -f $ComposeFile up -d | Out-Null
  } catch {
    Write-Host "Docker is not ready: $($_.Exception.Message)"
    return $false
  }
  for ($i = 0; $i -lt 12; $i++) {
    Start-Sleep -Seconds 5
    if (Test-Scraper) { return $true }
  }
  return $false
}

function Get-Coordinates {
  param([string]$Location)
  $encoded = [uri]::EscapeDataString($Location)
  $headers = @{ 'User-Agent' = 'MetaBSP-LeadFinder-Agent/1.0' }
  $rows = Invoke-RestMethod -Uri "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=$encoded" -Headers $headers -TimeoutSec 30
  if (-not $rows -or -not $rows[0].lat -or -not $rows[0].lon) {
    throw "Could not find coordinates for $Location"
  }
  return @{ lat = [string]$rows[0].lat; lon = [string]$rows[0].lon }
}

function Invoke-LocalScrape {
  param($Job)
  $coords = Get-Coordinates -Location ([string]$Job.location)
  $payload = @{
    name = "metabsp-$($Job.id)"
    keywords = @([string]$Job.query)
    lang = 'en'
    zoom = 15
    lat = $coords.lat
    lon = $coords.lon
    fast_mode = $false
    radius = 10000
    depth = [int]$Job.depth
    email = [bool]$Job.emailEnabled
    max_time = 600
  }
  $created = Invoke-RestMethod -Uri "$ScraperUrl/api/v1/jobs" -Method Post -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 5 -Compress) -TimeoutSec 60
  if (-not $created.id) { throw 'Local scraper did not return a job id' }

  $status = ''
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 8
    $poll = Invoke-RestMethod -Uri "$ScraperUrl/api/v1/jobs/$($created.id)" -Method Get -TimeoutSec 30
    if ($poll.Status) { $status = ([string]$poll.Status).ToLower() }
    elseif ($poll.status) { $status = ([string]$poll.status).ToLower() }
    if ($status -eq 'ok') { break }
    if ($status -eq 'failed') { throw 'Google Maps scraper job failed' }
  }
  if ($status -ne 'ok') { throw 'Google Maps scraper timed out' }

  $response = Invoke-WebRequest -Uri "$ScraperUrl/api/v1/jobs/$($created.id)/download" -Method Get -UseBasicParsing -TimeoutSec 60
  return [string]$response.Content
}

Write-Host 'MetaBSP Lead Finder agent started.'
while ($true) {
  try {
    if (-not (Ensure-Scraper)) {
      Write-Host 'Waiting for Docker/Google Maps scraper...'
      Start-Sleep -Seconds 20
      continue
    }

    $claim = Invoke-AgentApi -Path '/api/lead-finder/agent/claim' -Body @{
      hostname = $env:COMPUTERNAME
      version = $AgentVersion
    }
    $job = $claim.data
    if ($null -eq $job) {
      Start-Sleep -Seconds 10
      continue
    }

    Write-Host "Running lead search $($job.id): $($job.query)"
    try {
      $csv = Invoke-LocalScrape -Job $job
      Invoke-AgentApi -Path '/api/lead-finder/agent/complete' -Body @{
        jobId = [string]$job.id
        success = $true
        csv = $csv
      } | Out-Null
      Write-Host "Completed lead search $($job.id)"
    } catch {
      $errorText = $_.Exception.Message
      Write-Host "Lead search failed: $errorText"
      try {
        Invoke-AgentApi -Path '/api/lead-finder/agent/complete' -Body @{
          jobId = [string]$job.id
          success = $false
          error = $errorText
        } | Out-Null
      } catch {
        Write-Host "Could not report failure to MetaBSP: $($_.Exception.Message)"
      }
    }
  } catch {
    Write-Host "Agent connection error: $($_.Exception.Message)"
    Start-Sleep -Seconds 15
  }
}
