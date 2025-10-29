#!/bin/bash

# Monitor training progress

LOG_FILE="/Users/sachingupta/Desktop/Sortify-/server/training_production.log"

echo "📊 Monitoring Email Classification Training"
echo "=============================================="
echo ""

# Check if process is running
if pgrep -f "trainAndClassifyAll" > /dev/null; then
    echo "✅ Training process is RUNNING"
    PID=$(pgrep -f "trainAndClassifyAll")
    echo "   PID: $PID"
else
    echo "⚠️  Training process is NOT running"
    echo "   It may have completed or stopped"
fi

echo ""
echo "📈 Latest Progress:"
echo "-------------------------------------------"
tail -30 "$LOG_FILE" | grep -E "(Progress|📦|✅|Step|PHASE|Fetched|Classified)" | tail -15

echo ""
echo "-------------------------------------------"
echo "📝 Last 10 lines of log:"
tail -10 "$LOG_FILE"

echo ""
echo "=============================================="
echo "To see full log: tail -f $LOG_FILE"
echo "To check process: ps aux | grep trainAndClassifyAll"
echo "=============================================="

