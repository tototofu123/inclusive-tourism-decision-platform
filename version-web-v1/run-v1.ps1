param(
  [switch]$SkipSeed,
  [switch]$SkipInstall
)

$REPO = Split-Path -Parent $PSScriptRoot
$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "Inclusive Tourism v1"

function Log($Msg) { Write-Host "[v1] $Msg" -ForegroundColor Cyan }

# === 1. Check / Start Supabase PostgreSQL (port 54322) ===
Log "Checking PostgreSQL (port 54322)..."
$pgRunning = $false
try {
  $conn = [System.Net.Sockets.TcpClient]::new()
  $conn.ConnectAsync("localhost", 54322).Wait(2000) | Out-Null
  $pgRunning = $conn.Connected
  $conn.Dispose()
} catch { $pgRunning = $false }

if (-not $pgRunning) {
  Log "PostgreSQL not running. Try: docker start supabase_db_hkust-app-test"
  Log "If container doesn't exist, run: docker run -d --name inclusive-pg-v1 -e POSTGRES_PASSWORD=postgres -p 54322:5432 pgvector/pgvector:pg16"
  exit 1
}
Log "PostgreSQL is running."

# === 2. Install deps ===
$Backend = "$PSScriptRoot\backend"
if (-not $SkipInstall) {
  Log "Installing backend dependencies..."
  Push-Location $Backend
  npm install --silent 2>&1 | Out-Null
  Pop-Location

  $Frontend = "$REPO\version-mvp-web\frontend"
  if (Test-Path "$Frontend\package.json") {
    Log "Installing frontend dependencies..."
    Push-Location $Frontend
    npm install --silent 2>&1 | Out-Null
    Pop-Location
  }
} else {
  Log "Skipping npm install."
}

# === 3. Seed database ===
if (-not $SkipSeed) {
  Log "Seeding database..."
  Push-Location $Backend
  node db/seed_v1.js 2>&1
  Pop-Location
}

# === 4. Start Backend (port 3001) ===
Log "Starting backend on port 3001..."
$beJob = Start-Job -Name "v1-backend" -ScriptBlock {
  param($Dir) Set-Location $Dir; node server.js
} -ArgumentList $Backend
Start-Sleep 3

# Verify backend
try {
  $h = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 5
  Log "Backend OK — version $($h.version)"
} catch {
  Log "WARNING: Backend not responding yet. Check for errors above."
}

# === 5. Start Frontend (port 3000) ===
$FrontendDir = "$REPO\version-mvp-web\frontend"
if (Test-Path "$FrontendDir\package.json") {
  # Ensure .env.local exists
  if (-not (Test-Path "$FrontendDir\.env.local")) {
    Set-Content -Path "$FrontendDir\.env.local" -Value "NEXT_PUBLIC_API_URL=http://localhost:3001"
  }
  Log "Starting frontend on port 3000..."
  $feJob = Start-Job -Name "v1-frontend" -ScriptBlock {
    param($Dir) Set-Location $Dir; npx next dev -p 3000
  } -ArgumentList $FrontendDir
  Start-Sleep 5
} else {
  Log "Frontend directory not found at $FrontendDir"
  $feJob = $null
}

# === Summary ===
Log "=== v1 Stack Running ==="
Log "  Frontend: http://localhost:3000"
Log "  Backend:  http://localhost:3001/api/places"
Log "  Health:   http://localhost:3001/health"
Log "  Database: PostgreSQL 17 on localhost:54322/inclusive_tourism_v1"
Log "  LLM:      $((Get-Content "$Backend\.env" -ErrorAction SilentlyContinue | Select-String "LLAMA_BASE_URL" | ForEach-Object { $_ -replace '.*=' ,'' }) -or 'http://localhost:8080 (optional)')"
Log ""
Log "Press Ctrl+C to stop all services."

try {
  # Wait for either job to finish
  while ($true) {
    Start-Sleep 10
    if ($beJob.State -eq "Failed") {
      $msg = Receive-Job $beJob -ErrorAction SilentlyContinue
      Log "Backend job failed: $msg"
      break
    }
  }
} finally {
  Log "Stopping services..."
  Stop-Job $beJob -ErrorAction SilentlyContinue
  if ($feJob) { Stop-Job $feJob -ErrorAction SilentlyContinue }
  Remove-Job $beJob -Force -ErrorAction SilentlyContinue
  if ($feJob) { Remove-Job $feJob -Force -ErrorAction SilentlyContinue }
  Log "Stopped."
}
