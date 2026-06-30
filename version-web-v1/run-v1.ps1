param(
  [switch]$SkipSeed,
  [switch]$SkipInstall,
  [switch]$SkipDocker
)

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "Inclusive Tourism v1"

function Log($Msg) { Write-Host "[v1] $Msg" -ForegroundColor Cyan }

# === 1. Docker PostgreSQL ===
if (-not $SkipDocker) {
  Log "Setting up PostgreSQL..."
  & "$PSScriptRoot\docker-setup.ps1"
  if ($LASTEXITCODE -ne 0) { exit 1 }
} else {
  Log "Skipping Docker setup."
}

# === 2. Ensure .env ===
$Backend = "$PSScriptRoot\backend"
if (-not (Test-Path "$Backend\.env")) {
  if (Test-Path "$Backend\.env.example") {
    Copy-Item "$Backend\.env.example" "$Backend\.env"
    Log "Created .env from .env.example"
  } else {
    Log "WARNING: No .env or .env.example found in backend/"
  }
}

# === 3. Install deps ===
if (-not $SkipInstall) {
  Log "Installing backend dependencies..."
  Push-Location $Backend
  npm install --silent 2>&1 | Out-Null
  Pop-Location

  $Frontend = "$PSScriptRoot\..\version-mvp-web\frontend"
  if (Test-Path "$Frontend\package.json") {
    Log "Installing frontend dependencies..."
    Push-Location $Frontend
    npm install --silent 2>&1 | Out-Null
    Pop-Location
  }
} else {
  Log "Skipping npm install."
}

# === 4. Ensure frontend .env.local ===
$FrontendDir = "$PSScriptRoot\..\version-mvp-web\frontend"
if (Test-Path "$FrontendDir\package.json") {
  $envFile = "$FrontendDir\.env.local"
  if (-not (Test-Path $envFile)) {
    Set-Content -Path $envFile -Value "NEXT_PUBLIC_API_URL=http://localhost:3001"
    Log "Created frontend .env.local"
  }
}

# === 5. Seed database ===
if (-not $SkipSeed) {
  Log "Seeding database..."
  Push-Location $Backend
  node db/seed_v1.js 2>&1
  Pop-Location
}

# === 6. Start Backend (port 3001) ===
Log "Starting backend on port 3001..."
$beJob = Start-Job -Name "v1-backend" -ScriptBlock {
  param($Dir) Set-Location $Dir; node server.js
} -ArgumentList $Backend
Start-Sleep 3

$beOk = $false
try {
  $h = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 5
  Log "Backend OK — $($h.version)"
  $beOk = $true
} catch {
  Log "WARNING: Backend not responding on port 3001."
  Log "Check for errors above, or the port may be in use."
}

# === 7. Start Frontend (port 3000) ===
$feJob = $null
if (Test-Path "$FrontendDir\package.json") {
  Log "Starting frontend on port 3000..."
  $feJob = Start-Job -Name "v1-frontend" -ScriptBlock {
    param($Dir) Set-Location $Dir; npx next dev -p 3000
  } -ArgumentList $FrontendDir
  Start-Sleep 5
} else {
  Log "Frontend directory not found."
}

# === 8. Summary ===
Log ""
Log "========================================"
Log "  v1 Stack Running"
Log "  Frontend: http://localhost:3000"
Log "  Backend:  http://localhost:3001/api/places"
Log "  Health:   http://localhost:3001/health"
Log "  DB:       localhost:54325 (pgvector/pgvector:pg16)"
Log "  LLM:      $(if ($beOk) { 'http://localhost:8080 (optional)' } else { 'Not started' })"
Log "========================================"
Log "Press Ctrl+C to stop."

try {
  while ($true) {
    Start-Sleep 10
    if ($beJob.State -eq "Failed") {
      $msg = Receive-Job $beJob -ErrorAction SilentlyContinue
      Log "Backend failed: $msg"
      break
    }
  }
} finally {
  Log "Stopping services..."
  Stop-Job $beJob -ErrorAction SilentlyContinue
  if ($feJob) { Stop-Job $feJob -ErrorAction SilentlyContinue; Remove-Job $feJob -Force }
  Remove-Job $beJob -Force
  Log "Stopped."
}
