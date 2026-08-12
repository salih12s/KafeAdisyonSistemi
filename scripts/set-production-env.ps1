<#
  Production (Railway) baglantisi icin apps/api/.env dosyasini olusturur.

  Bu betik, yerel makinenizden CANLI veritabanina baglanmak icindir:
  migration calistirmak, tablo durumunu gormek, ilk owner hesabini olusturmak.

  GERCEK PAROLA BU BETIGIN ICINDE YAZILI DEGILDIR. Calisirken sorulur ve yalniz
  apps/api/.env dosyasina yazilir; o dosya .gitignore icindedir.

  Railway baglanti adresini soyle bulursunuz:
    Railway > Postgres servisi > Variables > DATABASE_PUBLIC_URL
  Degeri oldugu gibi kopyalayip buraya yapistirin.

  Kullanim:
    powershell -ExecutionPolicy Bypass -File scripts\set-production-env.ps1
  veya
    scripts\set-production-env.bat
#>

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot 'apps\api\.env'

Write-Host 'Joker Cafe - PRODUCTION (Railway) ortam kurulumu' -ForegroundColor Cyan
Write-Host ''
Write-Host 'DIKKAT: Bu dosya yazildiktan sonra asagidaki komutlar CANLI' -ForegroundColor Yellow
Write-Host 'veritabanina baglanir. Yerel CafeAdisyon veritabaniniza donmek icin' -ForegroundColor Yellow
Write-Host 'scripts\set-local-env.bat betigini calistirin.' -ForegroundColor Yellow
Write-Host ''

if (Test-Path $envPath) {
    Write-Host "Zaten var: $envPath" -ForegroundColor Yellow
    $answer = Read-Host 'Uzerine yazilsin mi? (e/h)'
    if ($answer -ne 'e') {
        Write-Host 'Islem iptal edildi. Mevcut dosya korundu.'
        exit 0
    }
}

Write-Host 'Railway > Postgres > Variables > DATABASE_PUBLIC_URL degerini yapistirin.'
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
    Write-Host 'Baglanti adresi postgresql:// veya postgres:// ile baslamalidir.' -ForegroundColor Red
    exit 1
}

if ($databaseUrl.Contains('localhost') -or $databaseUrl.Contains('127.0.0.1')) {
    Write-Host 'Bu bir yerel adres. Production betigi yerine set-local-env.bat kullanin.' -ForegroundColor Red
    exit 1
}

$port = Read-Host 'Yerel API portu (bos birakilirsa 3000)'
if ([string]::IsNullOrWhiteSpace($port)) { $port = '3000' }

# NODE_ENV=development kalir: bu dosya yerel makinede calisan komutlar icindir.
# Railway uzerindeki degiskenler bu dosyadan bagimsizdir.
$content = @"
NODE_ENV=development
PORT=$port
DATABASE_URL=$databaseUrl
"@

Set-Content -Path $envPath -Value $content -Encoding utf8 -NoNewline:$false

Write-Host ''
Write-Host "Olusturuldu: $envPath" -ForegroundColor Green
Write-Host 'Bu dosya .gitignore icindedir, depoya gonderilmez.'
Write-Host ''
Write-Host 'Sonraki adimlar:' -ForegroundColor Cyan
Write-Host '  npm run db:check            # canli baglantiyi dogrula'
Write-Host '  npm run db:migrate:status   # migration durumunu gor'
Write-Host '  npm run db:migrate:deploy   # eksik migrationlari uygula'
Write-Host '  npm run setup:owner         # canli ilk yonetici hesabi'
Write-Host ''
Write-Host 'Yerel veritabanina donmek icin: scripts\set-local-env.bat' -ForegroundColor Cyan
