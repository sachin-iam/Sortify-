#!/bin/bash

################################################################################
# Complete Email Reclassification Pipeline
# Safely reclassifies all 6000+ emails using trained DistilBERT model
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PYTHON_CMD="python3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         EMAIL RECLASSIFICATION - COMPLETE PIPELINE                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Change to script directory
cd "$SCRIPT_DIR"

################################################################################
# Parse arguments
################################################################################
DRY_RUN=false
SKIP_BACKUP=false
USE_DIRECT_MODEL=false
SAMPLE_SIZE=""
CATEGORY_FILTER=""
MODEL_PATH="distilbert_email_model"

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --direct-model)
      USE_DIRECT_MODEL=true
      shift
      ;;
    --sample)
      SAMPLE_SIZE="--sample $2"
      shift 2
      ;;
    --category)
      CATEGORY_FILTER="--category $2"
      shift 2
      ;;
    --model-path)
      MODEL_PATH="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --dry-run         Preview changes without updating database"
      echo "  --skip-backup     Skip backup creation (not recommended)"
      echo "  --direct-model    Use direct model loading (faster)"
      echo "  --sample N        Process only N emails (for testing)"
      echo "  --category CAT    Only reclassify emails in specific category"
      echo "  --model-path PATH Path to trained model directory"
      echo "  --help            Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0 --dry-run                    # Preview changes"
      echo "  $0 --sample 100                 # Test on 100 emails"
      echo "  $0 --category Other             # Only reclassify 'Other' category"
      echo "  $0 --direct-model               # Use direct model (faster)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

################################################################################
# Display Configuration
################################################################################
echo -e "${CYAN}Configuration:${NC}"
echo "  Mode: $([ "$DRY_RUN" = true ] && echo 'DRY RUN (preview only)' || echo 'LIVE RECLASSIFICATION')"
echo "  Backup: $([ "$SKIP_BACKUP" = true ] && echo 'Disabled' || echo 'Enabled')"
echo "  Model Loading: $([ "$USE_DIRECT_MODEL" = true ] && echo 'Direct (faster)' || echo 'API')"
echo "  Model Path: $MODEL_PATH"
[ -n "$SAMPLE_SIZE" ] && echo "  Sample Size: $SAMPLE_SIZE"
[ -n "$CATEGORY_FILTER" ] && echo "  Category Filter: $CATEGORY_FILTER"
echo ""

################################################################################
# Step 0: Check Prerequisites
################################################################################
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}CHECKING PREREQUISITES${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if model service is running (if using API)
if [ "$USE_DIRECT_MODEL" = false ]; then
    echo "Checking model service..."
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Model service is running${NC}"
    else
        echo -e "${RED}✗ Model service is not running${NC}"
        echo "  Please start the model service first:"
        echo "  cd model_service && python3 enhanced_app.py"
        exit 1
    fi
else
    echo "Checking trained model..."
    if [ -d "$MODEL_PATH" ]; then
        echo -e "${GREEN}✓ Trained model found at $MODEL_PATH${NC}"
    else
        echo -e "${RED}✗ Trained model not found at $MODEL_PATH${NC}"
        echo "  Please train the model first:"
        echo "  ./run_complete_training.sh"
        exit 1
    fi
fi

# Check MongoDB connection
echo "Checking MongoDB connection..."
if $PYTHON_CMD -c "from pymongo import MongoClient; MongoClient('mongodb://localhost:27017/sortify', serverSelectionTimeoutMS=2000).server_info()" 2>/dev/null; then
    echo -e "${GREEN}✓ MongoDB is accessible${NC}"
else
    echo -e "${RED}✗ Cannot connect to MongoDB${NC}"
    echo "  Please ensure MongoDB is running"
    exit 1
fi

################################################################################
# Step 1: Create Backup (if not skipped and not dry-run)
################################################################################
if [ "$SKIP_BACKUP" = false ] && [ "$DRY_RUN" = false ]; then
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}STEP 1: Creating Backup${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    BACKUP_FILE="classification_backup_$(date +%Y%m%d_%H%M%S).json"
    
    $PYTHON_CMD backup_classifications.py --output "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
    else
        echo -e "${RED}✗ Backup failed${NC}"
        exit 1
    fi
else
    echo ""
    if [ "$SKIP_BACKUP" = true ]; then
        echo -e "${YELLOW}⚠ Skipping backup (--skip-backup specified)${NC}"
    else
        echo -e "${YELLOW}⚠ Skipping backup (dry-run mode)${NC}"
    fi
fi

################################################################################
# Step 2: Run Reclassification
################################################################################
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}STEP 2: Reclassifying Emails${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Build reclassification command
RECLASSIFY_CMD="$PYTHON_CMD reclassify_all_emails.py"

if [ "$DRY_RUN" = true ]; then
    RECLASSIFY_CMD="$RECLASSIFY_CMD --dry-run"
fi

if [ "$USE_DIRECT_MODEL" = true ]; then
    RECLASSIFY_CMD="$RECLASSIFY_CMD --use-direct-model --model-path $MODEL_PATH"
fi

if [ -n "$SAMPLE_SIZE" ]; then
    RECLASSIFY_CMD="$RECLASSIFY_CMD $SAMPLE_SIZE"
fi

if [ -n "$CATEGORY_FILTER" ]; then
    RECLASSIFY_CMD="$RECLASSIFY_CMD $CATEGORY_FILTER"
fi

echo "Running: $RECLASSIFY_CMD"
echo ""

$RECLASSIFY_CMD

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Reclassification completed successfully${NC}"
else
    echo -e "${RED}✗ Reclassification failed${NC}"
    
    if [ "$SKIP_BACKUP" = false ] && [ "$DRY_RUN" = false ]; then
        echo ""
        echo -e "${YELLOW}To rollback changes, run:${NC}"
        echo "  $PYTHON_CMD rollback_reclassification.py $BACKUP_FILE"
    fi
    
    exit 1
fi

################################################################################
# Step 3: Summary
################################################################################
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    RECLASSIFICATION COMPLETE!                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}This was a DRY RUN - no changes were made to the database${NC}"
    echo ""
    echo "To perform actual reclassification, run without --dry-run:"
    echo "  ./run_reclassification.sh"
else
    echo -e "${GREEN}✓ All emails have been reclassified successfully!${NC}"
    echo ""
    
    if [ "$SKIP_BACKUP" = false ]; then
        echo "📦 Backup saved: $BACKUP_FILE"
        echo ""
        echo "If you need to rollback, run:"
        echo "  $PYTHON_CMD rollback_reclassification.py $BACKUP_FILE"
    fi
fi

echo ""
echo "Generated Files:"
LATEST_REPORT=$(ls -t reclassification_report_*.json 2>/dev/null | head -1)
if [ -n "$LATEST_REPORT" ]; then
    echo "  📊 Reclassification Report: $LATEST_REPORT"
fi
if [ "$SKIP_BACKUP" = false ] && [ "$DRY_RUN" = false ]; then
    echo "  💾 Classification Backup: $BACKUP_FILE"
fi

echo ""
echo "Next Steps:"
echo "  1. Review the reclassification report"
echo "  2. Check category distributions in your application"
echo "  3. Verify emails are in correct categories"
if [ "$DRY_RUN" = false ]; then
    echo "  4. If issues found, use rollback script to restore"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"

