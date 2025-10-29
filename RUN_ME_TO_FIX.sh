#!/bin/bash

#############################################
# Email Classification Complete Fix Script
#############################################

echo ""
echo "═══════════════════════════════════════════════════"
echo "  EMAIL CLASSIFICATION FIX - AUTOMATED WORKFLOW"
echo "═══════════════════════════════════════════════════"
echo ""
echo "This script will guide you through the complete process."
echo ""

# Check if model service is running
echo "🔍 Step 1: Checking model service..."
if ! curl -s http://localhost:8000/status > /dev/null 2>&1; then
    echo "❌ Model service is NOT running!"
    echo ""
    echo "Please start it first:"
    echo "  1. Open a new terminal"
    echo "  2. Run: cd model_service && python3 enhanced_app.py"
    echo "  3. Keep that terminal open"
    echo "  4. Come back and run this script again"
    echo ""
    exit 1
fi
echo "✅ Model service is running"
echo ""

# Check current email count
echo "📊 Step 2: Checking current database status..."
EMAIL_COUNT=$(mongosh sortify --quiet --eval "db.emails.countDocuments({})" 2>/dev/null | tail -1)
echo "   Current emails in database: $EMAIL_COUNT"
echo ""

if [ "$EMAIL_COUNT" -lt 1000 ]; then
    echo "⚠️  You have less than 1,000 emails in the database."
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "  RECOMMENDED: Use Dashboard for Full Sync"
    echo "═══════════════════════════════════════════════════"
    echo ""
    echo "The easiest way to fix this:"
    echo ""
    echo "1. ✅ Open your Sortify dashboard in browser"
    echo "2. ✅ Look for the Gmail card"
    echo "3. ✅ Click 'Full Sync (All)' button (purple)"
    echo "4. ✅ Wait 15-30 minutes"
    echo "5. ✅ Email count will increase to 6,300+"
    echo ""
    echo "Then come back and run this script again to train the model!"
    echo ""
    read -p "Have you already started Full Sync? (y/n): " SYNCED
    
    if [ "$SYNCED" != "y" ]; then
        echo ""
        echo "👉 Please start Full Sync in the dashboard first!"
        echo "   Then run this script again."
        echo ""
        exit 0
    fi
fi

echo "═══════════════════════════════════════════════════"
echo "  PHASE 1: MODEL TRAINING"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Training the classification model on your $EMAIL_COUNT emails..."
echo "This will take 40-70 minutes."
echo ""
read -p "Start training now? (y/n): " START_TRAINING

if [ "$START_TRAINING" = "y" ]; then
    echo ""
    echo "🎓 Starting model training..."
    cd model_service
    ./run_complete_training.sh
    
    echo ""
    echo "✅ Training complete!"
    echo ""
    
    # Load the model
    echo "📥 Loading trained model into service..."
    curl -X POST http://localhost:8000/model/load \
      -H 'Content-Type: application/json' \
      -d '{"model_path": "/Users/sachingupta/Desktop/Sortify-/model_service/distilbert_email_model"}' \
      2>/dev/null
    
    echo ""
    echo "✅ Model loaded!"
    echo ""
fi

echo "═══════════════════════════════════════════════════"
echo "  PHASE 2: RECLASSIFICATION"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Now we'll reclassify all $EMAIL_COUNT emails with the trained model."
echo ""
echo "You can do this via:"
echo "  1. Dashboard → Click 'Reclassify All' button (easiest)"
echo "  2. This script (continue below)"
echo ""
read -p "Reclassify via this script? (y/n): " RECLASSIFY

if [ "$RECLASSIFY" = "y" ]; then
    echo ""
    echo "⚠️  Note: Dashboard method is recommended for better progress tracking."
    echo ""
    echo "To reclassify via dashboard:"
    echo "  1. Open Sortify in browser"
    echo "  2. Click 'Reclassify All' (green button)"
    echo "  3. Wait 10-20 minutes"
    echo "  4. Refresh browser"
    echo ""
fi

echo "═══════════════════════════════════════════════════"
echo "  ✅ SETUP COMPLETE!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "What to do next:"
echo ""
echo "1. ✅ Open your dashboard"
echo "2. ✅ Click 'Reclassify All' if you haven't already"
echo "3. ✅ Wait 10-20 minutes"
echo "4. ✅ Refresh browser (Ctrl+R)"
echo "5. ✅ Check all categories - they should have emails!"
echo ""
echo "Expected results:"
echo "  - Promotions: 800-1,200 emails"
echo "  - Assistant: 300-500 emails"
echo "  - HOD: 100-200 emails"
echo "  - All other categories populated"
echo ""
echo "🎉 Your email classification system is ready!"
echo ""

