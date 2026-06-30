@echo off
title Inclusive Tourism v1
cd /d "%~dp0"

:: === Colour helper ===
setlocal enabledelayedexpansion
set "CYAN=[92m"
set "RESET=[0m"

echo %CYAN%[v1] Checking PostgreSQL on port 54322...%RESET%

:: Check if PG port is open using PowerShell (works on Win10+)
powershell -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.ConnectAsync('localhost',54322).Wait(2000);$r=$c.Connected;$c.Dispose();exit(-not$r)}catch{exit 1}"
if %ERRORLEVEL% NEQ 0 (
  echo %CYAN%[v1] ERROR: PostgreSQL not found on localhost:54322%RESET%
  echo %CYAN%[v1] Start Supabase Docker: docker start supabase_db_hkust-app-test%RESET%
  echo %CYAN%[v1] Or create a fresh container:%RESET%
  echo %CYAN%[v1]   docker run -d --name inclusive-pg-v1 -e POSTGRES_PASSWORD=postgres -p 54322:5432 pgvector/pgvector:pg16%RESET%
  pause
  exit /b 1
)
echo %CYAN%[v1] PostgreSQL is running.%RESET%

:: Install deps
echo %CYAN%[v1] Installing backend dependencies...%RESET%
cd backend
call npm install --silent 2>nul

:: Setup .env if missing
if not exist ".env" copy ".env.example" ".env" >nul

:: Seed DB
echo %CYAN%[v1] Seeding database...%RESET%
node db\seed_v1.js

:: Start Backend
echo %CYAN%[v1] Starting backend on port 3001...%RESET%
start "v1 Backend" cmd /c "node server.js"
timeout /t 4 /nobreak >nul

:: Go to repo root for frontend
cd ..\..

:: Setup frontend .env.local
if not exist "version-mvp-web\frontend\.env.local" (
  echo NEXT_PUBLIC_API_URL=http://localhost:3001 > "version-mvp-web\frontend\.env.local"
)

:: Start Frontend
echo %CYAN%[v1] Starting frontend on port 3000...%RESET%
cd version-mvp-web\frontend
if not exist "node_modules" call npm install --silent 2>nul
start "v1 Frontend" cmd /c "npx next dev -p 3000"

cd ..\..

:: Summary
echo.
echo %CYAN%============================================%RESET%
echo %CYAN%  v1 Stack Running%RESET%
echo %CYAN%  Frontend: http://localhost:3000%RESET%
echo %CYAN%  Backend:  http://localhost:3001%RESET%
echo %CYAN%  Health:   http://localhost:3001/health%RESET%
echo %CYAN%  DB:       localhost:54322/inclusive_tourism_v1%RESET%
echo %CYAN%============================================%RESET%
echo.
echo Close the terminal windows to stop.
echo.
pause
