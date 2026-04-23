#!/bin/bash
# start-bg.sh — Background Startup for Linux
# Usage: ./start-bg.sh

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT_DIR/app.pid"

if [ -f "$PID_FILE" ]; then
    # Check if the process is actually running
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "\033[33m⚠️ Application is already running with PID $PID.\033[0m"
        echo -e "\033[33m🛑 Please run ./stop-bg.sh first before starting again.\033[0m"
        exit 1
    else
        echo -e "\033[33m⚠️ Found stale PID file. Removing it...\033[0m"
        rm -f "$PID_FILE"
    fi
fi

echo -e "\033[36m[System] Starting application in the background...\033[0m"

# Ensure start.sh is executable
chmod +x "$ROOT_DIR/start.sh"

# Run the existing start.sh in the background using nohup
nohup "$ROOT_DIR/start.sh" > "$ROOT_DIR/start.log" 2>&1 &
START_PID=$!

echo $START_PID > "$PID_FILE"
echo -e "\033[32m✅ Application started in background with PID $START_PID.\033[0m"
echo -e "\033[36m📄 Logs are being written to $ROOT_DIR/start.log\033[0m"
echo -e "\033[33m🛑 To stop the application, run: ./stop-bg.sh\033[0m"
