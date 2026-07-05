@echo off
title Inclusive Tourism MVP
cd /d "%~dp0"

:: Kill zombie port 4000
>nul 2>&1 powershell -noprofile -c "$p=netstat -ano|findstr ':4000'|findstr LISTEN; if($p){$pid=(-1split$p)[-1];Stop-Process -Id $pid -Force}"

:: Detect LLM
set LLAMA_MODELS_DIR=%USERPROFILE%\.llama\models
set MODEL_FILE=
if exist "%LLAMA_MODELS_DIR%\*.gguf" (for %%f in ("%LLAMA_MODELS_DIR%\*.gguf") do set MODEL_FILE=%%f)
set LLAMA_EXE=%USERPROFILE%\llama-b9247-bin-win-cuda-12.4-x64\llama-server.exe
if not exist "%LLAMA_EXE%" set LLAMA_EXE=C:\Users\totot\AppData\Local\Microsoft\WinGet\Packages\ggml.llamacpp_Microsoft.Winget.Source_8wekyb3d8bbwe\llama-server.exe

echo.
echo === Starting Inclusive Tourism MVP ===
echo.
echo Opening 4 windows:
echo   1. Backend  (port 4000)
echo   2. Frontend (port 3000)
echo   3. LLM      (port 8081)
echo   4. Console
echo.

:: 1. Backend
start "BE 4000" cmd /k "cd /d backend && npx tsx src/index.ts"
timeout /t 4 /nobreak >nul

:: 2. Frontend
start "FE 3000" cmd /k "cd /d frontend && npx next dev -p 3000"
timeout /t 4 /nobreak >nul

:: 3. LLM
if exist "%LLAMA_EXE%" (
  if not "%MODEL_FILE%"=="" (
    start "LLM 8081" cmd /k ""%LLAMA_EXE%" -m "%MODEL_FILE%" --port 8081 -ngl 99 -c 8192"
    timeout /t 4 /nobreak >nul
  ) else (
    start "LLM 8081" cmd /k "echo No .gguf model found in %LLAMA_MODELS_DIR% && echo. && pause"
  )
) else (
  start "LLM 8081" cmd /k "echo llama-server.exe not found && echo. && pause"
)

:: 4. Console
start "MVP Console" cmd /k "echo Inclusive Tourism MVP && echo. && echo Backend:  http://localhost:4000 && echo Frontend: http://localhost:3000 && echo LLM:      http://localhost:8081 && echo. && echo Close these windows to stop services."

echo All services starting in separate windows.
echo.
echo Close the windows to stop services.
echo.
