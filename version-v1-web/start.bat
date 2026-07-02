@echo off
title Inclusive Tourism Platform
cd /d "%~dp0"

echo ========================================
echo  Inclusive Tourism Decision Platform
echo ========================================
echo.

:: ── User-configurable paths ──
set LLAMA_EXE=C:\Users\totot\llama-b9247-bin-win-cuda-12.4-x64\llama-server.exe
set LLAMA_MODELS=C:\Users\totot\.llama\models
set DEFAULT_MODEL=Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf
set BACKEND_DIR=%~dp0backend
set FRONTEND_DIR=%~dp0frontend

:: ── 1. Database ──
echo [1/4] Checking PostgreSQL...
sc query postgresql-x64-18 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   PostgreSQL [OK] (postgresql-x64-18)
) else (
    echo   WARNING: PostgreSQL service not found. Start manually.
)

:: ── 2. LLM ──
echo [2/4] Starting llama-server...
taskkill /f /im llama-server.exe >nul 2>&1
timeout /t 2 /nobreak >nul

start "llama-server" "%LLAMA_EXE%" -m "%LLAMA_MODELS%\%DEFAULT_MODEL%" --port 8081 -ngl 99
echo   Model: %DEFAULT_MODEL%
echo   Waiting 30s for model to load...
timeout /t 30 /nobreak >nul

:: ── 3. Backend ──
echo [3/4] Starting backend on http://localhost:4000 ...
start "backend" cmd /k "cd /d "%BACKEND_DIR%" && echo Backend starting... && npx tsx src/index.ts"
timeout /t 6 /nobreak >nul

:: ── 4. Frontend ──
echo [4/4] Starting frontend on http://localhost:3000 ...
start "frontend" cmd /k "cd /d "%FRONTEND_DIR%" && echo Frontend starting... && npm run dev"
timeout /t 8 /nobreak >nul

echo ========================================
echo  All services launched!
echo    LLM:      http://localhost:8081
echo    Backend:  http://localhost:4000
echo    Frontend: http://localhost:3000
echo ========================================
start http://localhost:3000
echo.
echo Windows stay open — close them to stop each service.
echo Or run: taskkill /f /im llama-server.exe ^&^& taskkill /f /im node.exe
