# start.ps1 — Start all services (Node.js + Python strategy-ai)
# Usage: .\start.ps1

$root = $PSScriptRoot

Write-Host "Starting strategy-ai (Python)..." -ForegroundColor Cyan
$pythonExe = "$root\packages\strategy-ai\venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
    Write-Host "  [WARN] venv not found, using system python" -ForegroundColor Yellow
}
$python = Start-Process -FilePath $pythonExe `
    -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload" `
    -WorkingDirectory "$root\packages\strategy-ai" `
    -PassThru -NoNewWindow

Write-Host "Starting API Gateway + Vite (Node.js)..." -ForegroundColor Cyan
$node = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run start" `
    -WorkingDirectory "$root" `
    -PassThru -NoNewWindow

Write-Host ""
Write-Host "All services started:" -ForegroundColor Green
Write-Host "  Frontend   : http://localhost:4000" -ForegroundColor White
Write-Host "  API Gateway: http://localhost:4001" -ForegroundColor White
Write-Host "  Strategy AI: http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services..." -ForegroundColor Yellow

try {
    if ($node -and $node.Id) {
        Wait-Process -Id $node.Id
    } else {
        while ($true) { Start-Sleep -Seconds 5 }
    }
} finally {
    Write-Host "Stopping services..." -ForegroundColor Red
    if ($python -and $python.Id) { Stop-Process -Id $python.Id -ErrorAction SilentlyContinue }
    if ($node -and $node.Id)     { Stop-Process -Id $node.Id   -ErrorAction SilentlyContinue }
}
