#!/bin/bash
# start.sh — Start all services (Node.js + Python strategy-ai + Quant + Poly)
# Usage: ./start.sh

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "\033[36mStarting strategy-ai (Python)...\033[0m"
cd "$ROOT_DIR/packages/strategy-ai"
# Try venv first
if [ -f "venv/bin/python" ]; then
    PYTHON_EXE="venv/bin/python"
else
    PYTHON_EXE="python3"
fi
$PYTHON_EXE -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
PYTHON_PID=$!

echo -e "\033[36mStarting quant-engine (Python)...\033[0m"
cd "$ROOT_DIR/packages/quant-engine"
$PYTHON_EXE -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload &
QUANT_PID=$!

echo -e "\033[36mStarting Polymarket Agent + Dashboard (Python)...\033[0m"
cd "$ROOT_DIR/polymarket/polymarket_agent"
# Start Agent in dry-run
python3 main.py --dry-run &
POLY_AGENT_PID=$!
# Start Dashboard
python3 apps/api-gateway/api_server.py &
POLY_DASH_PID=$!

echo -e "\033[36mStarting API Gateway + Vite (Node.js)...\033[0m"
cd "$ROOT_DIR"
npm run start &
NODE_PID=$!

echo ""
echo -e "\033[32mAll services started:\033[0m"
echo "  Frontend             : http://localhost:4000"
echo "  API Gateway          : http://localhost:4001"
echo "  Strategy AI          : http://localhost:8000"
echo "  Quant Engine         : http://localhost:8002"
echo "  Polymarket Dashboard : http://localhost:8080"
echo ""
echo -e "\033[33mPress Ctrl+C to stop all services...\033[0m"

cleanup() {
    echo -e "\033[31mStopping services...\033[0m"
    kill $PYTHON_PID $QUANT_PID $POLY_AGENT_PID $POLY_DASH_PID $NODE_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM
wait
