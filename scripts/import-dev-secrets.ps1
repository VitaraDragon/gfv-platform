# import-dev-secrets.ps1 — Ripristina secret locali sul nuovo PC
#
# Uso (laptop):
#   .\scripts\import-dev-secrets.ps1 -BundlePath "$env:USERPROFILE\GFV-secrets-transfer\gfv-secrets_2026-06-07_1200"
#   .\scripts\import-dev-secrets.ps1 -BundlePath "D:\gfv-secrets_2026-06-07_1200.zip"

param(
    [Parameter(Mandatory = $true)]
    [string]$BundlePath
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path $PSScriptRoot -Parent

function Expand-IfZip([string]$Path) {
    if ($Path -match '\.zip$' -and (Test-Path $Path)) {
        $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("gfv-secrets-import_" + [guid]::NewGuid().ToString('n'))
        Expand-Archive -Path $Path -DestinationPath $temp -Force
        return $temp
    }
    if (Test-Path $Path) { return $Path }
    throw "Percorso non trovato: $Path"
}

Write-Host ''
Write-Host '=== GFV — import secret locali ===' -ForegroundColor Cyan

$root = Expand-IfZip $BundlePath
$filesDir = Join-Path $root 'files'
if (-not (Test-Path $filesDir)) {
    # ZIP potrebbe aver estratto direttamente sotto temp
    $candidate = Get-ChildItem -Path $root -Directory -Filter 'files' -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($candidate) { $filesDir = $candidate.FullName }
    else { throw "Cartella 'files' non trovata nel bundle. Usa export-dev-secrets.ps1 sul PC attuale." }
}

$imported = 0
Get-ChildItem -Path $filesDir -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($filesDir.Length).TrimStart('\', '/')
    $dest = Join-Path $RepoRoot ($rel -replace '/', '\')
    $destParent = Split-Path $dest -Parent
    if (-not (Test-Path $destParent)) { New-Item -ItemType Directory -Path $destParent -Force | Out-Null }

    if (Test-Path $dest) {
        $backup = "$dest.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $dest $backup -Force
        Write-Host "  [BACKUP] $rel -> $(Split-Path $backup -Leaf)" -ForegroundColor DarkYellow
    }

    Copy-Item $_.FullName $dest -Force
    Write-Host "  [OK]     $rel" -ForegroundColor Green
    $imported++
}

Write-Host ''
Write-Host "Importati $imported file in $RepoRoot" -ForegroundColor Cyan
Write-Host ''
Write-Host 'Verifica che Git li ignori:' -ForegroundColor White
Push-Location $RepoRoot
try {
    git check-ignore -v firebase-service-account.json functions/.env 2>$null
} finally {
    Pop-Location
}
Write-Host ''
Write-Host 'Poi (se serve): firebase login' -ForegroundColor White
Write-Host 'Emulator functions: cd functions && npm install (se non fatto)' -ForegroundColor White
