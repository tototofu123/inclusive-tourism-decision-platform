@echo off
title Inclusive Tourism v1
cd /d "%~dp0"
setlocal enabledelayedexpansion

echo [v1] Starting Inclusive Tourism v1...
echo.

:: 1. Docker setup
echo [v1] Starting PostgreSQL via Docker...
powershell -ExecutionPolicy Bypass -File "%~dp0docker-setup.ps1"
if %ERRORLEVEL% NEQ 0 (
  echo [v1] ERROR: Docker setup failed.
  pause
  exit /b 1
)

:: 2. Copy .env from .env.example if missing
if not exist "backend\.env" (
  if exist "backend\.env.example" (
    copy "backend\.env.example" "backend\.env" >nul
    echo [v1] Created .env from .env.example
  )
)

:: 3. Install backend deps
echo [v1] Installing backend dependencies...
cd backend
call npm install --silent 2>nul

:: 4. Seed
echo [v1] Seeding database...
node db\seed_v1.js

:: 5. Start backend
echo [v1] Starting backend on port 3001...
start "v1 Backend" cmd /c "node server.js"
timeout /t 4 /nobreak >nul
cd ..

:: 6. Frontend setup
echo [v1] Setting up frontend...
if not exist "..\version-mvp-web\frontend\.env.local" (
  echo NEXT_PUBLIC_API_URL=http://localhost:3001 > "..\version-mvp-web\frontend\.env.local"
)

:: 7. Start frontend
cd ..\version-mvp-web\frontend
if not exist "node_modules" call npm install --silent 2>nul
echo [v1] Starting frontend on port 3000...
start "v1 Frontend" cmd /c "npx next dev -p 3000"
cd ..\..

:: 8. Summary
echo.
echo =============================================
echo   v1 Stack Running
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo   Health:   http://localhost:3001/health
echo   DB:       localhost:54325 (pgvector/pgvector:pg16)
echo =============================================
echo.
echo Close the terminal windows to stop.
echo.
pause
