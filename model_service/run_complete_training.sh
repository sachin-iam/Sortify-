#!/bin/bash

################################################################################
# Complete DistilBERT Training Pipeline
# Orchestrates the full training workflow from data extraction to model deployment
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PYTHON_CMD="python3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    DISTILBERT EMAIL CLASSIFIER - COMPLETE TRAINING PIPELINE       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Change to script directory
cd "$SCRIPT_DIR"

################################################################################
# Step 1: Extract Training Data
################################################################################
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}STEP 1: Extracting Training Data from MongoDB${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

if [ ! -f "extracted_emails.json" ]; then
    echo "Running data extraction..."
    $PYTHON_CMD extract_training_data.py
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Data extraction completed successfully${NC}"
    else
        echo -e "${RED}✗ Data extraction failed${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Training data already extracted (extracted_emails.json exists)${NC}"
    read -p "Do you want to re-extract? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $PYTHON_CMD extract_training_data.py
    fi
fi

################################################################################
# Step 2: Analyze Category Patterns
################################################################################
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}STEP 2: Analyzing Category Patterns${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

if [ ! -f "category_patterns_report.json" ] || [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Analyzing patterns for all categories..."
    $PYTHON_CMD analyze_category_patterns.py
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Pattern analysis completed successfully${NC}"
    else
        echo -e "${RED}✗ Pattern analysis failed${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Pattern analysis already completed${NC}"
fi

################################################################################
# Step 3: Prepare Training Dataset
################################################################################
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}STEP 3: Preparing Balanced Training Dataset${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

if [ ! -f "email_training_dataset.jsonl" ]; then
    echo "Creating balanced dataset with augmentation..."
    $PYTHON_CMD prepare_distilbert_dataset.py
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dataset preparation completed successfully${NC}"
    else
        echo -e "${RED}✗ Dataset preparation failed${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Training dataset already exists${NC}"
    read -p "Do you want to regenerate the dataset? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $PYTHON_CMD prepare_distilbert_dataset.py
    fi
fi

################################################################################
# Step 4: Train DistilBERT Model
################################################################################
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}STEP 4: Training DistilBERT Model${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "Starting model training (this may take 30-60 minutes)..."
echo -e "${BLUE}Configuration:${NC}"
echo "  - Model: distilbert-base-uncased"
echo "  - Epochs: 4"
echo "  - Batch Size: 16"
echo "  - Learning Rate: 2e-5"
echo ""

$PYTHON_CMD train_email_classifier.py \
    --data_file email_training_dataset.jsonl \
    --output_dir distilbert_email_model \
    --num_epochs 4 \
    --batch_size 16 \
    --learning_rate 2e-5 \
    --max_length 256

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Model training completed successfully${NC}"
else
    echo -e "${RED}✗ Model training failed${NC}"
    exit 1
fi

################################################################################
# Step 5: Evaluate Model
################################################################################
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}STEP 5: Evaluating Trained Model${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

if [ -f "email_training_dataset_val.jsonl" ]; then
    echo "Running comprehensive model evaluation..."
    $PYTHON_CMD evaluate_model.py \
        --model_path distilbert_email_model \
        --test_file email_training_dataset_val.jsonl \
        --output evaluation_report.json
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Model evaluation completed successfully${NC}"
    else
        echo -e "${YELLOW}⚠ Model evaluation failed (non-critical)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Validation dataset not found, skipping evaluation${NC}"
fi

################################################################################
# Step 6: Generate Summary
################################################################################
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    TRAINING PIPELINE COMPLETE!                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}✓ All steps completed successfully!${NC}"
echo ""
echo "Generated Files:"
echo "  📁 extracted_emails.json - Raw training data"
echo "  📁 extraction_report.json - Data analysis report"
echo "  📁 category_patterns_report.json - Pattern analysis"
echo "  📁 email_training_dataset.jsonl - Training dataset (full)"
echo "  📁 email_training_dataset_train.jsonl - Training set"
echo "  📁 email_training_dataset_val.jsonl - Validation set"
echo "  📁 distilbert_email_model/ - Trained model directory"
echo "  📁 evaluation_report.json - Model performance metrics"
echo ""

# Display model performance if evaluation succeeded
if [ -f "evaluation_report.json" ]; then
    echo "Model Performance:"
    $PYTHON_CMD -c "
import json
with open('evaluation_report.json', 'r') as f:
    report = json.load(f)
    metrics = report['overall_metrics']
    print(f\"  Accuracy:  {metrics['accuracy']:.4f}\")
    print(f\"  Precision: {metrics['precision']:.4f}\")
    print(f\"  Recall:    {metrics['recall']:.4f}\")
    print(f\"  F1 Score:  {metrics['f1']:.4f}\")
"
    echo ""
fi

echo "Next Steps:"
echo "  1. Review evaluation_report.json for detailed metrics"
echo "  2. Test the model with sample emails"
echo "  3. Deploy the model to production:"
echo ""
echo "     Option A - Via API:"
echo "     curl -X POST http://localhost:8000/model/load \\"
echo "          -H 'Content-Type: application/json' \\"
echo "          -d '{\"model_path\": \"$(pwd)/distilbert_email_model\"}'"
echo ""
echo "     Option B - Restart model service (auto-loads from distilbert_models/)"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════${NC}"

