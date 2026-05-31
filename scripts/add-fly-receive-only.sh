#!/bin/bash
FLY_API="zCouLGY7aVrLVLwXcTQtSmTzkEwVr4EX"
MAC_DEV="NBMEPQC-PQYWCAS-VULT7PF-25HQ3UT-TIP7B5E-VTFQLOT-HE7KLEN-BQEXVQS"
FLY_DEV="MZVCWKS-ZP2TXCR-IP4KAZG-QJAPYK5-CQQSF4Y-NYK5XYI-NQHIBZP-MRULPA5"

# Ensure target dir exists
mkdir -p /app/store/obsidian-brain/.stfolder
chmod 755 /app/store/obsidian-brain

read -r -d '' PAYLOAD <<JSON
{
  "id": "obsidian-brain",
  "label": "Obsidian Brain",
  "path": "/app/store/obsidian-brain",
  "type": "receiveonly",
  "devices": [
    {"deviceID": "$FLY_DEV"},
    {"deviceID": "$MAC_DEV"}
  ],
  "fsWatcherEnabled": true,
  "rescanIntervalS": 3600,
  "ignorePerms": true
}
JSON

curl -s -X POST "http://localhost:8384/rest/config/folders" \
  -H "X-API-Key: $FLY_API" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "POST folder HTTP %{http_code}\n"

sleep 10
echo "=== Fly folder status ==="
curl -s "http://localhost:8384/rest/db/status?folder=obsidian-brain" -H "X-API-Key: $FLY_API" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("files:",d.get("globalFiles"),"localFiles:",d.get("localFiles"),"bytes:",d.get("globalBytes"),"state:",d.get("state"))'

echo "=== Actual files on disk ==="
ls -la /app/store/obsidian-brain/
