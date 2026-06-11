# export-dev-secrets.ps1 — Esporta file sensibili LOCALI (MAI committare su Git!)
#
# Uso (PC attuale):
#   .\scripts\export-dev-secrets.ps1
#   .\scripts\export-dev-secrets.ps1 -OutputDir "D:\backup-gfv"
#
# Crea una cartella + ZIP FUORI dal repo. Trasferisci con USB / OneDrive personale /
# email a te stesso — NON con GitHub Desktop (rischio commit accidentale).

param(
    [string]$OutputDir = (Join-Path $env:USERPROFILE 'GFV-secrets-transfer')
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path $PSScriptRoot -Parent

# path nel repo -> path relativo nella cartella di export
$SecretFiles = @(
    @{ Repo = 'functions\.env';               Required = $false; Note = 'Emulator functions (RESEND, OpenWeather, …)' },
    @{ Repo = 'firebase-service-account.json'; Required = $true;  Note = 'Firebase Admin SDK' },
    @{ Repo = 'core\firebase-config.js';       Required = $true;  Note = 'Config Firebase client' },
    @{ Repo = 'core\google-maps-config.js';    Required = $false; Note = 'Google Maps API key' },
    @{ Repo = 'core\config\firebase-config.js';       Required = $false; Note = 'Config Firebase (alt path)' },
    @{ Repo = 'core\config\google-maps-config.js';    Required = $false; Note = 'Google Maps (alt path)' }
)

function Write-Warn([string]$Msg) {
    Write-Host $Msg -ForegroundColor Yellow
}

Write-Host ''
Write-Host '=== GFV — export secret locali ===' -ForegroundColor Cyan
Write-Warn 'NON copiare questa cartella nel repo e NON fare push su GitHub!'
Write-Warn 'Trasferisci solo via USB, cloud personale o zip protetto da password.'
Write-Host ''

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$bundleDir = Join-Path $OutputDir "gfv-secrets_$stamp"
$staging = Join-Path $bundleDir 'files'
New-Item -ItemType Directory -Path $staging -Force | Out-Null

$manifest = [ordered]@{
    exportedAt = (Get-Date).ToString('o')
    sourceMachine = $env:COMPUTERNAME
    repoRoot = $RepoRoot
    files = @()
    missingRequired = @()
}

$copied = 0
foreach ($item in $SecretFiles) {
    $src = Join-Path $RepoRoot ($item.Repo -replace '/', '\')
    $rel = $item.Repo -replace '\\', '/'
    if (Test-Path $src) {
        $dest = Join-Path $staging $rel
        $destParent = Split-Path $dest -Parent
        if (-not (Test-Path $destParent)) { New-Item -ItemType Directory -Path $destParent -Force | Out-Null }
        Copy-Item -Path $src -Destination $dest -Force
        $manifest.files += @{ path = $rel; status = 'copied'; note = $item.Note }
        Write-Host "  [OK]   $rel" -ForegroundColor Green
        $copied++
    } else {
        $manifest.files += @{ path = $rel; status = 'missing'; required = $item.Required; note = $item.Note }
        if ($item.Required) {
            $manifest.missingRequired += $rel
            Write-Host "  [MISS] $rel (richiesto)" -ForegroundColor Red
        } else {
            Write-Host "  [SKIP] $rel (opzionale, assente)" -ForegroundColor DarkGray
        }
    }
}

$readme = @"
GFV Platform — bundle secret locali
===================================

Generato: $($manifest.exportedAt)
Da PC:    $($manifest.sourceMachine)

CONTENUTO
---------
File di configurazione e credenziali per sviluppo locale.
NON committare su Git. NON caricare su repository pubblici.

TRASFERIMENTO SICURO
--------------------
- Chiavetta USB
- OneDrive / Google Drive (cartella PERSONALE, fuori da gfv-platform)
- Zip con password (7-Zip) inviato a te stesso

Sul laptop, dopo aver copiato la cartella o lo ZIP:
  cd percorso\gfv-platform
  .\scripts\import-dev-secrets.ps1 -BundlePath "PERCORSO\gfv-secrets_..."

Oppure con lo ZIP:
  .\scripts\import-dev-secrets.ps1 -BundlePath "PERCORSO\gfv-secrets_....zip"
"@

Set-Content -Path (Join-Path $bundleDir 'LEGGIMI.txt') -Value $readme -Encoding UTF8
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $bundleDir 'manifest.json') -Encoding UTF8

$zipPath = "$bundleDir.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $bundleDir '*') -DestinationPath $zipPath -Force

Write-Host ''
Write-Host "File copiati: $copied" -ForegroundColor Cyan
Write-Host "Cartella:     $bundleDir" -ForegroundColor Cyan
Write-Host "ZIP:          $zipPath" -ForegroundColor Cyan

if ($manifest.missingRequired.Count -gt 0) {
    Write-Warn "Mancano file richiesti: $($manifest.missingRequired -join ', ')"
    Write-Warn 'Controlla sul PC attuale prima di trasferire.'
}

Write-Host ''
Write-Warn 'Prossimo passo: copia cartella o ZIP sul laptop (NON GitHub Desktop).'
