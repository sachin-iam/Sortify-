#!/bin/bash

################################################################################
# Sortify - Stop All Services
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping all Sortify services...${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS_DIR="$SCRIPT_DIR/.pids"

# Stop services by PID files
if [ -d "$PIDS_DIR" ]; then
    for pid_file in "$PIDS_DIR"/*.pid; do
        if [ -f "$pid_file" ]; then
            PID=$(cat "$pid_file")
            SERVICE=$(basename "$pid_file" .pid)
            
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "  Stopping $SERVICE (PID: $PID)"
                kill "$PID" 2>/dev/null
                sleep 1
                
                # Force kill if still running
                if ps -p "$PID" > /dev/null 2>&1; then
                    kill -9 "$PID" 2>/dev/null
                fi
            fi
            
            rm -f "$pid_file"
        fi
    done
fi

# Also kill by port (fallback)
echo "  Cleaning up ports..."
lsof -ti:8000 | xargs kill -9 2>/dev/null  # Model service
lsof -ti:5001 | xargs kill -9 2>/dev/null  # Backend
lsof -ti:5173 | xargs kill -9 2>/dev/null  # Frontend

echo ""
echo -e "${GREEN}✓ All services stopped${NC}"

