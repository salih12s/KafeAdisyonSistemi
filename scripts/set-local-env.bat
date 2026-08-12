@echo off
REM Yerel .env dosyasini olusturur. Parola betikte yazili degildir, calisirken sorulur.
REM Kullanim: cift tiklayin veya komut satirindan calistirin.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set-local-env.ps1"

echo.
pause
