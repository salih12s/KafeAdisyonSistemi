@echo off
REM apps/api/.env dosyasini PRODUCTION (Railway) veritabanina yonlendirir.
REM Adres ilk calistirmada bir kez sorulur, sonra kaydedilir.
REM Kayitli adresi degistirmek icin: set-production-env.bat -Reset
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set-production-env.ps1" %*
