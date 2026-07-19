param(
  [ValidateSet('idle', 'working', 'attention', 'complete', 'error')]
  [string]$State = 'idle',
  [string]$Agent = 'generic'
)

$Agent = $Agent -replace '[^A-Za-z0-9._-]', ''
if ($Agent.Length -gt 32) { $Agent = $Agent.Substring(0, 32) }
if (-not $Agent) { $Agent = 'generic' }

$sequence = "$([char]27)]777;sterm;v=1;state=$State;agent=$Agent$([char]7)"
try {
  $stream = [System.IO.File]::OpenWrite('CONOUT$')
  $writer = [System.IO.StreamWriter]::new($stream)
  $writer.Write($sequence)
  $writer.Flush()
  $writer.Dispose()
} catch {
  [Console]::Error.Write($sequence)
}
