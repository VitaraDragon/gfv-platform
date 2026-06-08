# setup-dev-pc.ps1 — Ambiente di sviluppo GFV + Cursor (Windows)
#
# Uso:
#   .\scripts\setup-dev-pc.ps1              # solo controllo (default)
#   .\scripts\setup-dev-pc.ps1 -Install     # installa ciò che manca (CLI base)
#   .\scripts\setup-dev-pc.ps1 -Install -InstallExtensions  # + estensioni Cursor utili per GFV
#
# Idempotente: salta tool già presenti. Non modifica git config global se già impostata.

param(
    [switch]$Install,
    [switch]$InstallExtensions
)

$ErrorActionPreference = 'Continue'

$CursorExtensionsGfv = @(
    'aaron-bond.better-comments',
    'eamodio.gitlens',
    'donjayamanne.githistory',
    'mhutchie.git-graph',
    'ms-ceintl.vscode-language-pack-it',
    'ms-vscode.powershell',
    'github.vscode-github-actions',
    'anysphere.remote-ssh'
)

function Write-Section([string]$Title) {
    Write-Host ''
    Write-Host ('=== ' + $Title + ' ===') -ForegroundColor Cyan
}

function Get-CommandVersion([string]$Name, [string[]]$VersionArgs = @('--version')) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) { return $null }
    try {
        $raw = & $cmd.Source @VersionArgs 2>&1 | Out-String
        $line = ($raw -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 1).Trim()
        if ($line) { return $line }
    } catch { }
    return 'presente (versione non letta)'
}

function Test-WingetAvailable {
    return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

function Install-WithWinget([string]$WingetId, [string]$Label) {
    if (-not (Test-WingetAvailable)) {
        Write-Host "  [!] winget non disponibile — installa manualmente: $Label" -ForegroundColor Yellow
        return $false
    }
    Write-Host "  -> winget install $WingetId ..." -ForegroundColor DarkGray
    winget install --id $WingetId -e --accept-source-agreements --accept-package-agreements
    return ($LASTEXITCODE -eq 0)
}

function Show-Check([string]$Label, [string]$Value, [string]$Needed = 'consigliato') {
    if ($Value) {
        Write-Host ("  [OK]   {0,-22} {1}" -f ($Label + ':'), $Value) -ForegroundColor Green
        return $true
    }
    Write-Host ("  [MISS] {0,-22} ({1})" -f ($Label + ':'), $Needed) -ForegroundColor Yellow
    return $false
}

Write-Section 'GFV — controllo ambiente di sviluppo'
Write-Host "Modalità: $(if ($Install) { 'INSTALL (solo elementi mancanti)' } else { 'SOLO CONTROLLO (nessuna installazione)' })"
Write-Host "Repo: $(if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { (Get-Location).Path })"

$missing = @()

Write-Section 'CLI e runtime'
$gitOk = Show-Check 'Git' (Get-CommandVersion 'git' @('-v'))
if (-not $gitOk) { $missing += 'git' }

$nodeVer = Get-CommandVersion 'node' @('-v')
$nodeOk = Show-Check 'Node.js' $nodeVer 'richiesto (consigliato v22.x)'
if (-not $nodeOk) { $missing += 'nodejs' }

$npmOk = Show-Check 'npm' (Get-CommandVersion 'npm' @('-v'))
if (-not $npmOk) { $missing += 'npm' }

$firebaseOk = Show-Check 'Firebase CLI' (Get-CommandVersion 'firebase' @('--version'))
if (-not $firebaseOk) { $missing += 'firebase-tools' }

Show-Check 'Google Cloud SDK' (Get-CommandVersion 'gcloud' @('--version')) 'opzionale ma utile'
Show-Check 'Cursor' (Get-CommandVersion 'cursor' @('--version')) 'richiesto'
Show-Check 'GitHub CLI (gh)' (Get-CommandVersion 'gh' @('--version')) 'opzionale'
Show-Check 'Python' (Get-CommandVersion 'python' @('--version')) 'non richiesto per GFV'
Show-Check 'Docker' (Get-CommandVersion 'docker' @('--version')) 'non richiesto per GFV'

Write-Section 'Git (config globale)'
foreach ($key in @('user.name', 'user.email')) {
    $val = git config --global $key 2>$null
    if ($val) {
        Write-Host ("  [OK]   {0} = {1}" -f $key, $val) -ForegroundColor Green
    } else {
        Write-Host ("  [MISS] {0} non impostato (git config --global {0} ...)" -f $key) -ForegroundColor Yellow
    }
}

Write-Section 'Git hooks progetto'
$repoRoot = Split-Path $PSScriptRoot -Parent
Push-Location $repoRoot
try {
    $hooksPath = git config core.hooksPath 2>$null
    if ($hooksPath -eq '.githooks') {
        Write-Host '  [OK]   core.hooksPath = .githooks' -ForegroundColor Green
    } else {
        Write-Host '  [MISS] core.hooksPath (esegui: npm run setup:hooks)' -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

Write-Section 'Dipendenze npm progetto'
foreach ($rel in @('.', 'functions', 'landing')) {
    $dir = Join-Path $repoRoot $rel
    $label = if ($rel -eq '.') { 'root' } else { $rel }
    if (Test-Path (Join-Path $dir 'node_modules')) {
        Write-Host ("  [OK]   node_modules/{0}" -f $label) -ForegroundColor Green
    } else {
        Write-Host ("  [MISS] node_modules/{0} (npm install in {1})" -f $label, $label) -ForegroundColor Yellow
    }
}

Write-Section 'Estensioni Cursor (utili per GFV)'
$cursorCmd = Get-Command cursor -ErrorAction SilentlyContinue
if (-not $cursorCmd) {
    Write-Host '  [!] comando cursor non trovato — salto elenco estensioni' -ForegroundColor Yellow
} else {
    $installedRaw = & cursor --list-extensions 2>$null
    $installed = @($installedRaw | Where-Object { $_ -match '\S' })
    foreach ($ext in $CursorExtensionsGfv) {
        if ($installed -contains $ext) {
            Write-Host ("  [OK]   {0}" -f $ext) -ForegroundColor Green
        } else {
            Write-Host ("  [MISS] {0}" -f $ext) -ForegroundColor Yellow
        }
    }
}

Write-Section 'Prossimi passi manuali (non automatizzati)'
Write-Host @'
  - Accedi a Cursor con lo stesso account (User Rules si sincronizzano)
  - Plugin Cursor: Firebase (+ Context7 se lo usi) da Settings > Plugins
  - firebase login  (e gcloud auth login se usi Cloud SDK)
  - Deploy: leggi docs-sviluppo/DEPLOY_RUNBOOK.md (functions/.env vs secret, hosting landing/dist)
  - Secret CF: npm run sync:functions-secrets (o functions/.secret.local)
  - Chiavi SSH (~/.ssh) se usi Git via SSH
'@

if (-not $Install) {
    Write-Section 'Fine controllo'
    if ($missing.Count -gt 0) {
        Write-Host "Elementi mancanti rilevati: $($missing -join ', ')" -ForegroundColor Yellow
        Write-Host 'Per installare solo ciò che manca:  .\scripts\setup-dev-pc.ps1 -Install' -ForegroundColor Cyan
        Write-Host 'Con estensioni Cursor:              .\scripts\setup-dev-pc.ps1 -Install -InstallExtensions' -ForegroundColor Cyan
    } else {
        Write-Host 'CLI base presenti. Verifica npm install / hooks / login Firebase se serve.' -ForegroundColor Green
    }
    exit 0
}

Write-Section 'Installazione (solo elementi mancanti)'

if (-not $gitOk) {
    Write-Host 'Git...' -ForegroundColor White
    Install-WithWinget 'Git.Git' 'Git for Windows' | Out-Null
}

if (-not $nodeOk) {
    Write-Host 'Node.js LTS...' -ForegroundColor White
    Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js' | Out-Null
}

# Refresh PATH in sessione corrente (best effort)
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host '[!] npm ancora non in PATH — riapri PowerShell dopo install Node e rilancia lo script.' -ForegroundColor Yellow
} elseif (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host 'Firebase CLI (npm global)...' -ForegroundColor White
    npm install -g firebase-tools
}

if ($InstallExtensions -and (Get-Command cursor -ErrorAction SilentlyContinue)) {
    Write-Host 'Estensioni Cursor...' -ForegroundColor White
    foreach ($ext in $CursorExtensionsGfv) {
        & cursor --install-extension $ext 2>$null
    }
}

Write-Section 'Installazione terminata'
Write-Host 'Riapri PowerShell se hai appena installato Git/Node, poi rilancia SENZA -Install per verificare:' -ForegroundColor Cyan
Write-Host '  .\scripts\setup-dev-pc.ps1' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Nel repo:' -ForegroundColor Cyan
Write-Host '  npm install' -ForegroundColor Cyan
Write-Host '  cd functions && npm install && cd ..' -ForegroundColor Cyan
Write-Host '  cd landing && npm install && cd ..' -ForegroundColor Cyan
Write-Host '  npm run setup:hooks' -ForegroundColor Cyan
Write-Host '  firebase login' -ForegroundColor Cyan
Write-Host '  Runbook deploy: docs-sviluppo/DEPLOY_RUNBOOK.md' -ForegroundColor Cyan
