#!/bin/bash

################################################################################
# Sortify - Start All Services
# Starts Model Service, Backend Server, and Frontend Client
################################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    SORTIFY - STARTING ALL SERVICES                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# PID file locations
PIDS_DIR="$SCRIPT_DIR/.pids"
mkdir -p "$PIDS_DIR"

MODEL_PID_FILE="$PIDS_DIR/model_service.pid"
SERVER_PID_FILE="$PIDS_DIR/backend_server.pid"
CLIENT_PID_FILE="$PIDS_DIR/frontend_client.pid"

################################################################################
# Check Prerequisites
################################################################################
echo -e "${YELLOW}Checking prerequisites...${NC}"
echo ""

# Check MongoDB
echo -n "  MongoDB: "
if mongosh --eval "db.runCommand({ ping: 1 })" > /dev/null 2>&1 || mongo --eval "db.runCommand({ ping: 1 })" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo -e "${YELLOW}  Starting MongoDB...${NC}"
    sudo systemctl start mongodb 2>/dev/null || sudo service mongodb start 2>/dev/null
    sleep 2
fi

# Check Node.js
echo -n "  Node.js: "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
    exit 1
fi

# Check Python
echo -n "  Python: "
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✓ $PYTHON_VERSION${NC}"
else
    echo -e "${RED}✗ Not installed${NC}"
    exit 1
fi

echo ""

################################################################################
# Stop any existing services
################################################################################
echo -e "${YELLOW}Stopping any existing services...${NC}"

if [ -f "$MODEL_PID_FILE" ]; then
    MODEL_PID=$(cat "$MODEL_PID_FILE")
    if ps -p "$MODEL_PID" > /dev/null 2>&1; then
        echo "  Stopping Model Service (PID: $MODEL_PID)"
        kill "$MODEL_PID" 2>/dev/null
        sleep 2
    fi
    rm -f "$MODEL_PID_FILE"
fi

if [ -f "$SERVER_PID_FILE" ]; then
    SERVER_PID=$(cat "$SERVER_PID_FILE")
    if ps -p "$SERVER_PID" > /dev/null 2>&1; then
        echo "  Stopping Backend Server (PID: $SERVER_PID)"
        kill "$SERVER_PID" 2>/dev/null
        sleep 2
    fi
    rm -f "$SERVER_PID_FILE"
fi

if [ -f "$CLIENT_PID_FILE" ]; then
    CLIENT_PID=$(cat "$CLIENT_PID_FILE")
    if ps -p "$CLIENT_PID" > /dev/null 2>&1; then
        echo "  Stopping Frontend Client (PID: $CLIENT_PID)"
        kill "$CLIENT_PID" 2>/dev/null
        sleep 2
    fi
    rm -f "$CLIENT_PID_FILE"
fi

# Also kill by port
lsof -ti:8000 | xargs kill -9 2>/dev/null  # Model service
lsof -ti:5001 | xargs kill -9 2>/dev/null  # Backend
lsof -ti:5173 | xargs kill -9 2>/dev/null  # Frontend

echo -e "${GREEN}  ✓ Cleanup complete${NC}"
echo ""

################################################################################
# Start Model Service
################################################################################
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Starting Model Service (Port 8000)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$SCRIPT_DIR/model_service"

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "  Activating virtual environment..."
    source venv/bin/activate
fi

# Start model service
echo "  Starting model service..."
nohup python3 enhanced_app.py > ../logs/model_service.log 2>&1 &
MODEL_PID=$!
echo $MODEL_PID > "$MODEL_PID_FILE"

echo -e "  ${GREEN}✓ Model Service started (PID: $MODEL_PID)${NC}"
echo "  Waiting for service to be ready..."

# Wait for model service to be ready
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Model Service is ready${NC}"
        break
    fi
    sleep 1
done

################################################################################
# Start Backend Server
################################################################################
echo ""
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}Starting Backend Server (Port 5001)${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$SCRIPT_DIR/server"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing backend dependencies..."
    npm install
fi

# Start backend server
echo "  Starting backend server..."
nohup npm start > ../logs/backend.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$SERVER_PID_FILE"

echo -e "  ${GREEN}✓ Backend Server started (PID: $SERVER_PID)${NC}"
echo "  Waiting for server to be ready..."

# Wait for backend to be ready
for i in {1..30}; do
    if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Backend Server is ready${NC}"
        break
    fi
    sleep 1
done

################################################################################
# Start Frontend Client
################################################################################
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Starting Frontend Client (Port 5173)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd "$SCRIPT_DIR/client"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing frontend dependencies..."
    npm install
fi

# Start frontend client
echo "  Starting frontend client..."
nohup npm run dev > ../logs/frontend.log 2>&1 &
CLIENT_PID=$!
echo $CLIENT_PID > "$CLIENT_PID_FILE"

echo -e "  ${GREEN}✓ Frontend Client started (PID: $CLIENT_PID)${NC}"
echo "  Waiting for client to be ready..."

# Wait for frontend to be ready
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Frontend Client is ready${NC}"
        break
    fi
    sleep 1
done

################################################################################
# Summary
################################################################################
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ALL SERVICES STARTED!                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}Service Status:${NC}"
echo ""
echo -e "  ${MAGENTA}🤖 Model Service:${NC}"
echo "     URL: http://localhost:8000"
echo "     API Docs: http://localhost:8000/docs"
echo "     Health: http://localhost:8000/health"
echo "     PID: $MODEL_PID"
echo ""

echo -e "  ${BLUE}🔧 Backend Server:${NC}"
echo "     URL: http://localhost:5001"
echo "     API: http://localhost:5001/api"
echo "     Health: http://localhost:5001/api/health"
echo "     PID: $SERVER_PID"
echo ""

echo -e "  ${CYAN}🌐 Frontend Client:${NC}"
echo "     URL: http://localhost:5173"
echo "     PID: $CLIENT_PID"
echo ""

echo -e "${YELLOW}Logs:${NC}"
echo "  Model Service: tail -f logs/model_service.log"
echo "  Backend Server: tail -f logs/backend.log"
echo "  Frontend Client: tail -f logs/frontend.log"
echo ""

echo -e "${YELLOW}To stop all services:${NC}"
echo "  ./stop-all.sh"
echo ""

echo -e "${GREEN}✨ Open your browser to: ${CYAN}http://localhost:5173${NC}"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"

