# ─── Multi-Stage Dockerfile for CryptoSmartTrade ─────────────────────────────

# --- BUILD STAGE 1 (Dependencies & Build) ---
FROM node:23-alpine AS builder

# Install build dependencies for better-sqlite3 (python, make, g++)
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# Copy root configurations
COPY package*.json ./
COPY packages/api-gateway/package*.json ./packages/api-gateway/
COPY packages/bot-engine/package*.json ./packages/bot-engine/
COPY packages/data-layer/package*.json ./packages/data-layer/
COPY packages/exchange-connector/package*.json ./packages/exchange-connector/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies (using workspaces)
RUN npm install

# Copy source code
COPY . .

# Build frontend & packages
RUN npm run build

# --- RUN STAGE 2 (Production Server) ---
FROM node:23-alpine

WORKDIR /app

# Install runtime dependencies for SQLite
RUN apk add --no-cache python3 make g++ 

# Copy built assets from builder
COPY --from=builder /app /app

# The app uses PORT 4001 for backend and Vite (dist) for frontend.
# Since we are containerizing, we might want to serve frontend via Express
# or just run them concurrently as specified in package.json.

EXPOSE 4001 5173

# Default entry point (Modular Backend + Vite dev for now, but 
# in production it will serve 'dist')
CMD ["npm", "run", "start"]
