#!/bin/bash
# start.sh — Fixed Startup for Linux (Ubuntu)
# Usage: ./start.sh

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo -e "\033[35m[System] Root Directory: $ROOT_DIR\033[0m"

# 🛠️ 1. Node.js Dependency Check
echo -e "\033[36m[System] Checking Node.js dependencies...\033[0m"
cd "$ROOT_DIR/packages/api-gateway"
if [ ! -d "node_modules" ] || [ ! -f "node_modules/http-proxy-middleware/package.json" ]; then
    echo -e "\033[33m📦 [Gateway] Missing dependencies. Installing...\033[0m"
    npm install
fi

cd "$ROOT_DIR"
if [ ! -d "node_modules" ]; then
    echo -e "\033[33m📦 [Root] Missing dependencies. Installing...\033[0m"
    npm install
fi

# 🛠️ 2. Python Setup Helper
setup_python_env() {
    local service_path=$1
    local service_name=$2
    echo -e "\033[36m[System] Checking Python environment for $service_name...\033[0m" >&2
    cd "$service_path"
    
    # Check for venv directory
    if [ -d "venv" ]; then
        # Check if it's broken (no python executable)
        if [ ! -f "venv/bin/python3" ] && [ ! -f "venv/bin/python" ]; then
            echo -e "\033[31m⚠️ Found broken venv for $service_name. Removing...\033[0m" >&2
            rm -rf venv
        fi
    fi

    if [ ! -d "venv" ]; then
        echo -e "\033[33m🐍 Creating virtual environment for $service_name...\033[0m" >&2
        if ! python3 -m venv venv 2>/dev/null; then
            echo -e "\033[31m❌ Error: Failed to create venv. Please run: sudo apt update && sudo apt install python3-venv -y\033[0m" >&2
            # Fallback to system python
            echo "python3"
            return
        fi
    fi
    
    # Identify the correct python executable inside venv
    local P_EXE=""
    if [ -f "venv/bin/python3" ]; then
        P_EXE="$(pwd)/venv/bin/python3"
    elif [ -f "venv/bin/python" ]; then
        P_EXE="$(pwd)/venv/bin/python"
    else
        echo -e "\033[31m⚠️ Warning: venv found but python executable missing. Using system python3.\033[0m" >&2
        echo "python3"
        return
    fi
    
    # Verify uvicorn exists in venv, otherwise install requirements
    if ! "$P_EXE" -m uvicorn --version >/dev/null 2>&1; then
        echo -e "\033[33m📥 Installing Python requirements for $service_name...\033[0m" >&2
        "$P_EXE" -m pip install --upgrade pip
        if [ -f "requirements.txt" ]; then
            "$P_EXE" -m pip install -r requirements.txt
        else
            "$P_EXE" -m pip install fastapi uvicorn[standard]
        fi
    fi
    # Output ONLY the absolute path to stdout
    echo "$P_EXE"
}

# 🚀 3. Start Services
cd "$ROOT_DIR"
STRATEGY_PYTHON=$(setup_python_env "$ROOT_DIR/packages/strategy-ai" "strategy-ai")
echo -e "\033[32m🚀 Starting strategy-ai on Port 8000...\033[0m"
cd "$ROOT_DIR/packages/strategy-ai"
"$STRATEGY_PYTHON" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
PYTHON_PID=$!

cd "$ROOT_DIR"
QUANT_PYTHON=$(setup_python_env "$ROOT_DIR/packages/quant-engine" "quant-engine")
echo -e "\033[32m🚀 Starting quant-engine on Port 8002...\033[0m"
cd "$ROOT_DIR/packages/quant-engine"
"$QUANT_PYTHON" -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload &
QUANT_PID=$!

echo -e "\033[36mStarting Polymarket Agent + Dashboard...\033[0m"
cd "$ROOT_DIR/polymarket/polymarket_agent"
python3 main.py --dry-run >/dev/null 2>&1 &
POLY_AGENT_PID=$!
python3 apps/api-gateway/api_server.py >/dev/null 2>&1 &
POLY_DASH_PID=$!

echo -e "\033[32m🚀 Starting API Gateway + Vite (Node.js)...\033[0m"
cd "$ROOT_DIR"
npm run start &
NODE_PID=$!

echo ""
echo -e "\033[32m✅ ALL SERVICES INITIALIZED\033[0m"
echo ""
echo -e "\033[33mPress Ctrl+C to stop all services...\033[0m"

cleanup() {
    echo -e "\033[31mStopping all processes...\033[0m"
    kill $PYTHON_PID $QUANT_PID $POLY_AGENT_PID $POLY_DASH_PID $NODE_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM
wait
