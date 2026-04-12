# start.ps1 — Start all services (Node.js + Python strategy-ai)
# Usage: .\start.ps1

Write-Host "Starting strategy-ai (Python)..." -ForegroundColor Cyan
$python = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--reload" -WorkingDirectory "$PSScriptRoot\packages\strategy-ai" -PassThru -NoNewWindow

Write-Host "Starting API Gateway + Vite (Node.js)..." -ForegroundColor Cyan
$node = Start-Process -FilePath "npm" -ArgumentList "run", "start" -WorkingDirectory "$PSScriptRoot" -PassThru -NoNewWindow

Write-Host ""
Write-Host "All services started:" -ForegroundColor Green
Write-Host "  Frontend  : http://localhost:5173" -ForegroundColor White
Write-Host "  API Gateway: http://localhost:3000" -ForegroundColor White
Write-Host "  Strategy AI: http://localhost:8001" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services..." -ForegroundColor Yellow

try {
    Wait-Process -Id $node.Id
} finally {
    Write-Host "Stopping services..." -ForegroundColor Red
    Stop-Process -Id $python.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $node.Id -ErrorAction SilentlyContinue
}
