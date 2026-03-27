# Install ClaudeClaw agents as PM2 processes for auto-start + auto-restart on crash
# Auto-discovers agents from agents/ and config directories.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\install-pm2.ps1

$ProjectDir = Split-Path -Parent $PSScriptRoot
if (-not $ProjectDir) { $ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path) }
$LogDir = Join-Path $ProjectDir "logs"

Write-Host "ClaudeClaw PM2 installer" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# ── Preflight checks ────────────────────────────────────────────────────────

# Check pm2
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: pm2 not found." -ForegroundColor Red
    Write-Host "Install it: npm install -g pm2"
    exit 1
}

# Check node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: node not found in PATH." -ForegroundColor Red
    exit 1
}

Write-Host "Node:     $($(Get-Command node).Source)"
Write-Host "PM2:      $($(Get-Command pm2).Source)"
Write-Host "Project:  $ProjectDir"
Write-Host ""

# ── Ensure logs directory exists ────────────────────────────────────────────

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

# ── Discover agents ─────────────────────────────────────────────────────────

$Agents = @()
$AgentsDir = Join-Path $ProjectDir "agents"

if (Test-Path $AgentsDir) {
    Get-ChildItem -Path $AgentsDir -Directory | ForEach-Object {
        if ($_.Name -eq "_template") { return }
        if (Test-Path (Join-Path $_.FullName "agent.yaml")) {
            $Agents += $_.Name
        }
    }
}

# Also check external config directory
$ConfigDir = if ($env:CLAUDECLAW_CONFIG) { $env:CLAUDECLAW_CONFIG } else { Join-Path $HOME ".claudeclaw" }
$ConfigAgentsDir = Join-Path $ConfigDir "agents"

if (Test-Path $ConfigAgentsDir) {
    Get-ChildItem -Path $ConfigAgentsDir -Directory | ForEach-Object {
        if ($_.Name -eq "_template") { return }
        if ($Agents -contains $_.Name) { return }
        if (Test-Path (Join-Path $_.FullName "agent.yaml")) {
            $Agents += $_.Name
        }
    }
}

Write-Host "Discovered agents: $($Agents -join ', ')"
Write-Host ""

# ── Build the project ───────────────────────────────────────────────────────

Write-Host "Building project..."
Push-Location $ProjectDir
npm run build
Pop-Location
Write-Host "Build complete."
Write-Host ""

# ── Stop and delete existing ClaudeClaw processes ───────────────────────────

Write-Host "Cleaning up existing processes..."
cmd /c "pm2 delete main 2>nul" | Out-Null
$existing = cmd /c "pm2 jlist 2>nul" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d).forEach(p=>{if(p.name!=='main')console.log(p.name)})}catch{}})" 2>$null
if ($existing) {
    $existing -split "`n" | ForEach-Object {
        $name = $_.Trim()
        if ($name) { cmd /c "pm2 delete $name 2>nul" | Out-Null }
    }
}
Write-Host ""

# ── Start main bot ──────────────────────────────────────────────────────────

$mainLog = Join-Path $LogDir "main.log"

Write-Host "Starting main..."
pm2 start dist/index.js `
    --name main `
    --cwd $ProjectDir `
    --output $mainLog `
    --error $mainLog `
    --merge-logs `
    --restart-delay 30000

# ── Start each discovered agent ─────────────────────────────────────────────

foreach ($agentId in $Agents) {
    $processName = "$agentId"
    $agentLog = Join-Path $LogDir "$agentId.log"

    Write-Host "Starting $processName..."
    cmd /c "pm2 start dist/index.js --name $processName --cwd `"$ProjectDir`" --output `"$agentLog`" --error `"$agentLog`" --merge-logs --restart-delay 30000 -- --agent $agentId"
}

# ── Save PM2 process list ───────────────────────────────────────────────────

Write-Host ""
Write-Host "Saving PM2 process list..."
pm2 save

# ── Auto-start on boot (Windows Task Scheduler) ───────────────────────────

Write-Host ""
Write-Host "Setting up auto-start on boot..."

$TaskName = "ClaudeClaw-PM2"
$PM2Path = (Get-Command pm2.cmd).Source

# Remove existing task if present
schtasks /Delete /TN $TaskName /F 2>$null | Out-Null

# Create a startup script that PM2 resurrect will run
$StartupScript = Join-Path $ProjectDir "scripts\pm2-resurrect.bat"
@"
@echo off
timeout /t 30 /nobreak >nul
"$PM2Path" resurrect
"@ | Set-Content -Path $StartupScript -Encoding ASCII

# Create scheduled task that runs at logon (hidden, no popup window)
$Action = New-ScheduledTaskAction -Execute $StartupScript
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null

# Verify task was created
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Write-Host "  Auto-start task created: $TaskName" -ForegroundColor Green
    Write-Host "  Agents will auto-resurrect 30s after login (waits for network)."
} else {
    Write-Host "  WARNING: Failed to create scheduled task." -ForegroundColor Red
    Write-Host "  Try running this script as Administrator."
}

# ── Verify ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Verifying..."
Start-Sleep -Seconds 2

$allOk = $true
$allProcesses = @("main") + ($Agents | ForEach-Object { "$_" })
$pm2Data = pm2 jlist 2>$null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d).forEach(p=>console.log(p.name+'|'+p.pm2_env.status+'|'+p.pid))}catch{}})" 2>$null

$processMap = @{}
if ($pm2Data) {
    $pm2Data -split "`n" | ForEach-Object {
        $parts = $_.Trim() -split '\|'
        if ($parts.Count -ge 3) {
            $processMap[$parts[0]] = @{ status = $parts[1]; pid = $parts[2] }
        }
    }
}

foreach ($name in $allProcesses) {
    if ($processMap.ContainsKey($name) -and $processMap[$name].status -eq "online") {
        Write-Host "  ${name}: running (PID: $($processMap[$name].pid))" -ForegroundColor Green
    } else {
        $state = if ($processMap.ContainsKey($name)) { $processMap[$name].status } else { "not found" }
        Write-Host "  ${name}: FAILED ($state)" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "All agents installed and running." -ForegroundColor Green
    Write-Host "Logs: $LogDir"
    Write-Host ""
    Write-Host "Useful commands:"
    Write-Host "  pm2 list                              # check status"
    Write-Host "  pm2 logs main                         # follow main bot logs"
    Write-Host "  pm2 restart all                       # restart everything"
    Write-Host "  powershell scripts\uninstall-pm2.ps1  # remove all agents"
} else {
    Write-Host "Some agents failed to start." -ForegroundColor Red
    Write-Host "Debug: pm2 logs --lines 50"
}
