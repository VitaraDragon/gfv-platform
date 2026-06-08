# sync-functions-secrets.ps1 - Sincronizza secret Firebase Functions da file locali o revisione Cloud Run precedente.
#
# Uso (dalla root repo):
#   .\scripts\sync-functions-secrets.ps1
#   .\scripts\sync-functions-secrets.ps1 -Deploy
#   .\scripts\sync-functions-secrets.ps1 -RecoverFromCloudRun:$false
#
# Fonti chiavi (in ordine, la prima vince):
#   1. functions/.secret.local  (consigliato, gitignored)
#   2. functions/.env           (solo se contiene chiavi — NON committare)
#   3. Revisione Cloud Run precedente (-RecoverFromCloudRun, default true) per GEMINI_API_KEY
#
# Secret gestiti: GEMINI_API_KEY, OPENWEATHER_API_KEY, RESEND_API_KEY, SENTRY_DSN (opzionale)
# Dopo sync: ridistribuire con npm run deploy:functions (o -Deploy).

param(
    [string]$Project = 'gfv-platform',
    [string]$Region = 'europe-west1',
    [string]$CloudRunService = 'tonyask',
    [switch]$RecoverFromCloudRun = $true,
    [switch]$Deploy,
    [switch]$SkipExisting
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path $PSScriptRoot -Parent
$FunctionsDir = Join-Path $RepoRoot 'functions'

$RequiredSecrets = @(
    'GEMINI_API_KEY',
    'OPENWEATHER_API_KEY',
    'RESEND_API_KEY'
)
$OptionalSecrets = @('SENTRY_DSN')

function Write-Section([string]$Title) {
    Write-Host ''
    Write-Host ('=== ' + $Title + ' ===') -ForegroundColor Cyan
}

function Refresh-PathEnv {
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

function Read-DotEnvFile([string]$Path) {
    $map = @{}
    if (-not (Test-Path $Path)) { return $map }
    Get-Content $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        if ($line -match '^export\s+') { $line = $line.Substring(7).Trim() }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { return }
        $name = $line.Substring(0, $eq).Trim()
        $val = $line.Substring($eq + 1).Trim()
        if ($val.Length -ge 2) {
            if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
                $val = $val.Substring(1, $val.Length - 2)
            }
        }
        if ($name -and $val) { $map[$name] = $val }
    }
    return $map
}

function Merge-KeyMaps {
    param([hashtable[]]$Maps)
    $out = @{}
    foreach ($m in $Maps) {
        if (-not $m) { continue }
        foreach ($k in $m.Keys) {
            if ($m[$k]) { $out[$k] = $m[$k] }
        }
    }
    return $out
}

function Get-FirebaseCli {
    Refresh-PathEnv
    $local = Join-Path $RepoRoot 'node_modules\firebase-tools\lib\bin\firebase.js'
    if (Test-Path $local) {
        return @{ Node = (Get-Command node -ErrorAction Stop).Source; Args = @($local) }
    }
    $global = Get-Command firebase.cmd -ErrorAction SilentlyContinue
    if ($global) { return @{ Cmd = $global.Source } }
    throw 'Firebase CLI non trovato. Esegui: npm install (root repo) oppure npm install -g firebase-tools'
}

function Invoke-Firebase {
    param([string[]]$FirebaseArgs)
    $cli = Get-FirebaseCli
    if ($cli.Node) {
        & $cli.Node @($cli.Args + $FirebaseArgs)
    } else {
        & $cli.Cmd @FirebaseArgs
    }
    if ($LASTEXITCODE -ne 0) { throw "firebase $($FirebaseArgs -join ' ') exit $LASTEXITCODE" }
}

function Test-SecretExists([string]$SecretName) {
    try {
        $out = gcloud secrets describe $SecretName --project=$Project 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Get-CloudRunPlainEnv([string]$RevisionName, [string]$VarName) {
    $json = gcloud run revisions describe $RevisionName `
        --region=$Region --project=$Project --format=json 2>$null
    if (-not $json) { return $null }
    $obj = $json | ConvertFrom-Json
    $envs = $obj.spec.containers[0].env
    if (-not $envs) { return $null }
    foreach ($e in $envs) {
        if ($e.name -eq $VarName -and $e.value) {
            return [string]$e.value
        }
    }
    return $null
}

function Find-CloudRunRevisionWithEnv([string]$VarName) {
    $revs = @(gcloud run revisions list --service=$CloudRunService `
        --region=$Region --project=$Project --format="value(name)" --limit=20 2>$null)
    foreach ($rev in $revs) {
        $val = Get-CloudRunPlainEnv -RevisionName $rev -VarName $VarName
        if ($val) {
            return @{ Revision = $rev; Value = $val }
        }
    }
    return $null
}

function Set-FirebaseSecret([string]$SecretName, [string]$Value) {
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $Value, [System.Text.UTF8Encoding]::new($false))
        Write-Host "  Imposto secret $SecretName ..." -ForegroundColor White
        Invoke-Firebase @('functions:secrets:set', $SecretName, '--data-file', $tmp, '--project', $Project, '--force')
        Write-Host ('  [OK] ' + $SecretName) -ForegroundColor Green
    } finally {
        if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
    }
}

Refresh-PathEnv
Push-Location $RepoRoot
try {
    Write-Section 'GFV - sync secret Cloud Functions'
    Write-Host "Progetto: $Project  Regione: $Region"

    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        throw 'gcloud non trovato nel PATH. Installa Google Cloud SDK o usa functions/.secret.local con tutte le chiavi.'
    }

    $secretLocal = Read-DotEnvFile (Join-Path $FunctionsDir '.secret.local')
    $dotEnv = Read-DotEnvFile (Join-Path $FunctionsDir '.env')
    $keys = Merge-KeyMaps @($secretLocal, $dotEnv)

    Write-Section 'Fonti locali'
    $localPath1 = Join-Path $FunctionsDir '.secret.local'
    $localPath2 = Join-Path $FunctionsDir '.env'
    if (Test-Path $localPath1) {
        Write-Host ('  [OK]   ' + $localPath1) -ForegroundColor Green
    } else {
        Write-Host ('  [--]   ' + $localPath1 + ' (assente - crea da .secret.local.example)') -ForegroundColor Yellow
    }
    if (Test-Path $localPath2) {
        $names = @($dotEnv.Keys)
        if ($names.Count -gt 0) {
            Write-Host ('  [OK]   ' + $localPath2 + ' (' + ($names -join ', ') + ')') -ForegroundColor Green
        } else {
            Write-Host ('  [--]   ' + $localPath2 + ' (vuoto o solo commenti)') -ForegroundColor Yellow
        }
    }

    if ($RecoverFromCloudRun -and -not $keys['GEMINI_API_KEY']) {
        Write-Section 'Recupero GEMINI_API_KEY da revisione Cloud Run precedente'
        $found = Find-CloudRunRevisionWithEnv -VarName 'GEMINI_API_KEY'
        if ($found) {
            $keys['GEMINI_API_KEY'] = $found.Value
            Write-Host ('  [OK]   Trovata su revisione ' + $found.Revision + ' (servizio ' + $CloudRunService + ')') -ForegroundColor Green
        } else {
            Write-Host '  [MISS] Nessuna revisione con GEMINI_API_KEY in chiaro' -ForegroundColor Yellow
        }
    }

    Write-Section 'Upload Secret Manager'
    $allSecrets = $RequiredSecrets + $OptionalSecrets
    $updated = 0
    $skipped = 0
    $missing = @()

    foreach ($name in $allSecrets) {
        $isRequired = $RequiredSecrets -contains $name
        if (-not $keys[$name]) {
            if (Test-SecretExists $name) {
                Write-Host ('  [SKIP] ' + $name + ' - gia in Secret Manager') -ForegroundColor DarkYellow
                $skipped++
                continue
            }
            if ($isRequired) {
                $missing += $name
            }
            continue
        }
        if ($SkipExisting -and (Test-SecretExists $name)) {
            Write-Host ('  [SKIP] ' + $name + ' - gia presente (-SkipExisting)') -ForegroundColor DarkYellow
            $skipped++
            continue
        }
        Set-FirebaseSecret -SecretName $name -Value $keys[$name]
        $updated++
    }

    if ($missing.Count -gt 0) {
        Write-Host ''
        Write-Host 'Chiavi mancanti:' -ForegroundColor Red
        foreach ($m in $missing) {
            Write-Host "  - $m" -ForegroundColor Red
        }
        Write-Host ''
        Write-Host 'Aggiungile in functions/.secret.local oppure:' -ForegroundColor Yellow
        Write-Host '  firebase functions:secrets:set NOME_CHIAVE --project gfv-platform' -ForegroundColor Yellow
        exit 1
    }

    Write-Host ''
    Write-Host "Secret aggiornati: $updated  saltati: $skipped" -ForegroundColor Cyan

    if ($Deploy) {
        Write-Section 'Deploy Cloud Functions'
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                    [System.Environment]::GetEnvironmentVariable('Path', 'User')
        npm run deploy:functions
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } else {
        Write-Host ''
        Write-Host 'Prossimo passo:' -ForegroundColor Cyan
        Write-Host '  npm run deploy:functions' -ForegroundColor Cyan
        Write-Host 'oppure:' -ForegroundColor Cyan
        Write-Host '  .\scripts\sync-functions-secrets.ps1 -Deploy' -ForegroundColor Cyan
    }
} finally {
    Pop-Location
}
