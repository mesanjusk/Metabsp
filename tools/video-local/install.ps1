param(
  [Parameter(Mandatory=$true)][string]$ExtensionToken,
  [string]$MetaBspUrl = 'https://meta.sanjusk.in'
)

$ErrorActionPreference = 'Stop'
$MetaBspUrl = $MetaBspUrl.TrimEnd('/')
$InstallDir = Join-Path $env:LOCALAPPDATA 'MetaBSPVideoAgent\extension'
$SourceBase = 'https://raw.githubusercontent.com/mesanjusk/Videos-/176e465c27e9aab2182f3a91ea756f860fed2838/extension'

Write-Host 'Preparing MetaBSP Video local browser runner...'
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $InstallDir 'content') -Force | Out-Null

$files = @(
  @{ Remote = 'manifest.json'; Local = 'manifest.json' },
  @{ Remote = 'background.js'; Local = 'background.js' },
  @{ Remote = 'sidepanel.html'; Local = 'sidepanel.html' },
  @{ Remote = 'sidepanel.js'; Local = 'sidepanel.js' },
  @{ Remote = 'content/executor.js'; Local = 'content\executor.js' }
)

foreach ($file in $files) {
  $target = Join-Path $InstallDir $file.Local
  Invoke-WebRequest -UseBasicParsing "$SourceBase/$($file.Remote)" -OutFile $target
}

# Preconfigure this MetaBSP deployment and its worker token so the Chrome extension only needs to
# be loaded once. The token is stored on this Windows user profile, the same trust boundary Chrome
# uses for extension local storage.
$backgroundPath = Join-Path $InstallDir 'background.js'
$background = Get-Content -Raw $backgroundPath
$background = $background.Replace('apiBaseUrl: "http://localhost:3000"', "apiBaseUrl: `"$MetaBspUrl`"")
$background = $background.Replace('apiPrefix: "/api"', 'apiPrefix: "/api/video"')
$background = $background.Replace('extensionToken: ""', "extensionToken: `"$ExtensionToken`"")
$background = $background.Replace('enabled: false', 'enabled: true')
Set-Content -Path $backgroundPath -Value $background -Encoding UTF8

$sidepanelPath = Join-Path $InstallDir 'sidepanel.js'
$sidepanel = Get-Content -Raw $sidepanelPath
$sidepanel = $sidepanel.Replace('cfg.apiBaseUrl || "http://localhost:3000"', "cfg.apiBaseUrl || `"$MetaBspUrl`"")
$sidepanel = $sidepanel.Replace('cfg.apiPrefix || "/api"', 'cfg.apiPrefix || "/api/video"')
Set-Content -Path $sidepanelPath -Value $sidepanel -Encoding UTF8

$manifestPath = Join-Path $InstallDir 'manifest.json'
$manifest = Get-Content -Raw $manifestPath
$manifest = $manifest.Replace('"Videos Google Flow Runner"', '"MetaBSP Video Local Runner"')
$manifest = $manifest.Replace('"description": "Claims Videos browser tasks and executes them in Google Flow."', '"description": "Runs MetaBSP Video Studio Google Flow missions in this Chrome browser."')
Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8

Write-Host ''
Write-Host 'Video local runner files are ready.' -ForegroundColor Green
Write-Host "Extension folder: $InstallDir"
Write-Host ''
Write-Host 'ONE-TIME CHROME STEP:' -ForegroundColor Yellow
Write-Host '1. In Chrome open chrome://extensions'
Write-Host '2. Turn Developer mode ON'
Write-Host '3. Click Load unpacked'
Write-Host "4. Select: $InstallDir"
Write-Host '5. Click the MetaBSP Video Local Runner extension, open its side panel and press Save once.'
Write-Host '6. Keep Automatic task claiming enabled and stay signed in to Google Flow in this Chrome profile.'
Write-Host ''
Write-Host 'After that, normal Video Studio jobs need no PowerShell. Chrome remembers the extension.' -ForegroundColor Green

$chromeCandidates = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path $_) }
if ($chromeCandidates.Count -gt 0) {
  Start-Process $chromeCandidates[0] 'chrome://extensions/'
}
