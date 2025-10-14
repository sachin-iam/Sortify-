#!/bin/bash

# Sortify - Model Service Startup Script
# This script activates the virtual environment and starts the FastAPI service

cd model_service

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please run: npm run setup:venv"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Start the enhanced ML service
echo "🤖 Starting Sortify ML Service on http://localhost:8000"
python -m uvicorn enhanced_app:app --host 0.0.0.0 --port 8000 --reload

