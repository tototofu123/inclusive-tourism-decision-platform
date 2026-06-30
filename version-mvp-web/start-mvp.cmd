@echo off
title Inclusive Tourism MVP
cd /d "%~dp0"
echo === Starting Inclusive Tourism MVP ===
echo.

:: --- LLM (llama.cpp) ---
set LLAMA_DIR=%USERPROFILE%\llama-b9247-bin-win-cuda-12.4-x64
set MODEL_FILE=
if exist "%LLAMA_DIR%\models\*.gguf" (
  for %%f in ("%LLAMA_DIR%\models\*.gguf") do set MODEL_FILE=%%f
)
if "%MODEL_FILE%"=="" if exist "%LLAMA_DIR%\*.gguf" (
  for %%f in ("%LLAMA_DIR%\*.gguf") do set MODEL_FILE=%%f
)
if exist "%LLAMA_DIR%\llama-server.exe" (
  if "%MODEL_FILE%"=="" (
    echo [SKIP] LLM: No .gguf model found in %LLAMA_DIR%
    echo         Download a model and place it in %LLAMA_DIR%\models\
    echo         Or use any GGUF model in %LLAMA_DIR%
    echo.
  ) else (
    echo [1/3] Starting LLM (llama.cpp on port 8081)...
    start "LLM" cmd /c ""%LLAMA_DIR%\llama-server.exe" -m "%MODEL_FILE%" --port 8081 -ngl 99"
    timeout /t 8 /nobreak >nul
  )
) else (
  echo [SKIP] LLM: llama-server.exe not found at %LLAMA_DIR%
  echo.
)

:: --- Database migration ---
echo [X/3] Running database migration...
node -e "const {execSync} = require('child_process'); const fs = require('fs'); const path = require('path'); const dir = path.join(__dirname, 'database', 'migrations'); if (fs.existsSync(dir)) { fs.readdirSync(dir).sort().forEach(f => { if (f.endsWith('.sql')) { try { execSync('psql -d inclusive_tourism_mvp -f \"' + path.join(dir, f) + '\"', {stdio:'pipe'}); console.log('  Ran migration: ' + f); } catch(e) { console.log('  ' + f + ': ' + (e.message.includes('already exists') ? 'skip (exists)' : 'ok')); } } }); }" 2>nul
echo.

:: --- Backend ---
echo [2/3] Starting backend (port 4000)...
start "BE" cmd /c "cd /d backend && npx tsx src/index.ts"
timeout /t 5 /nobreak >nul

:: --- Frontend ---
echo [3/3] Starting frontend (port 3000)...
start "FE" cmd /c "cd /d frontend && npx next dev -p 3000"
timeout /t 5 /nobreak >nul

echo.
echo === MVP Running ===
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:4000
echo   LLM:      http://localhost:8081  (if model found)
echo.
echo Close the terminal windows to stop.
echo.
pause
