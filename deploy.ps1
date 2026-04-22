# 1. Define destination
$destination = "trading_app_source.zip"

# 2. Exclude list
$excludeList = @(
    "node_modules", 
    "dist", 
    ".git", 
    "__pycache__", 
    "venv", 
    ".next",
    ".idea",
    ".vscode",
    "trading_app.db-wal",
    "trading_app.db-shm",
    "trading_app_source.zip",
    "deploy.ps1",
    "pack-project.ps1"
)

Write-Host "--- Starting to package project (Minimal Size) ---" -ForegroundColor Cyan

# 3. Remove old zip
if (Test-Path $destination) {
    Write-Host "Cleaning old zip file..." -ForegroundColor Yellow
    Remove-Item $destination
}

# 4. Compress
Write-Host "Compressing files... (Please wait)" -ForegroundColor White
Get-ChildItem -Path . -Exclude $excludeList | Compress-Archive -DestinationPath $destination

# 5. Result
if (Test-Path $destination) {
    $size = (Get-Item $destination).Length / 1MB
    Write-Host "Successfully Created: $destination" -ForegroundColor Green
    Write-Host "Total Size: $([Math]::Round($size, 2)) MB" -ForegroundColor Green
} else {
    Write-Host "Error: Could not create zip file." -ForegroundColor Red
}
