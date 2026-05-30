#!/bin/bash
# One-shot: add Obsidian Brain folder share on the Fly side of Syncthing.
FLY_API="zCouLGY7aVrLVLwXcTQtSmTzkEwVr4EX"
MAC_DEV="NBMEPQC-PQYWCAS-VULT7PF-25HQ3UT-TIP7B5E-VTFQLOT-HE7KLEN-BQEXVQS"
FLY_DEV="MZVCWKS-ZP2TXCR-IP4KAZG-QJAPYK5-CQQSF4Y-NYK5XYI-NQHIBZP-MRULPA5"

mkdir -p /app/store/obsidian-brain/.stfolder
chmod 755 /app/store/obsidian-brain
echo "Target dir ready"

read -r -d '' PAYLOAD <<JSON
{
  "id": "obsidian-brain",
  "label": "Obsidian Brain",
  "path": "/app/store/obsidian-brain",
  "type": "sendreceive",
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

sleep 3
echo "=== Folders on Fly ==="
curl -s "http://localhost:8384/rest/config/folders" -H "X-API-Key: $FLY_API" \
  | python3 -c 'import json,sys; [print(f["id"], "->", f["path"]) for f in json.load(sys.stdin)]'

curl -s -X POST "http://localhost:8384/rest/db/scan?folder=obsidian-brain" -H "X-API-Key: $FLY_API" -w "scan HTTP %{http_code}\n"

sleep 8
curl -s "http://localhost:8384/rest/db/status?folder=obsidian-brain" -H "X-API-Key: $FLY_API" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("files:",d.get("globalFiles"),"bytes:",d.get("globalBytes"),"state:",d.get("state"),"errors:",d.get("errors"))'
