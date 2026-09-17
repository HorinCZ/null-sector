param([switch]$NoOpen, [int]$PreferredPort = 4173)
$ErrorActionPreference = 'Stop'
$gameRoot = $PSScriptRoot
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) {
    if ($NoOpen) { throw 'Node.js was not found. Open index.html directly in Chrome or Edge.' }
    Start-Process -FilePath (Join-Path $gameRoot 'index.html')
    exit 0
}
$gameUrl = $null
for ($gamePort = $PreferredPort; $gamePort -lt $PreferredPort + 10; $gamePort++) {
    $candidateUrl = "http://127.0.0.1:$gamePort"
    try {
        $health = Invoke-RestMethod -Uri "$candidateUrl/health" -TimeoutSec 1
        if ($health.game -eq 'null-sector') { $gameUrl = $candidateUrl; break }
        continue
    } catch {}
    $env:PORT = [string]$gamePort
    $serverScript = Join-Path $gameRoot 'server.cjs'
    $serverProcess = Start-Process -FilePath $nodePath -ArgumentList @('"' + $serverScript + '"') -WorkingDirectory $gameRoot -WindowStyle Hidden -PassThru
    for ($attempt = 0; $attempt -lt 12; $attempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $health = Invoke-RestMethod -Uri "$candidateUrl/health" -TimeoutSec 1
            if ($health.game -eq 'null-sector') { $gameUrl = $candidateUrl; break }
        } catch {}
        if ($serverProcess.HasExited) { break }
    }
    if ($gameUrl) { break }
}
if (-not $gameUrl) { throw 'The local server could not start. Open index.html directly in Chrome or Edge.' }
Write-Output "NULL SECTOR: $gameUrl"
if (-not $NoOpen) { Start-Process -FilePath $gameUrl }
