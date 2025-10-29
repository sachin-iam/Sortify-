#!/bin/bash

#############################################
# Complete Email Classification Training
# Fetches full bodies → Trains model → Classifies all emails
#############################################

echo "═══════════════════════════════════════════════════"
echo "  EMAIL CLASSIFICATION TRAINING & DEPLOYMENT"
echo "═══════════════════════════════════════════════════"
echo ""

# Check if model service is running
echo "🔍 Checking if model service is running..."
if ! curl -s http://localhost:8000/status > /dev/null 2>&1; then
    echo "❌ Model service is not running!"
    echo ""
    echo "Please start it in a separate terminal:"
    echo "  cd model_service"
    echo "  python3 enhanced_app.py"
    echo ""
    exit 1
fi
echo "✅ Model service is running"
echo ""

# Run the orchestrator script
cd server
node src/scripts/trainAndClassifyAll.js

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Training and classification complete!"
echo "═══════════════════════════════════════════════════"

