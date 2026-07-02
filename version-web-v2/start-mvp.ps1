# Start MVP - Inclusive Tourism Platform
Write-Host "=== Starting Inclusive Tourism MVP ===" -ForegroundColor Green

# Check if llama-server is running
$llamaPort = netstat -ano | Select-String ":8081"
if (-not $llamaPort) {
    Write-Host "Starting llama.cpp server..." -ForegroundColor Yellow
    $modelPath = "$env:USERPROFILE\.llama\models\Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf"
    if (Test-Path $modelPath) {
        Start-Process -NoNewWindow -PassThru "C:\Users\totot\AppData\Local\Microsoft\WinGet\Packages\ggml.llamacpp_Microsoft.Winget.Source_8wekyb3d8bbwe\llama-server.exe" -ArgumentList "-m", "`"$modelPath`"", "--port", "8081", "-c", "4096", "--temp", "0.1", "-ngl", "35"
        Write-Host "  llama.cpp started on port 8081" -ForegroundColor Green
    } else {
        Write-Host "  No GGUF model found at $modelPath - LLM fallback will be used" -ForegroundColor Yellow
    }
} else {
    Write-Host "  llama.cpp already running on port 8081" -ForegroundColor Green
}

# Start backend
Write-Host "Starting backend (port 4000)..." -ForegroundColor Yellow
$be = Start-Job -Name mvp-be { Set-Location $args[0]; npx tsx src/index.ts } -ArgumentList (Join-Path $PSScriptRoot "backend")
Start-Sleep 4
Write-Host "  Backend started" -ForegroundColor Green

# Start frontend
Write-Host "Starting frontend (port 3000)..." -ForegroundColor Yellow
$fe = Start-Job -Name mvp-fe { Set-Location $args[0]; npx next dev -p 3000 } -ArgumentList (Join-Path $PSScriptRoot "frontend")
Start-Sleep 4

Write-Host ""
Write-Host "=== MVP is running ===" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:4000" -ForegroundColor Cyan
Write-Host "  Health:   http://localhost:4000/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop: Get-Job | Remove-Job -Force" -ForegroundColor Yellow
