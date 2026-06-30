param(
  [switch]$ForceRecreate
)

$CONTAINER = "inclusive-pg-v1"
$PORT = 54325
$PASSWORD = "postgres"
$IMAGE = "pgvector/pgvector:pg16"

function Log($Msg) { Write-Host "[docker] $Msg" -ForegroundColor Cyan }

# Check if Docker is running
try {
  docker ps -q 2>&1 | Out-Null
} catch {
  Log "ERROR: Docker is not running. Start Docker Desktop first."
  exit 1
}

# Check if our container already exists
$existing = docker ps -a --filter "name=$CONTAINER" --format "{{.Names}}" 2>&1

if ($existing -eq $CONTAINER) {
  $running = docker ps --filter "name=$CONTAINER" --format "{{.Names}}" 2>&1
  if ($running -eq $CONTAINER) {
    Log "Container $CONTAINER is already running on port $PORT."
    if ($ForceRecreate) {
      Log "ForceRecreate: stopping and removing..."
      docker stop $CONTAINER 2>&1 | Out-Null
      docker rm $CONTAINER 2>&1 | Out-Null
    } else {
      return
    }
  } else {
    Log "Container $CONTAINER exists but is stopped. Starting..."
    docker start $CONTAINER 2>&1 | Out-Null
    Start-Sleep 3
    return
  }
}

# Pull image if needed
Log "Pulling $IMAGE..."
docker pull $IMAGE 2>&1 | Out-Null

# Create and start container
Log "Creating PostgreSQL 17 + pgvector container on port $PORT..."
docker run -d `
  --name $CONTAINER `
  -e POSTGRES_PASSWORD=$PASSWORD `
  -p ${PORT}:5432 `
  $IMAGE 2>&1 | Out-Null

# Wait for PG to be ready
Log "Waiting for PostgreSQL to be ready..."
$ready = $false
for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep 2
  try {
    $c = [System.Net.Sockets.TcpClient]::new()
    $c.ConnectAsync("localhost", $PORT).Wait(1000) | Out-Null
    if ($c.Connected) { $ready = $true; $c.Dispose(); break }
    $c.Dispose()
  } catch {}
}
if (-not $ready) {
  Log "ERROR: PostgreSQL did not start within 30s."
  docker logs $CONTAINER 2>&1 | Select-Object -Last 5
  exit 1
}

Log "PostgreSQL is ready on localhost:$PORT."

# Create our database and enable pgvector
Log "Creating database inclusive_tourism_v1..."
docker exec -i $CONTAINER psql -U postgres -c "CREATE DATABASE inclusive_tourism_v1" 2>$null
docker exec -i $CONTAINER psql -U postgres -d inclusive_tourism_v1 -c "CREATE EXTENSION IF NOT EXISTS vector" 2>$null

Log "Connection: postgresql://postgres:$PASSWORD@localhost:$PORT/inclusive_tourism_v1"
Log "Container: $CONTAINER"
