#!/bin/bash
# stop-bg.sh — Stop Background Application
# Usage: ./stop-bg.sh

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT_DIR/app.pid"

if [ ! -f "$PID_FILE" ]; then
    echo -e "\033[31m⚠️ No application PID file found at $PID_FILE. Is it running?\033[0m"
    exit 1
fi

PID=$(cat "$PID_FILE")

if ps -p $PID > /dev/null 2>&1; then
    echo -e "\033[33m🛑 Stopping application (PID $PID)...\033[0m"
    
    # Send SIGTERM to the background script, which will trigger its cleanup function
    kill -TERM $PID
    
    # Wait for the process to actually terminate
    echo -e "Waiting for processes to shut down properly..."
    while ps -p $PID > /dev/null 2>&1; do
        sleep 1
    done
    
    echo -e "\033[32m✅ Application stopped.\033[0m"
else
    echo -e "\033[33m⚠️ Process $PID is not running.\033[0m"
fi

# Clean up PID file
rm -f "$PID_FILE"
