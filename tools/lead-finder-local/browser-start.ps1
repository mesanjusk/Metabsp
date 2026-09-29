param([string]$Uri = '')

$ErrorActionPreference = 'Stop'
# The registered browser shortcut only accepts this one fixed action.
# Never interpret URL parameters as commands or file paths.
if ($Uri.TrimEnd('/') -ne 'metabsp-leadfinder://start') {
  throw 'Unsupported MetaBSP Lead Finder shortcut.'
}

try {
  Start-ScheduledTask -TaskName 'MetaBSP Lead Finder Agent' -ErrorAction Stop
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show('Office PC agent start requested. Return to MetaBSP and allow about 30 seconds for the status to refresh.', 'MetaBSP Lead Finder') | Out-Null
} catch {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("Could not start the agent: $($_.Exception.Message)`nUse Setup Guide > Repair / Update on this PC.", 'MetaBSP Lead Finder') | Out-Null
  exit 1
}
