# Uninstall all ClaudeClaw PM2 processes
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\uninstall-pm2.ps1

Write-Host "Uninstalling ClaudeClaw PM2 processes..." -ForegroundColor Cyan
Write-Host ""

# Delete main
cmd /c "pm2 delete main 2>nul" | Out-Null
if ($LASTEXITCODE -eq 0) { Write-Host "  Stopped main" }

# Delete all agent processes
$existing = cmd /c "pm2 jlist 2>nul" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d).forEach(p=>{if(p.name!=='main')console.log(p.name)})}catch{}})" 2>$null
if ($existing) {
    $existing -split "`n" | ForEach-Object {
        $name = $_.Trim()
        if ($name) {
            cmd /c "pm2 delete $name 2>nul" | Out-Null
            if ($LASTEXITCODE -eq 0) { Write-Host "  Stopped $name" }
        }
    }
}

# Save the updated process list
pm2 save 2>$null

# Remove auto-start scheduled task
$TaskName = "ClaudeClaw-PM2"
schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Removed auto-start task: $TaskName"
}

# Remove resurrect script
$ProjectDir = Split-Path -Parent $PSScriptRoot
$ResurrectScript = Join-Path $ProjectDir "scripts\pm2-resurrect.bat"
if (Test-Path $ResurrectScript) {
    Remove-Item $ResurrectScript -Force
    Write-Host "  Removed resurrect script"
}

Write-Host ""
Write-Host "All ClaudeClaw agents uninstalled." -ForegroundColor Green
