# Wrapper Firebase CLI — ricarica PATH (Node + npm global) e invoca firebase.
# Uso: .\scripts\firebase.ps1 deploy --only hosting
#      .\scripts\firebase.ps1 --version

$ErrorActionPreference = 'Stop'

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

$repoRoot = Split-Path $PSScriptRoot -Parent
$localFirebase = Join-Path $repoRoot 'node_modules\.bin\firebase.cmd'

if (Test-Path $localFirebase) {
    & $localFirebase @args
    exit $LASTEXITCODE
}

$globalFirebase = Join-Path $env:APPDATA 'npm\firebase.cmd'
if (Test-Path $globalFirebase) {
    & $globalFirebase @args
    exit $LASTEXITCODE
}

Write-Host '[firebase.ps1] Firebase CLI non trovato.' -ForegroundColor Red
Write-Host '  npm install   (nella root del repo)' -ForegroundColor Yellow
Write-Host '  oppure: npm install -g firebase-tools' -ForegroundColor Yellow
exit 1
