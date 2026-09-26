param(
  [string]$ConfigPath = "$PSScriptRoot\config.json"
)

$ErrorActionPreference = 'Stop'
$AgentVersion = '1.2.0'
$ScraperUrl = 'http://127.0.0.1:8080'
$ScraperStartAttemptedAt = $null

if (-not (Test-Path $ConfigPath)) {
  throw "Missing config file: $ConfigPath"
}

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$MetaBspUrl = ([string]$config.metaBspUrl).TrimEnd('/')
$AgentToken = [string]$config.agentToken
$ScraperExe = [string]$config.scraperExe
$ScraperDataDir = [string]$config.scraperDataDir
if (-not $MetaBspUrl -or -not $AgentToken) {
  throw 'config.json must contain metaBspUrl and agentToken'
}
if (-not $ScraperExe) { $ScraperExe = Join-Path $PSScriptRoot 'google-maps-scraper.exe' }
if (-not $ScraperDataDir) { $ScraperDataDir = Join-Path $PSScriptRoot 'data' }

$AgentHeaders = @{ Authorization = "Bearer $AgentToken" }

function Invoke-AgentApi {
  param([string]$Path, [hashtable]$Body)
  return Invoke-RestMethod -Uri "$MetaBspUrl$Path" -Method Post -Headers $AgentHeaders -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 60
}

function Send-AgentHeartbeat {
  try {
    Invoke-AgentApi -Path '/api/lead-finder/agent/progress' -Body @{
      hostname = $env:COMPUTERNAME
      version = $AgentVersion
    } | Out-Null
  } catch {
    Write-Host "Heartbeat error: $($_.Exception.Message)"
  }
}

function Report-Progress {
  param([string]$JobId, [int]$Percent, [string]$Stage)
  try {
    Invoke-AgentApi -Path '/api/lead-finder/agent/progress' -Body @{
      hostname = $env:COMPUTERNAME
      version = $AgentVersion
      jobId = $JobId
      progress = $Percent
      stage = $Stage
    } | Out-Null
  } catch {
    Write-Host "Progress update error: $($_.Exception.Message)"
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
  if (Test-Scraper) { return $true }
  if (-not (Test-Path $ScraperExe)) {
    Write-Host "Missing Google Maps scraper executable: $ScraperExe"
    return $false
  }

  $now = Get-Date
  if ($script:ScraperStartAttemptedAt -and (($now - $script:ScraperStartAttemptedAt).TotalSeconds -lt 90)) {
    return $false
  }

  try {
    New-Item -ItemType Directory -Path $ScraperDataDir -Force | Out-Null
    $script:ScraperStartAttemptedAt = $now
    Start-Process -FilePath $ScraperExe -ArgumentList @('-web', '-addr', '127.0.0.1:8080', '-data-folder', $ScraperDataDir) -WindowStyle Hidden
    Write-Host 'Starting native Google Maps scraper...'
  } catch {
    Write-Host "Could not start native scraper: $($_.Exception.Message)"
    return $false
  }

  for ($i = 0; $i -lt 24; $i++) {
    Start-Sleep -Seconds 5
    if (($i % 2) -eq 0) { Send-AgentHeartbeat }
    if (Test-Scraper) { return $true }
  }
  return $false
}

function Get-Coordinates {
  param([string]$Location)
  $encoded = [uri]::EscapeDataString($Location)
  $headers = @{ 'User-Agent' = 'MetaBSP-LeadFinder-Agent/1.2' }
  $rows = Invoke-RestMethod -Uri "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=$encoded" -Headers $headers -TimeoutSec 30
  if (-not $rows -or -not $rows[0].lat -or -not $rows[0].lon) {
    throw "Could not find coordinates for $Location"
  }
  return @{ lat = [string]$rows[0].lat; lon = [string]$rows[0].lon }
}

function Invoke-LocalScrape {
  param($Job)
  $jobId = [string]$Job.id
  Report-Progress -JobId $jobId -Percent 15 -Stage 'Finding location coordinates'
  $coords = Get-Coordinates -Location ([string]$Job.location)

  Report-Progress -JobId $jobId -Percent 25 -Stage 'Starting Google Maps search'
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

  Report-Progress -JobId $jobId -Percent 30 -Stage 'Searching Google Maps'
  $status = ''
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 8
    $poll = Invoke-RestMethod -Uri "$ScraperUrl/api/v1/jobs/$($created.id)" -Method Get -TimeoutSec 30
    if ($poll.Status) { $status = ([string]$poll.Status).ToLower() }
    elseif ($poll.status) { $status = ([string]$poll.status).ToLower() }

    if (($i % 2) -eq 0) {
      $percent = [Math]::Min(80, 30 + [Math]::Floor((($i + 1) / 90.0) * 50))
      Report-Progress -JobId $jobId -Percent $percent -Stage 'Searching Google Maps'
    }

    if ($status -eq 'ok') { break }
    if ($status -eq 'failed') { throw 'Google Maps scraper job failed' }
  }
  if ($status -ne 'ok') { throw 'Google Maps scraper timed out' }

  Report-Progress -JobId $jobId -Percent 85 -Stage 'Downloading search results'
  $response = Invoke-WebRequest -Uri "$ScraperUrl/api/v1/jobs/$($created.id)/download" -Method Get -UseBasicParsing -TimeoutSec 60
  Report-Progress -JobId $jobId -Percent 95 -Stage 'Processing leads'
  return [string]$response.Content
}

Write-Host 'MetaBSP Lead Finder agent started.'
while ($true) {
  try {
    Send-AgentHeartbeat

    if (-not (Ensure-Scraper)) {
      Write-Host 'Waiting for native Google Maps scraper...'
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
