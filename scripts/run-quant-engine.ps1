$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$workdir = Join-Path $root "packages\quant-engine"
$strategyVenv = Join-Path $root "packages\strategy-ai\venv\Scripts\python.exe"
$quantVenv = Join-Path $workdir ".venv\Scripts\python.exe"

if (Test-Path $quantVenv) {
    $pythonExe = $quantVenv
} elseif (Test-Path $strategyVenv) {
    $pythonExe = $strategyVenv
} else {
    $pythonExe = "python"
}

Set-Location $workdir
& $pythonExe -m uvicorn main:app --host 0.0.0.0 --port 8002
