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
echo Windows Terminal will open with 4 tabs:
echo   1. Backend  (port 4000)
echo   2. Frontend (port 3000)
echo   3. LLM      (port 8081)
echo   4. Console
echo.

if not exist "%LLAMA_EXE%" echo [WARN] llama-server.exe not found. LLM tab will need manual start.
if "%MODEL_FILE%"=="" echo [WARN] No .gguf model found. LLM tab will need manual start.
echo.

powershell -noprofile -command ^
  $root = '%CD%'; ^
  $beDir = join-path $root 'backend'; ^
  $feDir = join-path $root 'frontend'; ^
  $wt = if (Get-Command wt -ErrorAction SilentlyContinue) { 'wt' } else { $null }; ^
  if (-not $wt) { Write-Host '[FAIL] Windows Terminal not found. Install from MS Store.' -Fore Red; exit 1 }; ^
  $llamaExe = '%LLAMA_EXE%'; ^
  $modelFile = '%MODEL_FILE%'; ^
  if (($llamaExe -ne '') -and ($modelFile -ne '')) { ^
    & $wt --title 'Backend (4000)' -d "$beDir" cmd /k "npx tsx src/index.ts" `; ^
         new-tab --title 'Frontend (3000)' -d "$feDir" cmd /k "npx next dev -p 3000" `; ^
         new-tab --title 'LLM (8081)' -d "$root" cmd /k ""%LLAMA_EXE%" -m "%MODEL_FILE%" --port 8081 -ngl 99" `; ^
         new-tab --title 'Console' -d "$beDir" cmd /k "echo Inclusive Tourism MVP && echo Backend:4000 Frontend:3000 LLM:8081 && echo. && echo Press Ctrl+C in each tab to stop" ^
  } else { ^
    & $wt --title 'Backend (4000)' -d "$beDir" cmd /k "npx tsx src/index.ts" `; ^
         new-tab --title 'Frontend (3000)' -d "$feDir" cmd /k "npx next dev -p 3000" `; ^
         new-tab --title 'LLM (8081)' -d "$root" cmd /k "echo LLM skipped - no model found. Run llama-server manually on port 8081." `; ^
         new-tab --title 'Console' -d "$beDir" cmd /k "echo Inclusive Tourism MVP && echo Backend:4000 Frontend:3000 LLM:8081 && echo. && echo Press Ctrl+C in each tab to stop" ^
  }

if %errorlevel% neq 0 (
  echo [FAILED] Could not start Windows Terminal.
  pause
)
