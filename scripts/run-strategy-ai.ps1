$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$workdir = Join-Path $root "packages\strategy-ai"
$venvPython = Join-Path $workdir "venv\Scripts\python.exe"
$pythonExe = if (Test-Path $venvPython) { $venvPython } else { "python" }

Set-Location $workdir
& $pythonExe -m uvicorn main:app --host 0.0.0.0 --port 8000
