@echo off
REM apps/api/.env dosyasini YEREL (localhost) veritabanina yonlendirir.
REM Parola ilk calistirmada bir kez sorulur, sonra kaydedilir.
REM Kayitli bilgileri degistirmek icin: set-local-env.bat -Reset
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set-local-env.ps1" %*
