@echo off
title Inclusive Tourism MVP - Dev Server
cd /d "%~dp0"

:: Kill zombie port 4000
>nul 2>&1 powershell -noprofile -c "$p=netstat -ano|findstr ':4000'|findstr LISTEN; if($p){$pid=(-1split$p)[-1];Stop-Process -Id $pid -Force}"

echo.
echo === Starting Inclusive Tourism MVP (Windows Terminal Tabs) ===
echo.
echo The Windows Terminal will open with 4 tabs:
echo   1. Backend  (port 4000) - npx tsx backend/src/index.ts
echo   2. Frontend (port 3000) - npm run dev
echo   3. LLM      (port 8081) - llama-server (if found)
echo   4. Console  - service status
echo.
echo If Windows Terminal doesn't open, install it from MS Store.
echo.

powershell -noprofile -command ^
  $root = '%CD%'; ^
  $wt = if (Get-Command wt -ErrorAction SilentlyContinue) { 'wt' } else { $null }; ^
  if (-not $wt) { Write-Host '[FAIL] Windows Terminal not found.' -Fore Red; exit 1 }; ^
  & $wt --title 'Backend (4000)' -d "$root\backend" cmd /k "npx tsx src/index.ts" `; ^
       new-tab --title 'Frontend (3000)' -d "$root\frontend" cmd /k "npx next dev -p 3000" `; ^
       new-tab --title 'LLM (8081)' -d "$root" cmd /k "echo LLM: start llama-server manually if needed && echo." `; ^
       new-tab --title 'Console' -d "$root" cmd /k "echo Inclusive Tourism MVP && echo Backend:4000 Frontend:3000 LLM:8081 && echo. && echo Press Ctrl+C in each tab to stop"

if %errorlevel% neq 0 (
  echo.
  echo [FAILED] Could not start Windows Terminal.
  echo Run start-mvp.cmd instead (single window, logs hidden).
  pause
)
