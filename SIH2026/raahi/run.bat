@echo off
REM ============================================================
REM  RAAHI — one-shot dev launcher (Windows)
REM
REM  Detects whether DATABASE_URL points at local Docker Postgres
REM  or Supabase, starts Docker Desktop if it is installed but not
REM  running, applies every migration, and launches both services.
REM ============================================================
setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

echo.
echo === [1/6] Checking prerequisites ===
where python >nul 2>&1 || (echo   ! python not found in PATH & goto :fail)
where pnpm   >nul 2>&1 || (echo   ! pnpm not found in PATH   & goto :fail)
echo   OK  python, pnpm

if not exist .env (
  echo   ! .env not found. Copy .env.example to .env and fill it in.
  goto :fail
)

REM --- Is DATABASE_URL pointing at Supabase? ---
set "USE_SUPABASE="
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b "DATABASE_URL=" .env`) do (
  echo %%b | findstr /c:"supabase.com" >nul && set "USE_SUPABASE=1"
)

echo.
if defined USE_SUPABASE goto :supabase_mode

REM ============================================================
REM  LOCAL DOCKER MODE
REM ============================================================
echo === [2/6] Local Postgres via Docker ===
where docker >nul 2>&1 || (
  echo   ! docker not found in PATH.
  echo     Install Docker Desktop: https://www.docker.com/products/docker-desktop/
  echo     Or switch .env DATABASE_URL to a Supabase pooler URL.
  goto :fail
)

REM `where docker` only proves the CLI exists. The DAEMON is what matters.
docker info >nul 2>&1
if not errorlevel 1 goto :docker_ready

echo   Docker daemon is not responding - attempting to start Docker Desktop...
set "DD_EXE="
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"      set "DD_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" set "DD_EXE=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe"             set "DD_EXE=%LOCALAPPDATA%\Docker\Docker Desktop.exe"

if not defined DD_EXE (
  echo   ! Could not find Docker Desktop.exe in the usual locations.
  echo     Start Docker Desktop manually, wait for the whale icon to settle,
  echo     then run this script again.
  goto :fail
)

start "" "!DD_EXE!"
echo   Launched Docker Desktop. First start can take 1-2 minutes...
set /a tries=0
:waitdocker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if not errorlevel 1 goto :docker_ready
set /a tries+=1
if !tries! LSS 36 (
  set /a secs=!tries!*5
  echo     still waiting... ^(!secs!s^)
  goto waitdocker
)
echo   ! Docker did not become ready within 3 minutes.
echo     Open Docker Desktop, wait for it to say "Engine running", then re-run.
goto :fail

:docker_ready
echo   OK  Docker daemon responding

docker compose up -d
if errorlevel 1 goto :fail

echo   Waiting for Postgres to accept connections...
set /a tries=0
:waitdb
docker compose exec -T db pg_isready -U postgres -d raahi >nul 2>&1
if not errorlevel 1 goto :dbready
set /a tries+=1
if !tries! GEQ 40 (echo   ! Postgres did not become ready in 40s & goto :fail)
timeout /t 1 /nobreak >nul
goto waitdb
:dbready
echo   OK  Postgres ready on localhost:5432
goto :deps

:supabase_mode
echo === [2/6] Using SUPABASE - skipping Docker ===
echo   DATABASE_URL points at a Supabase pooler. Docker not started.

:deps
echo.
echo === [3/6] Python dependencies ===
python -m pip install -q -r apps\voice\requirements.txt python-dotenv
if errorlevel 1 goto :fail
echo   OK  installed

echo.
echo === [4/6] Database schema + seed ===
REM IMPORTANT: docker-entrypoint-initdb.d only runs on a FRESH volume, so an
REM existing database never picks up newly added migrations. bootstrap_db.py
REM applies every db/migrations/*.sql and the seed files, and is idempotent.
python bootstrap_db.py
if errorlevel 1 (
  echo   ! Schema bootstrap failed - see the error above.
  goto :fail
)

REM Load the Official India Data Pack (sole qualification source — scrapers removed).
REM The workbook data\raw\raahi-official-dataset.xlsx must be present.
echo   Importing Official India Data Pack ^(NQR qualifications, PM-AJAY rules...^)
python -m ingesters.import_official_dataset
if errorlevel 1 (
  echo   ! Official dataset import FAILED - check that data\raw\raahi-official-dataset.xlsx
  echo     is present. The voice app will have no qualifications.
  goto :fail
)
echo   OK  Official dataset imported

if not exist apps\web\node_modules (
  echo.
  echo === [4b/6] Installing web dependencies ^(first run only^) ===
  pushd apps\web
  call pnpm install
  popd
)

echo.
echo === [5/6] Freeing ports 8000 and 3000 ===
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1

echo.
echo === [6/6] Launching voice API and dashboard ===
start "RAAHI Voice API" cmd /k "cd /d %~dp0apps\voice && python -m uvicorn app.main:app --port 8000 --host 127.0.0.1"
start "RAAHI Dashboard" cmd /k "cd /d %~dp0apps\web   && pnpm dev"

echo   Waiting for the voice API...
set /a tries=0
:waitapi
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 1).StatusCode } catch { 0 }" | findstr "200" >nul
if not errorlevel 1 goto :apiready
set /a tries+=1
if !tries! GEQ 30 (echo   ! Voice API did not respond in 30s - check its console window & goto :openbrowser)
timeout /t 1 /nobreak >nul
goto waitapi
:apiready
echo   OK  Voice API responding

:openbrowser
echo.
echo ============================================================
echo   Ready.
echo     API docs   :  http://127.0.0.1:8000/docs
echo     Dashboard  :  http://localhost:3000
if defined USE_SUPABASE (echo     Database   :  Supabase ^(cloud^)) else (echo     Database   :  Local Docker Postgres)
echo ============================================================
rundll32 url.dll,FileProtocolHandler http://localhost:3000
echo.
echo   Two console windows opened (voice + web). Close them to stop.
echo   Postgres keeps running; use stop.bat to shut everything down.
echo.
goto :eof

:fail
echo.
echo === Startup failed. See the messages above. ===
pause
exit /b 1
