@echo off
REM Yerel (localhost) baglantisi icin apps/api/.env dosyasini olusturur.
REM Parola bu dosyada YAZILI DEGILDIR; betik calisirken sorulur.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set-local-env.ps1"
pause
