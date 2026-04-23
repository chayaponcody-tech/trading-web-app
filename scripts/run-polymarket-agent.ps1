$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$workdir = Join-Path $root "polymarket\polymarket_agent"
$venvPython = Join-Path $workdir ".venv\Scripts\python.exe"
$pythonExe = if (Test-Path $venvPython) { $venvPython } else { "python" }
$extraArgs = @()

if ($env:POLYMARKET_AGENT_ARGS) {
    $extraArgs = $env:POLYMARKET_AGENT_ARGS -split " "
}

Set-Location $workdir
& $pythonExe main.py @extraArgs
