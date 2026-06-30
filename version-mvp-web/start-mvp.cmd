@echo off
title Inclusive Tourism MVP
cd /d "%~dp0"
echo === Inclusive Tourism MVP ===
echo.

:: 1. LLM (llama.cpp)
set LLAMA_DIR=%USERPROFILE%\llama-b9247-bin-win-cuda-12.4-x64
set MODEL_FILE=
if exist "%LLAMA_DIR%\models\*.gguf" (for %%f in ("%LLAMA_DIR%\models\*.gguf") do set MODEL_FILE=%%f)
if "%MODEL_FILE%"=="" if exist "%LLAMA_DIR%\*.gguf" (for %%f in ("%LLAMA_DIR%\*.gguf") do set MODEL_FILE=%%f)
if exist "%LLAMA_DIR%\llama-server.exe" (
  if not "%MODEL_FILE%"=="" (
    echo [1/3] Starting llama.cpp on port 8080...
    start "LLM" cmd /c ""%LLAMA_DIR%\llama-server.exe" -m "%MODEL_FILE%" --port 8080 -ngl 99"
    timeout /t 8 /nobreak >nul
  ) else (
    echo [SKIP] LLM: No .gguf model found in %LLAMA_DIR%
  )
) else (
  echo [SKIP] LLM: llama-server.exe not found
)
echo.

:: 2. Seed + Backend
echo [2/3] Seeding DB and starting backend (port 3001)...
cd /d backend
if not exist ".env" copy .env.example .env >nul
node db/seed.js
start "BE" cmd /c "node server.js"
cd /d ..
timeout /t 4 /nobreak >nul
echo.

:: 3. Frontend
echo [3/3] Starting frontend (port 3000)...
cd /d frontend
if not exist ".env.local" copy .env.local.example .env.local >nul
start "FE" cmd /c "npx next dev -p 3000"
cd /d ..
timeout /t 4 /nobreak >nul

echo.
echo === MVP Running ===
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo   LLM:      http://localhost:8080 (if model found)
echo.
pause
