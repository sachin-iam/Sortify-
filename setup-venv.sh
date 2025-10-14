#!/bin/bash

# Sortify - Virtual Environment Setup Script
# This script creates and configures the Python virtual environment for the ML service

set -e  # Exit on error

echo "🚀 Setting up Sortify Python Virtual Environment..."
echo ""

# Navigate to model_service directory
cd model_service

# Check if Python3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo "✓ Found $PYTHON_VERSION"

# Remove existing venv if it exists
if [ -d "venv" ]; then
    echo "⚠️  Removing existing virtual environment..."
    rm -rf venv
fi

# Create new virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📥 Installing Python dependencies..."
pip install -r requirements.txt

echo ""
echo "✅ Virtual environment setup complete!"
echo ""
echo "📍 Virtual environment location: $(pwd)/venv"
echo ""
echo "To manually activate the environment:"
echo "  cd model_service && source venv/bin/activate"
echo ""
echo "To start all services, run from root:"
echo "  npm run dev"
echo ""

