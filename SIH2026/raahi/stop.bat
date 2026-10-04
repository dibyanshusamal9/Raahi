@echo off
REM Stops the voice API, web dashboard, and Postgres container.
cd /d "%~dp0"
echo Stopping voice + web (ports 8000, 3000)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1
echo Stopping Postgres container...
docker compose down
echo Done.
