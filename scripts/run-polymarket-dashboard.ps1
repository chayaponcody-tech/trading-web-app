$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$workdir = Join-Path $root "polymarket\polymarket_agent"
$venvPython = Join-Path $workdir ".venv\Scripts\python.exe"
$pythonExe = if (Test-Path $venvPython) { $venvPython } else { "python" }

Set-Location $workdir
& $pythonExe -m uvicorn api_server:app --host 0.0.0.0 --port 8080
