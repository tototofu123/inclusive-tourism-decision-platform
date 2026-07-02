param(
  [string]$Api = "http://localhost:4000",
  [switch]$KeepSession
)

$ErrorActionPreference = "Stop"
$ok = 0; $fail = 0
$colors = @{ok="Green";fail="Red";info="Yellow"}

function Log($msg, $color="info") { Write-Host "[$(Get-Date -Format HH:mm:ss)] $msg" -ForegroundColor $colors[$color] }

function Wait-Result($processId, $timeout = 120) {
  $elapsed = 0
  while ($elapsed -lt $timeout) {
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5
    try {
      $r = Invoke-RestMethod -Uri "$Api/chat/status/$processId" -TimeoutSec 5
      if ($r.done) { return $r }
    } catch { Write-Host "  (poll error: $($_.Exception.Message))" -ForegroundColor DarkGray }
    }
  }
  return $null
}

function Test-Tool($name, $text, $expectedTool, $itineraryId = $null) {
  Log "  Testing: $text" "info"
  try {
    $body = @{ text = $text; itineraryId = $itineraryId; sessionId = $sessionId }
    $start = Invoke-RestMethod -Uri "$Api/chat" -Method Post -Body ($body | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    if (-not $start.processId) { throw "No processId" }
    $result = Wait-Result -processId $start.processId -timeout 150
    if (-not $result) { throw "Timed out" }
    if ($result.error) { throw $result.error }

    $response = if ($result.result) { $result.result.response } else { $result.response }
    if (-not $response) { throw "No response text" }

    Log "    ✓ `"$($response.Substring(0, [Math]::Min(80, $response.Length)))...`"" "ok"
    $script:ok++
    return $result.result
  } catch {
    Log "    ✗ $($_.Exception.Message)" "fail"
    $script:fail++
    return $null
  }
}

function Test-NoTool($name, $text) {
  Log "  Testing: $text (expect no tool call)" "info"
  try {
    $body = @{ text = $text; itineraryId = $null; sessionId = $sessionId }
    $start = Invoke-RestMethod -Uri "$Api/chat" -Method Post -Body ($body | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    if (-not $start.processId) { throw "No processId" }
    $result = Wait-Result -processId $start.processId -timeout 60
    if (-not $result) { throw "Timed out" }
    if ($result.error) { throw $result.error }

    $response = if ($result.result) { $result.result.response } else { $result.response }
    if (-not $response) { throw "No response" }
    Log "    ✓ `"$($response.Substring(0, [Math]::Min(80, $response.Length)))...`"" "ok"
    $script:ok++
  } catch {
    Log "    ✗ $($_.Exception.Message)" "fail"
    $script:fail++
  }
}

# ── Main ──
Log "=== Tool Calling Tests ===" "info"

# 1. Create session
try {
  $session = Invoke-RestMethod -Uri "$Api/sessions" -Method Post -Body '{}' -ContentType "application/json" -TimeoutSec 5
  $script:sessionId = $session.id
  Log "Session #$sessionId created" "ok"
  $ok++
} catch { Log "Failed to create session: $($_.Exception.Message)" "fail"; $fail++; exit 1 }

# 2. No tool call (direct Q&A)
Log ""; Log "── No tool call ──" "info"
Test-NoTool "greeting" "hello, what can you help me with?"
Test-NoTool "about_kowloon" "tell me about kowloon"

# 3. Single tool calls
Log ""; Log "── Single tool calls ──" "info"
Test-Tool "search_places" "find museums in kowloon" "search_places"
Test-Tool "create_itinerary" "plan a 1 day trip to visit museums and parks" "create_itinerary"
Test-Tool "list_itineraries" "what itineraries do i have" "list_itineraries"
Test-Tool "get_itinerary" "show me itinerary 1" "get_itinerary" 1
Test-Tool "check_accessibility" "is the museum accessible" "check_accessibility"
Test-Tool "route_distance" "how far is it from tsim sha tsui to mong kok walking" "route_distance"

# 4. Edit itinerary (needs itinerary id)
Log ""; Log "── Edit itinerary ──" "info"
Test-Tool "edit_itinerary" "remove the last stop from my itinerary" "edit_itinerary" 1

# 5. Transport
Log ""; Log "── Transport ──" "info"
Test-Tool "find_transport" "how do i get from tsim sha tsui to diamond hill" "find_transport"
Test-Tool "get_travel_time" "what is the travel time from tst to mong kok by walking" "get_travel_time"

# 6. Delete
Log ""; Log "── Delete itinerary ──" "info"
Test-Tool "delete_itinerary" "delete itinerary 99" "delete_itinerary" 99

# 7. Place alternatives
Log ""; Log "── Place alternatives ──" "info"
Test-Tool "get_place_alternatives" "what else can i do instead of the museum" "get_place_alternatives"

# 8. Summary
Log ""; Log "═══ Results ═══" "info"
$total = $ok + $fail
$resultColor = if ($fail -eq 0) { "ok" } else { "fail" }
Log "Passed: $ok / $total" $resultColor
Log "Failed: $fail / $total" $resultColor
if ($fail -gt 0) { exit 1 }
