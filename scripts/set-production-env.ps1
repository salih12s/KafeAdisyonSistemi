<#
  apps/api/.env dosyasini PRODUCTION (Railway) veritabanina yonlendirir.

  Baglanti adresi ILK CALISTIRMADA bir kez sorulur ve apps/api/.env.production
  dosyasina kaydedilir. Sonraki calistirmalarda hicbir sey sorulmaz.

  Her iki dosya da .gitignore icindedir; parola repoya gonderilmez.

  Kullanim:
    scripts\set-production-env.bat          # hizli gecis (soru sormaz)
    scripts\set-production-env.bat -Reset   # kayitli adresi degistir
#>

param(
    [switch]$Reset
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot 'apps\api\.env'
$cachePath = Join-Path $repoRoot 'apps\api\.env.production'

function Get-MaskedUrl([string]$url) {
    return ($url -replace '://[^@]+@', '://***@')
}

function Read-CachedUrl([string]$path) {
    if (-not (Test-Path $path)) { return $null }
    foreach ($line in Get-Content -Path $path) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)$') { return $Matches[1].Trim() }
    }
    return $null
}

Write-Host 'Joker Cafe - PRODUCTION (Railway) ortamina geciliyor' -ForegroundColor Cyan
Write-Host ''

$databaseUrl = $null
if (-not $Reset) { $databaseUrl = Read-CachedUrl $cachePath }

if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    Write-Host 'Railway > Postgres > Variables > DATABASE_PUBLIC_URL degerini yapistirin.'
    Write-Host 'Bu adres kaydedilecek; bir daha sorulmayacak.' -ForegroundColor DarkGray
    $secureUrl = Read-Host 'DATABASE_PUBLIC_URL' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
    try {
        $databaseUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    $databaseUrl = $databaseUrl.Trim()

    if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
        Write-Host 'Baglanti adresi bos olamaz. Islem iptal edildi.' -ForegroundColor Red
        exit 1
    }
    if (-not ($databaseUrl.StartsWith('postgresql://') -or $databaseUrl.StartsWith('postgres://'))) {
        Write-Host 'Adres postgresql:// veya postgres:// ile baslamalidir.' -ForegroundColor Red
        exit 1
    }
    if ($databaseUrl.Contains('localhost') -or $databaseUrl.Contains('127.0.0.1')) {
        Write-Host 'Bu yerel bir adres. Bunun yerine set-local-env.bat kullanin.' -ForegroundColor Red
        exit 1
    }

    Set-Content -Path $cachePath -Value "DATABASE_URL=$databaseUrl" -Encoding utf8
    Write-Host "Kaydedildi: $cachePath (gitignore icinde)" -ForegroundColor DarkGray
}

# NODE_ENV=development kalir: bu dosya yerel makinede calisan komutlar icindir.
# Railway uzerindeki degiskenler bu dosyadan tamamen bagimsizdir.
$content = @"
NODE_ENV=development
PORT=3000
DATABASE_URL=$databaseUrl
"@

Set-Content -Path $envPath -Value $content -Encoding utf8

Write-Host ''
Write-Host 'AKTIF ORTAM: PRODUCTION (Railway)' -ForegroundColor Yellow
Write-Host ("  " + (Get-MaskedUrl $databaseUrl)) -ForegroundColor Yellow
Write-Host ''
Write-Host 'Bundan sonra su komutlar CANLI veritabanina baglanir:' -ForegroundColor DarkGray
Write-Host '  npm run db:check | db:migrate:status | db:migrate:deploy | setup:owner' -ForegroundColor DarkGray
Write-Host ''
Write-Host 'Yerele donmek icin: scripts\set-local-env.bat' -ForegroundColor Cyan
