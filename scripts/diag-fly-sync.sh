#!/bin/bash
FLY_API="zCouLGY7aVrLVLwXcTQtSmTzkEwVr4EX"

echo "=== Folder status (full) ==="
curl -s "http://localhost:8384/rest/db/status?folder=obsidian-brain" -H "X-API-Key: $FLY_API" | python3 -m json.tool

echo ""
echo "=== Folder config ==="
curl -s "http://localhost:8384/rest/config/folders/obsidian-brain" -H "X-API-Key: $FLY_API" | python3 -m json.tool | head -25

echo ""
echo "=== Recent events ==="
curl -s "http://localhost:8384/rest/events?since=0&limit=20" -H "X-API-Key: $FLY_API" 2>&1 | python3 -c '
import json, sys
events = json.load(sys.stdin)
for e in events[-15:]:
  print(e.get("type"), "-", e.get("data", {}).get("folder", ""), e.get("data", {}).get("error", "")[:120])
' 2>&1 | head -20

echo ""
echo "=== Trigger override (force pull from remote) ==="
curl -s -X POST "http://localhost:8384/rest/db/revert?folder=obsidian-brain" -H "X-API-Key: $FLY_API" -w "HTTP %{http_code}\n"

echo ""
echo "=== Sleep 8s, recheck ==="
sleep 8
curl -s "http://localhost:8384/rest/db/status?folder=obsidian-brain" -H "X-API-Key: $FLY_API" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("local:",d.get("localFiles"),"global:",d.get("globalFiles"),"need:",d.get("needFiles"),"state:",d.get("state"))'

echo "=== Files now ==="
ls -la /app/store/obsidian-brain/
