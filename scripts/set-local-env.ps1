<#
  apps/api/.env dosyasini YEREL (localhost) veritabanina yonlendirir.

  Parola ILK CALISTIRMADA bir kez sorulur ve apps/api/.env.local dosyasina
  kaydedilir. Sonraki calistirmalarda hicbir sey sorulmaz.

  Her iki dosya da .gitignore icindedir; parola repoya gonderilmez.

  Kullanim:
    scripts\set-local-env.bat          # hizli gecis (soru sormaz)
    scripts\set-local-env.bat -Reset   # kayitli bilgileri degistir
#>

param(
    [switch]$Reset
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot 'apps\api\.env'
$cachePath = Join-Path $repoRoot 'apps\api\.env.local'

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

Write-Host 'Joker Cafe - YEREL ortama geciliyor' -ForegroundColor Cyan
Write-Host ''

$databaseUrl = $null
if (-not $Reset) { $databaseUrl = Read-CachedUrl $cachePath }

if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    $secure = Read-Host 'PostgreSQL "postgres" kullanicisinin parolasi' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    if ([string]::IsNullOrWhiteSpace($plain)) {
        Write-Host 'Parola bos olamaz. Islem iptal edildi.' -ForegroundColor Red
        exit 1
    }

    # Baglanti adresinde @ : / gibi karakterler ozel anlam tasidigi icin kodlanir.
    $encoded = [uri]::EscapeDataString($plain)

    $dbName = Read-Host 'Veritabani adi (bos birakilirsa CafeAdisyon)'
    if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = 'CafeAdisyon' }

    $databaseUrl = "postgresql://postgres:$encoded@localhost:5432/$dbName" + '?schema=public'

    Set-Content -Path $cachePath -Value "DATABASE_URL=$databaseUrl" -Encoding utf8
    Write-Host "Kaydedildi: $cachePath (gitignore icinde)" -ForegroundColor DarkGray
}

$content = @"
NODE_ENV=development
PORT=3000
DATABASE_URL=$databaseUrl
"@

Set-Content -Path $envPath -Value $content -Encoding utf8

Write-Host ''
Write-Host 'AKTIF ORTAM: YEREL' -ForegroundColor Green
Write-Host ("  " + (Get-MaskedUrl $databaseUrl)) -ForegroundColor Green
Write-Host ''
Write-Host 'Sonraki adim: npm run db:check' -ForegroundColor Cyan
Write-Host 'Canliya gecmek icin: scripts\set-production-env.bat' -ForegroundColor Cyan
