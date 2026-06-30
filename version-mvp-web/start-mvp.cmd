@echo off
title Inclusive Tourism MVP
cd /d "%~dp0"
echo === Inclusive Tourism MVP ===
echo.

:: 1. LLM (llama.cpp)
set LLAMA_MODELS_DIR=%USERPROFILE%\.llama\models
set MODEL_FILE=
if exist "%LLAMA_MODELS_DIR%\*.gguf" (for %%f in ("%LLAMA_MODELS_DIR%\*.gguf") do set MODEL_FILE=%%f)
set LLAMA_EXE=%USERPROFILE%\llama-b9247-bin-win-cuda-12.4-x64\llama-server.exe
if not exist "%LLAMA_EXE%" set LLAMA_EXE=C:\Users\totot\AppData\Local\Microsoft\WinGet\Packages\ggml.llamacpp_Microsoft.Winget.Source_8wekyb3d8bbwe\llama-server.exe
if exist "%LLAMA_EXE%" (
  if not "%MODEL_FILE%"=="" (
    echo [1/3] Starting llama.cpp on port 8081...
    start /b "LLM" cmd /c ""%LLAMA_EXE%" -m "%MODEL_FILE%" --port 8081 -ngl 99" >nul 2>&1
    timeout /t 8 /nobreak >nul
  ) else (
    echo [SKIP] LLM: No .gguf model found in %LLAMA_MODELS_DIR%
  )
) else (
  echo [SKIP] LLM: llama-server.exe not found
)
echo.

:: 2. Backend
echo [2/3] Starting backend (port 4000)...
>nul 2>&1 powershell -noprofile -c "$p=netstat -ano|findstr ':4000'|findstr LISTEN; if($p){$pid=(-1split$p)[-1];Write-Output 'Killing PID:'+$pid;Stop-Process -Id $pid -Force}"
timeout /t 2 /nobreak >nul
cd /d backend
if not exist ".env" copy .env.example .env >nul
start /b "BE" cmd /c "npx tsx src/index.ts" >nul 2>&1
cd /d ..
timeout /t 6 /nobreak >nul
echo.

:: 3. Frontend
echo [3/3] Starting frontend (port 3000)...
cd /d frontend
start /b "FE" cmd /c "npx next dev -p 3000" >nul 2>&1
cd /d ..
timeout /t 6 /nobreak >nul
echo.

echo =============================================
echo  All services started in this window
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:4000
echo   LLM:      http://localhost:8081 (if model found)
echo =============================================
echo.
echo Press any key to stop all services and exit.
echo.
pause >nul
echo Stopping services...
taskkill /f /im llama-server.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo Done.
