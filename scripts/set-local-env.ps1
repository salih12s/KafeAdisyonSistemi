<#
  Yerel .env dosyasını oluşturur.

  Parola bu betiğin içinde YAZILI DEĞİLDİR; çalışırken sorulur ve yalnızca
  apps/api/.env dosyasına yazılır. Bu dosya .gitignore içindedir, repoya gönderilmez.

  Kullanım:
    powershell -ExecutionPolicy Bypass -File scripts\set-local-env.ps1
#>

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot 'apps\api\.env'

Write-Host 'Kafe Adisyon - yerel ortam kurulumu' -ForegroundColor Cyan
Write-Host ''

if (Test-Path $envPath) {
    Write-Host "Zaten var: $envPath" -ForegroundColor Yellow
    $answer = Read-Host 'Uzerine yazilsin mi? (e/h)'
    if ($answer -ne 'e') {
        Write-Host 'Islem iptal edildi. Mevcut dosya korundu.'
        exit 0
    }
}

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

$port = Read-Host 'API portu (bos birakilirsa 3000)'
if ([string]::IsNullOrWhiteSpace($port)) { $port = '3000' }

$dbName = Read-Host 'Veritabani adi (bos birakilirsa CafeAdisyon)'
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = 'CafeAdisyon' }

$content = @"
NODE_ENV=development
PORT=$port
HOST=0.0.0.0
DATABASE_URL="postgresql://postgres:$encoded@localhost:5432/$dbName"
LOG_LEVEL=info
JSON_BODY_LIMIT=1mb
"@

Set-Content -Path $envPath -Value $content -Encoding utf8 -NoNewline:$false

Write-Host ''
Write-Host "Olusturuldu: $envPath" -ForegroundColor Green
Write-Host 'Bu dosya .gitignore icindedir, depoya gonderilmez.'
Write-Host ''
Write-Host 'Sonraki adim: npm run db:check' -ForegroundColor Cyan
