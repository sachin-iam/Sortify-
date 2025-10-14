@echo off
REM Sortify - Virtual Environment Setup Script for Windows

echo Setting up Sortify Python Virtual Environment...
echo.

cd model_service

REM Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Python is not installed. Please install Python 3.8+ first.
    exit /b 1
)

python --version

REM Remove existing venv if it exists
if exist venv (
    echo Removing existing virtual environment...
    rmdir /s /q venv
)

REM Create new virtual environment
echo Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

echo.
echo Virtual environment setup complete!
echo.
echo To manually activate the environment:
echo   cd model_service ^&^& venv\Scripts\activate.bat
echo.
echo To start all services, run from root:
echo   npm run dev
echo.

pause

