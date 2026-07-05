@echo off
title Inclusive Tourism V1
cd /d "%~dp0"

:: Kill zombie processes on our ports
>nul 2>&1 powershell -noprofile -c "$p=netstat -ano|findstr ':4000'|findstr LISTEN; if($p){$pid=(-1split$p)[-1];Stop-Process -Id $pid -Force}"

echo.
echo === Inclusive Tourism Decision Platform V1 ===
echo.
echo Opening 4 windows:
echo   1. LLM      (port 8081)
echo   2. Backend  (port 4000)
echo   3. Frontend (port 3000)
echo   4. Console
echo.

:: 1. LLM
set LLAMA_EXE=%USERPROFILE%\llama-b9247-bin-win-cuda-12.4-x64\llama-server.exe
set LLAMA_MODELS=%USERPROFILE%\.llama\models
set MODEL_FILE=%LLAMA_MODELS%\Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf
if exist "%LLAMA_EXE%" (
  if exist "%MODEL_FILE%" (
    start "LLM 8081" cmd /k ""%LLAMA_EXE%" -m "%MODEL_FILE%" --port 8081 -ngl 99 -c 8192"
  ) else (
    start "LLM 8081" cmd /k "echo Model not found: %MODEL_FILE% && pause"
  )
) else (
  start "LLM 8081" cmd /k "echo llama-server.exe not found && pause"
)
timeout /t 4 /nobreak >nul

:: 2. Backend
start "BE 4000" cmd /k "cd /d backend && npx tsx src/index.ts"
timeout /t 4 /nobreak >nul

:: 3. Frontend
start "FE 3000" cmd /k "cd /d frontend && npm run dev"
timeout /t 4 /nobreak >nul

:: 4. Console
start "V1 Console" cmd /k "echo Inclusive Tourism V1 && echo. && echo Backend:  http://localhost:4000 && echo Frontend: http://localhost:3000 && echo LLM:      http://localhost:8081 && echo. && echo Close these windows to stop services."

echo All services starting in separate windows.
echo Close the windows to stop.
echo.
