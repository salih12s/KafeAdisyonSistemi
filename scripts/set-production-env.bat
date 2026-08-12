@echo off
REM Production (Railway) baglantisi icin apps/api/.env dosyasini olusturur.
REM Parola bu dosyada YAZILI DEGILDIR; betik calisirken sorulur.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set-production-env.ps1"
pause
