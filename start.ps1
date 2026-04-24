# start.ps1 — Manage grouped services with start/stop/restart/status
# Usage examples:
#   .\start.ps1 start all
#   .\start.ps1 start core
#   .\start.ps1 stop ai
#   .\start.ps1 status polymarket

param(
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action = "start",
    [ValidateSet("all", "core", "ai", "polymarket")]
    [string]$Group = "all"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$stateDir = Join-Path $root ".runtime"
$stateFile = Join-Path $stateDir "start-state.json"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

$services = @(
    @{
        Name = "core"
        Display = "API Gateway + Frontend"
        Ports = @(4000, 4001)
        Ready = @("http://localhost:4001/api-docs", "http://localhost:4000")
        FilePath = "cmd.exe"
        Args = @("/c", "npm run start")
    },
    @{
        Name = "strategy-ai"
        Display = "Strategy AI"
        Ports = @(8000)
        Ready = @("http://localhost:8000/health")
        FilePath = "powershell.exe"
        Args = @("-ExecutionPolicy", "Bypass", "-File", ".\scripts\run-strategy-ai.ps1")
    },
    @{
        Name = "quant-engine"
        Display = "Quant Engine"
        Ports = @(8002)
        Ready = @("http://localhost:8002/docs")
        FilePath = "powershell.exe"
        Args = @("-ExecutionPolicy", "Bypass", "-File", ".\scripts\run-quant-engine.ps1")
    },
    @{
        Name = "polymarket-dashboard"
        Display = "Polymarket Dashboard"
        Ports = @(8080)
        Ready = @("http://localhost:8080/api/system_status")
        FilePath = "powershell.exe"
        Args = @("-ExecutionPolicy", "Bypass", "-File", ".\scripts\run-polymarket-dashboard.ps1")
    },
    @{
        Name = "polymarket-agent"
        Display = "Polymarket Agent"
        Ports = @()
        Ready = @()
        FilePath = "powershell.exe"
        Args = @("-ExecutionPolicy", "Bypass", "-File", ".\scripts\run-polymarket-agent.ps1")
    }
)

$groups = @{
    core = @("core")
    ai = @("strategy-ai", "quant-engine")
    polymarket = @("polymarket-dashboard", "polymarket-agent")
    all = @("core", "strategy-ai", "quant-engine", "polymarket-dashboard", "polymarket-agent")
}

function Ensure-StateDir {
    if (-not (Test-Path $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir | Out-Null
    }
}

function Load-State {
    if (-not (Test-Path $stateFile)) { return @{} }
    try {
        $raw = Get-Content -Path $stateFile -Raw | ConvertFrom-Json -AsHashtable
        if ($null -eq $raw) { return @{} }
        return $raw
    } catch {
        return @{}
    }
}

function Save-State([hashtable]$state) {
    Ensure-StateDir
    ($state | ConvertTo-Json -Depth 5) | Set-Content -Path $stateFile -Encoding UTF8
}

function Get-PortOwners([int[]]$Ports) {
    if (-not $Ports -or $Ports.Count -eq 0) { return @() }
    $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $Ports -contains $_.LocalPort }
    if (-not $listeners) { return @() }
    $listeners | Select-Object LocalPort, OwningProcess -Unique
}

function Wait-HttpReady([string]$Url, [string]$Name, [int]$TimeoutSeconds = 30) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = & curl.exe --silent --show-error --output NUL --write-out "%{http_code}" --max-time 2 $Url
            if ($LASTEXITCODE -eq 0 -and [int]$response -ge 200 -and [int]$response -lt 500) {
                Write-Host "  [OK] $Name ready at $Url" -ForegroundColor Green
                return
            }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    Write-Host "  [WARN] $Name not ready within ${TimeoutSeconds}s ($Url)" -ForegroundColor Yellow
}

function Start-ServiceGroup([string[]]$names) {
    $state = Load-State
    $selected = $services | Where-Object { $names -contains $_.Name }
    $ports = @($selected | ForEach-Object { $_.Ports } | Select-Object -Unique)
    $busy = Get-PortOwners -Ports $ports
    if ($busy.Count -gt 0) {
        Write-Host "Cannot start. Required ports are in use:" -ForegroundColor Red
        foreach ($entry in $busy) {
            $proc = Get-Process -Id $entry.OwningProcess -ErrorAction SilentlyContinue
            $name = if ($proc) { $proc.ProcessName } else { "Unknown" }
            Write-Host "  Port $($entry.LocalPort): PID $($entry.OwningProcess) ($name)" -ForegroundColor Yellow
        }
        exit 1
    }

    foreach ($svc in $selected) {
        Write-Host "Starting $($svc.Display)..." -ForegroundColor Cyan
        $proc = Start-Process -FilePath $svc.FilePath `
            -ArgumentList $svc.Args `
            -WorkingDirectory $root `
            -PassThru -WindowStyle Hidden
        $state[$svc.Name] = @{
            pid = $proc.Id
            startedAt = (Get-Date).ToString("o")
        }
    }

    Save-State -state $state
    foreach ($svc in $selected) {
        foreach ($url in $svc.Ready) {
            Wait-HttpReady -Url $url -Name $svc.Display
        }
    }
}

function Stop-ServiceGroup([string[]]$names) {
    $state = Load-State
    $selected = $services | Where-Object { $names -contains $_.Name }

    foreach ($svc in $selected) {
        if ($state.ContainsKey($svc.Name)) {
            $procId = $state[$svc.Name].pid
            if ($procId) {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host "Stopped $($svc.Display) PID $procId" -ForegroundColor Yellow
            }
            $state.Remove($svc.Name) | Out-Null
        }
    }

    $ports = @($selected | ForEach-Object { $_.Ports } | Select-Object -Unique)
    $owners = Get-PortOwners -Ports $ports
    foreach ($entry in $owners) {
        Stop-Process -Id $entry.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "Killed PID $($entry.OwningProcess) on port $($entry.LocalPort)" -ForegroundColor Yellow
    }

    Save-State -state $state
}

function Show-Status([string[]]$names) {
    $state = Load-State
    $selected = $services | Where-Object { $names -contains $_.Name }
    foreach ($svc in $selected) {
        $procId = $null
        if ($state.ContainsKey($svc.Name)) { $procId = $state[$svc.Name].pid }
        $proc = if ($procId) { Get-Process -Id $procId -ErrorAction SilentlyContinue } else { $null }
        $status = if ($proc) { "running (PID $procId)" } else { "stopped" }
        Write-Host ("{0,-24} {1}" -f $svc.Display, $status) -ForegroundColor White
    }
}

$targetServices = $groups[$Group]

switch ($Action) {
    "start" {
        Start-ServiceGroup -names $targetServices
        Write-Host "Started group '$Group'." -ForegroundColor Green
    }
    "stop" {
        Stop-ServiceGroup -names $targetServices
        Write-Host "Stopped group '$Group'." -ForegroundColor Green
    }
    "restart" {
        Stop-ServiceGroup -names $targetServices
        Start-Sleep -Seconds 1
        Start-ServiceGroup -names $targetServices
        Write-Host "Restarted group '$Group'." -ForegroundColor Green
    }
    "status" {
        Show-Status -names $targetServices
    }
}
