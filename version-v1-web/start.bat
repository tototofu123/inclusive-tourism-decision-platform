@echo off
title Inclusive Tourism Platform
cd /d "%~dp0"

echo ========================================
echo  Inclusive Tourism Decision Platform
echo  Starting all services...
echo ========================================
echo.

:: ── User-configurable paths ──
set LLAMA_EXE=C:\Users\totot\llama-b9247-bin-win-cuda-12.4-x64\llama-server.exe
set LLAMA_MODELS=C:\Users\totot\.llama\models
set DEFAULT_MODEL=Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf

:: ── 1. Database (PostgreSQL) ──
echo [1/4] Checking PostgreSQL...
sc query postgresql-x64-18 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   PostgreSQL service found (postgresql-x64-18)
) else (
    echo   WARNING: PostgreSQL service not found. Start it manually.
    echo   Expected: postgresql-x64-18 on localhost:5432
)

:: ── 2. LLM (llama-server) ──
echo [2/4] Starting llama-server...
taskkill /f /im llama-server.exe >nul 2>&1
timeout /t 2 /nobreak >nul

start "llama-server" "%LLAMA_EXE%" -m "%LLAMA_MODELS%\%DEFAULT_MODEL%" --port 8081 -ngl 99
echo   PID: %ERRORLEVEL%
echo   Waiting for LLM to load (30s)...
echo   Model: %DEFAULT_MODEL%
timeout /t 30 /nobreak >nul

:: ── 3. Backend (Express + tsx) ──
echo [3/4] Starting backend on http://localhost:4000 ...
start "backend" cmd /c "cd /d version-v1-web\backend && npx tsx src/index.ts"
timeout /t 6 /nobreak >nul

:: ── 4. Frontend (Next.js) ──
echo [4/4] Starting frontend on http://localhost:3000 ...
start "frontend" cmd /c "cd /d version-v1-web\frontend && npm run dev"
timeout /t 8 /nobreak >nul

:: ── Open browser ──
echo ========================================
echo  All services started!
echo    LLM:      http://localhost:8081
echo    Backend:  http://localhost:4000
echo    Frontend: http://localhost:3000
echo ========================================
start http://localhost:3000
echo.
echo Close this window to stop all services.
echo To stop manually: taskkill /f /im llama-server.exe ^&^& taskkill /f /im node.exe
