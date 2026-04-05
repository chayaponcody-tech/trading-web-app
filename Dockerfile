# ─── Multi-Stage Dockerfile for CryptoSmartTrade ──────────────────────────────

# 1. BUILDER STAGE: ติดตั้ง dependencies และ build ทุกอย่าง
FROM node:23-alpine AS builder
RUN apk add --no-cache python3 make g++ 
WORKDIR /app
COPY package*.json ./
COPY packages/ai-agents/package*.json ./packages/ai-agents/
COPY packages/api-gateway/package*.json ./packages/api-gateway/
COPY packages/bot-engine/package*.json ./packages/bot-engine/
COPY packages/data-layer/package*.json ./packages/data-layer/
COPY packages/exchange-connector/package*.json ./packages/exchange-connector/
COPY packages/shared/package*.json ./packages/shared/

RUN npm install
COPY . .
RUN npm run build

# 2. BACKEND RUNTIME: สำหรับรัน Node.js API
FROM node:23-alpine AS backend-runtime
RUN apk add --no-cache python3 make g++ 
WORKDIR /app
COPY --from=builder /app /app
ENV PORT=4001
ENV NODE_ENV=production
EXPOSE 4001
CMD ["npm", "run", "backend"]

# 3. FRONTEND RUNTIME: สำหรับรัน Nginx เสิร์ฟไฟล์คงที่ (Static)
FROM nginx:alpine AS frontend-runtime
COPY --from=builder /app/dist /usr/share/nginx/html
# เพิ่มการตั้งค่า Nginx ให้รองรับ React Router (ถ้ามี)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    # Forward API requests to the backend container \
    location /api { \
        proxy_pass http://backend:4001; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
