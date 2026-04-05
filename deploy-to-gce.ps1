# ─── Configuration (กรุณาแก้ไขก่อนรัน) ──────────────────────────────────
$PROJECT_ID = "YOUR_GCP_PROJECT_ID"  # ตั้งค่า ID ของโปรเจกต์ GCP
$REGION = "asia-northeast1"         # เช่น asia-southeast1 (สิงคโปร์) หรือ asia-northeast1 (โตเกียว)
$REPO_NAME = "trading-app-repo"     # ชื่อ Artifact Registry Repository
$INSTANCE_NAME = "trading-instance"  # ชื่อ GCE VM
$ZONE = "asia-northeast1-a"          # Zone ของ VM

# ปลายทางใน Registry
$IMAGE_TAG_BACKEND = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/backend:latest"
$IMAGE_TAG_FRONTEND = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/frontend:latest"

Clear-Host
Write-Host "🚀 Starting Deployment Script for Crypto Trading App" -ForegroundColor Cyan
Write-Host "----------------------------------------------------"

# 1. ตรวจสอบการเข้าสู่ระบบ gcloud
$currentProject = gcloud config get-value project 2>$null
if ($currentProject -ne $PROJECT_ID) {
    Write-Host "⚠️ Setting gcloud project to $PROJECT_ID..." -ForegroundColor Yellow
    gcloud config set project $PROJECT_ID
}

# 2. Build และ Push Docker Images
Write-Host "`n📦 [1/4] Building Docker images..." -ForegroundColor Cyan

# Backend
Write-Host "--- Building Backend ---"
docker build --target backend-runtime -t $IMAGE_TAG_BACKEND .
if ($LASTEXITCODE -ne 0) { Write-Error "Backend Build Failed"; exit }
docker push $IMAGE_TAG_BACKEND

# Frontend
Write-Host "--- Building Frontend ---"
docker build --target frontend-runtime -t $IMAGE_TAG_FRONTEND .
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend Build Failed"; exit }
docker push $IMAGE_TAG_FRONTEND

# 3. เตรียมไฟล์สำหรับการจัดการบน Server (Database & Config)
Write-Host "`n📄 [2/4] Preparing production docker-compose..." -ForegroundColor Cyan

$composeProd = @(
    "services:",
    "  backend:",
    "    image: $IMAGE_TAG_BACKEND",
    "    container_name: cryptosmarttrade-backend",
    "    ports:",
    "      - `"4001:4001`"",
    "    environment:",
    "      - NODE_ENV=production",
    "      - PORT=4001",
    "    volumes:",
    "      - ./trading_app.db:/app/trading_app.db",
    "      - ./binance-config.json:/app/binance-config.json",
    "      - ./paper-trading-db.json:/app/paper-trading-db.json",
    "      - ./forward-bots-db.json:/app/forward-bots-db.json",
    "      - ./trade-memory.json:/app/trade-memory.json",
    "    restart: unless-stopped",
    "",
    "  frontend:",
    "    image: $IMAGE_TAG_FRONTEND",
    "    container_name: cryptosmarttrade-frontend",
    "    ports:",
    "      - `"4000:80`"",
    "    depends_on:",
    "      - backend",
    "    restart: unless-stopped"
) -join "`n"

$composeProd | Set-Content -Path "docker-compose.prod.yml"

# 4. Upload ข้อมูลทั้งหมดขึ้น GCE (รวม Database)
Write-Host "`n📤 [3/4] Uploading files to GCE ($INSTANCE_NAME)..." -ForegroundColor Cyan

# สร้างโฟลเดอร์บน server ถ้ายังไม่มี
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="mkdir -p ~/trading-app"

# รายชื่อไฟล์ที่ต้องการอัพโหลด (Database + Config + Compose)
$filesToUpload = @(
    "docker-compose.prod.yml",
    "binance-config.json",
    "trading_app.db",
    "paper-trading-db.json",
    "forward-bots-db.json",
    "trade-memory.json"
)

# ตรวจสอบว่าไฟล์มีอยู่จริงก่อนอัพโหลด
$existingFiles = $filesToUpload | Where-Object { Test-Path $_ }

if ($existingFiles.Count -gt 0) {
    gcloud compute scp $existingFiles "${INSTANCE_NAME}:~/trading-app/" --zone=$ZONE
} else {
    Write-Warning "No database or config files found to upload. Skipping file sync."
}

# 5. สั่ง Run บน Server
Write-Host "`n🔄 [4/4] Restarting Application on Server..." -ForegroundColor Cyan

$remoteCmd = "cd ~/trading-app && mv docker-compose.prod.yml docker-compose.yml && docker compose pull && docker compose up -d"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command=$remoteCmd

Write-Host "`n✅ Deployment Successful!" -ForegroundColor Green
Write-Host "🌐 Access UI at: http://<EXTERNAL_IP>:4000" -ForegroundColor White
