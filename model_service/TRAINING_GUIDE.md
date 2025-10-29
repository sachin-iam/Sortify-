# DistilBERT Email Classifier Training Guide

Complete guide for training a deep learning model for email classification across 9 categories.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Step-by-Step Guide](#step-by-step-guide)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)

## Overview

This training pipeline trains a DistilBERT model to classify emails into 9 categories:

1. **Placement** - Job opportunities and recruitment
2. **NPTEL** - Online courses and lectures
3. **HOD** - Department head communications
4. **E-Zone** - Student portal related emails
5. **Promotions** - Marketing and promotional content
6. **Whats happening** - Campus events and announcements
7. **Assistant** - General university communications
8. **Other** - Miscellaneous emails
9. **All** - Meta-category for filtering

## Prerequisites

### System Requirements

- **Python**: 3.8 or higher
- **Memory**: At least 8GB RAM (16GB recommended)
- **Storage**: 5GB free space
- **GPU**: Optional but highly recommended (CUDA-compatible)

### Python Dependencies

Install required packages:

```bash
cd model_service
pip install -r requirements.txt
```

Key dependencies:
- `transformers` - Hugging Face transformers library
- `torch` - PyTorch deep learning framework
- `datasets` - Hugging Face datasets library
- `scikit-learn` - Machine learning utilities
- `pymongo` - MongoDB Python driver

### MongoDB Setup

Ensure MongoDB is running and contains your email data:

```bash
# Check MongoDB connection
mongo --eval "db.runCommand({ connectionStatus: 1 })"
```

Your MongoDB should have an `emails` collection with the following fields:
- `subject` - Email subject line
- `text` or `body` - Email body content
- `from` - Sender address
- `category` or `classification.label` - Current category

## Quick Start

### One-Command Training

Run the complete pipeline with a single command:

```bash
cd model_service
./run_complete_training.sh
```

This will:
1. Extract emails from MongoDB
2. Analyze category patterns
3. Prepare balanced dataset
4. Train DistilBERT model
5. Evaluate model performance

### Manual Training (Step by Step)

If you prefer manual control:

```bash
# Step 1: Extract data
python3 extract_training_data.py

# Step 2: Analyze patterns
python3 analyze_category_patterns.py

# Step 3: Prepare dataset
python3 prepare_distilbert_dataset.py

# Step 4: Train model
python3 train_email_classifier.py

# Step 5: Evaluate model
python3 evaluate_model.py
```

## Step-by-Step Guide

### Step 1: Data Extraction

**Script**: `extract_training_data.py`

Extracts emails from MongoDB and performs initial analysis.

```bash
python3 extract_training_data.py
```

**Output Files**:
- `extracted_emails.json` - Raw email data
- `extraction_report.json` - Distribution analysis

**What it does**:
- Connects to MongoDB
- Extracts all non-deleted emails
- Analyzes category distribution
- Identifies sender patterns
- Extracts subject keywords
- Analyzes temporal patterns

### Step 2: Pattern Analysis

**Script**: `analyze_category_patterns.py`

Performs deep pattern analysis for each category.

```bash
python3 analyze_category_patterns.py
```

**Output Files**:
- `category_patterns_report.json` - Comprehensive pattern analysis

**What it does**:
- Calculates TF-IDF scores for keywords
- Identifies top sender domains per category
- Extracts subject line patterns
- Analyzes body content patterns
- Studies temporal distribution
- Generates category definitions

**Key Insights Extracted**:
- **Placement**: `infylearn.com`, job-related keywords
- **NPTEL**: `nptel.iitm.ac.in`, course-related terms
- **HOD**: Administrative signatures, official language
- **E-Zone**: Portal references, login keywords
- **Promotions**: Marketing language, unsubscribe links
- **Whats happening**: Event announcements, "What's Happening" sender

### Step 3: Dataset Preparation

**Script**: `prepare_distilbert_dataset.py`

Creates a balanced training dataset with augmentation.

```bash
python3 prepare_distilbert_dataset.py
```

**Output Files**:
- `email_training_dataset.jsonl` - Full dataset
- `email_training_dataset_train.jsonl` - Training set (80%)
- `email_training_dataset_val.jsonl` - Validation set (20%)
- `email_training_dataset_metadata.json` - Dataset statistics

**What it does**:
- Balances categories (100-200 samples each)
- Augments underrepresented categories with synthetic examples
- Formats data for DistilBERT training
- Performs stratified train/val split
- Handles the "All" meta-category

**Configuration**:
```python
min_samples_per_category = 100  # Minimum samples
max_samples_per_category = 200  # Maximum samples
train_ratio = 0.8  # 80% train, 20% validation
```

### Step 4: Model Training

**Script**: `train_email_classifier.py`

Trains the DistilBERT model using the prepared dataset.

```bash
python3 train_email_classifier.py \
    --data_file email_training_dataset.jsonl \
    --output_dir distilbert_email_model \
    --num_epochs 4 \
    --batch_size 16 \
    --learning_rate 2e-5
```

**Parameters**:
- `--data_file`: Path to training dataset (JSONL format)
- `--output_dir`: Directory to save trained model
- `--num_epochs`: Number of training epochs (default: 4)
- `--batch_size`: Training batch size (default: 16)
- `--learning_rate`: Learning rate (default: 2e-5)
- `--max_length`: Max token length (default: 256)

**Output Files**:
- `distilbert_email_model/` - Trained model directory
  - `pytorch_model.bin` - Model weights
  - `config.json` - Model configuration
  - `vocab.txt` - Tokenizer vocabulary
  - `label_mappings.json` - Category mappings
  - `training_results.json` - Training metrics

**Training Time**:
- CPU: 1-2 hours
- GPU (CUDA): 15-30 minutes

**Expected Performance**:
- Accuracy: >85%
- F1 Score: >0.85
- Per-category F1: >0.75

### Step 5: Model Evaluation

**Script**: `evaluate_model.py`

Evaluates the trained model on validation data.

```bash
python3 evaluate_model.py \
    --model_path distilbert_email_model \
    --test_file email_training_dataset_val.jsonl \
    --output evaluation_report.json
```

**Output Files**:
- `evaluation_report.json` - Comprehensive evaluation metrics

**Metrics Provided**:
- Overall accuracy, precision, recall, F1
- Per-category performance
- Confusion matrix
- Confidence score statistics
- Common misclassifications

## Configuration

### Training Configuration

Edit `train_email_classifier.py` or pass command-line arguments:

```python
# Model configuration
MODEL_NAME = "distilbert-base-uncased"
MAX_LENGTH = 256  # Token sequence length

# Training parameters
NUM_EPOCHS = 4
BATCH_SIZE = 16
LEARNING_RATE = 2e-5
VALIDATION_SPLIT = 0.2

# Class balancing
USE_CLASS_WEIGHTS = True
```

### Dataset Configuration

Edit `prepare_distilbert_dataset.py`:

```python
# Dataset balancing
MIN_SAMPLES_PER_CATEGORY = 100
MAX_SAMPLES_PER_CATEGORY = 200
TRAIN_RATIO = 0.8

# Data augmentation
ENABLE_SYNTHETIC_DATA = True
AUGMENTATION_MULTIPLIER = 1.5
```

### MongoDB Configuration

Set environment variables in `.env`:

```bash
MONGODB_URI=mongodb://localhost:27017/sortify
```

## Deploying the Model

### Option 1: API Endpoint

Load the model via the model service API:

```bash
curl -X POST http://localhost:8000/model/load \
  -H 'Content-Type: application/json' \
  -d '{"model_path": "/path/to/distilbert_email_model"}'
```

### Option 2: Auto-load on Startup

Copy the trained model to the default location:

```bash
cp -r distilbert_email_model distilbert_models
```

The model service will automatically load it on startup.

### Option 3: Manual Integration

Update `dynamic_classifier.py`:

```python
classifier = DynamicEmailClassifier()
classifier.load_model_from_path("./distilbert_email_model")
```

## Testing the Model

### Test Single Email

```python
from dynamic_classifier import DynamicEmailClassifier

classifier = DynamicEmailClassifier()
classifier.load_model_from_path("./distilbert_email_model")

result = classifier.predict_single(
    subject="Placement Drive: Infosys Round 2",
    body="Report to Auditorium A at 10 AM for the technical interview..."
)

print(f"Category: {result['label']}")
print(f"Confidence: {result['confidence']:.4f}")
```

### Test via API

```bash
curl -X POST http://localhost:8000/predict \
  -H 'Content-Type: application/json' \
  -d '{
    "subject": "NPTEL Course Registration",
    "body": "Complete your NPTEL course registration by October 31..."
  }'
```

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Failed

**Error**: `MongoClient connection failed`

**Solution**:
```bash
# Check MongoDB is running
sudo systemctl status mongodb

# Or start MongoDB
sudo systemctl start mongodb
```

#### 2. Out of Memory During Training

**Error**: `CUDA out of memory` or `MemoryError`

**Solution**:
```bash
# Reduce batch size
python3 train_email_classifier.py --batch_size 8

# Or use CPU training
export CUDA_VISIBLE_DEVICES=""
```

#### 3. No Training Data Found

**Error**: `No emails found in database`

**Solution**:
- Ensure MongoDB contains emails
- Check the `emails` collection exists
- Verify email documents have required fields

#### 4. Poor Model Performance

**Symptoms**: Accuracy <70%, low F1 scores

**Solutions**:
- Increase training epochs: `--num_epochs 6`
- Collect more training data (aim for 200+ per category)
- Review `category_patterns_report.json` for data quality
- Check for label noise in training data

#### 5. Imbalanced Categories

**Symptoms**: Some categories have 0 predictions

**Solutions**:
- Review `email_training_dataset_metadata.json`
- Increase `MIN_SAMPLES_PER_CATEGORY` to 150
- Enable more aggressive synthetic data generation

### Getting Help

If issues persist:

1. Check logs in `distilbert_email_model/logs/`
2. Review `extraction_report.json` for data issues
3. Examine `evaluation_report.json` for performance bottlenecks
4. Consult the confusion matrix for systematic errors

## Advanced Usage

### Fine-tuning Hyperparameters

```bash
python3 train_email_classifier.py \
    --num_epochs 6 \
    --batch_size 32 \
    --learning_rate 5e-5 \
    --max_length 512
```

### Training with Custom Dataset

```bash
# Format: JSONL with {"text": "...", "label": "..."}
python3 train_email_classifier.py \
    --data_file /path/to/custom_dataset.jsonl \
    --output_dir custom_model
```

### Monitoring Training Progress

Use TensorBoard (if installed):

```bash
tensorboard --logdir distilbert_email_model/logs
```

## Best Practices

1. **Data Quality**: Ensure clean, well-labeled training data
2. **Balanced Dataset**: Aim for 150-200 samples per category
3. **Regular Retraining**: Retrain monthly with new data
4. **Validation**: Always evaluate before deployment
5. **Versioning**: Keep track of model versions and performance

## Performance Benchmarks

Expected performance on well-balanced dataset:

| Metric | Target | Excellent |
|--------|--------|-----------|
| Overall Accuracy | >85% | >90% |
| Weighted F1 | >0.85 | >0.90 |
| Per-category F1 | >0.75 | >0.85 |
| Average Confidence | >0.80 | >0.90 |

## Next Steps

After successful training:

1. Review `evaluation_report.json`
2. Test on real emails
3. Deploy to production
4. Monitor performance
5. Collect feedback for retraining

---

**For more information**, see:
- `distilbert_trainer.py` - Core training implementation
- `dynamic_classifier.py` - Classification logic
- `enhanced_app.py` - API endpoints

