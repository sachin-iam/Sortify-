#!/bin/bash

# Sortify - Complete Project Initialization Script
# This script sets up everything you need to run Sortify

set -e  # Exit on error

clear

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║           🚀 Welcome to Sortify Setup Wizard 🚀                 ║"
echo "║                                                                  ║"
echo "║     AI-Powered Email Organization Platform                       ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "This script will set up your complete development environment."
echo ""

# Check Node.js
echo "📦 Checking prerequisites..."
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "   Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js: $NODE_VERSION"

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm: v$NPM_VERSION"

if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed!"
    echo "   Please install Python 3.8+ from: https://python.org/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo "✅ Python: $PYTHON_VERSION"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
echo ""

echo "1️⃣  Installing root dependencies..."
npm install

echo ""
echo "2️⃣  Installing client (React) dependencies..."
cd client && npm install && cd ..

echo ""
echo "3️⃣  Installing server (Node.js) dependencies..."
cd server && npm install && cd ..

echo ""
echo "4️⃣  Setting up Python virtual environment..."
cd model_service

if [ -d "venv" ]; then
    echo "   ⚠️  Removing existing virtual environment..."
    rm -rf venv
fi

echo "   📦 Creating virtual environment..."
python3 -m venv venv

echo "   🔧 Activating virtual environment..."
source venv/bin/activate

echo "   ⬆️  Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1

echo "   📥 Installing Python ML dependencies (this may take a few minutes)..."
pip install -r requirements.txt > /dev/null 2>&1

cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Setup Complete!"
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    🎉 You're All Set! 🎉                        ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 What's Installed:"
echo "   ✓ Frontend (React + Vite)"
echo "   ✓ Backend (Node.js + Express)"
echo "   ✓ ML Service (FastAPI + Python)"
echo "   ✓ All dependencies and virtual environment"
echo ""
echo "🚀 To start development:"
echo ""
echo "   npm run dev"
echo ""
echo "   This will start all three services:"
echo "   🌐 Frontend:   http://localhost:3000"
echo "   🔌 Backend:    http://localhost:5000"
echo "   🤖 ML Service: http://localhost:8000"
echo ""
echo "📚 Useful commands:"
echo "   npm run dev         - Start all services"
echo "   npm test            - Run all tests"
echo "   npm run build       - Build for production"
echo ""
echo "📖 Documentation:"
echo "   • QUICKSTART.md     - Quick reference"
echo "   • SETUP_GUIDE.md    - Detailed guide"
echo "   • README.md         - Full documentation"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Happy coding! 💻✨"
echo ""

