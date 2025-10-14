@echo off
REM Sortify - Model Service Startup Script for Windows

cd model_service

REM Check if virtual environment exists
if not exist venv (
    echo Virtual environment not found!
    echo Please run: npm run setup:venv
    exit /b 1
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Start the enhanced ML service
echo Starting Sortify ML Service on http://localhost:8000
python -m uvicorn enhanced_app:app --host 0.0.0.0 --port 8000 --reload

