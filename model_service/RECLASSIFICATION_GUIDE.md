# Email Reclassification Guide

Complete guide for reclassifying all 6000+ existing emails using the trained DistilBERT model and new 9-category system.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Process](#step-by-step-process)
5. [Configuration Options](#configuration-options)
6. [Safety Features](#safety-features)
7. [Troubleshooting](#troubleshooting)

## Overview

The reclassification system processes all existing emails in your MongoDB database and updates their classifications using the trained DistilBERT model with the new 9-category criteria. This ensures every category gets properly populated with matching emails.

### Expected Outcomes

After reclassification:
- ✅ **Placement**: Job opportunities, placement drives from infylearn.com
- ✅ **NPTEL**: Course registrations, lectures from nptel.iitm.ac.in
- ✅ **HOD**: Administrative communications from department heads
- ✅ **E-Zone**: Student portal emails, login credentials
- ✅ **Promotions**: Marketing emails with promotional content
- ✅ **Whats happening**: Campus events and announcements
- ✅ **Assistant**: General university administrative emails
- ✅ **Other**: Miscellaneous emails
- ✅ Average confidence: >0.80

## Quick Start

### One-Command Reclassification

```bash
cd model_service

# 1. First, do a dry-run to preview changes
./run_reclassification.sh --dry-run

# 2. If satisfied, run actual reclassification
./run_reclassification.sh
```

That's it! The script will:
1. Create a backup of current classifications
2. Process all emails in batches
3. Update database with new classifications
4. Generate comprehensive report

### Quick Test (100 emails)

```bash
# Test on 100 emails first
./run_reclassification.sh --sample 100 --dry-run
```

## Prerequisites

### 1. Trained Model

Ensure you have a trained DistilBERT model:

```bash
# Check if model exists
ls -la distilbert_email_model/

# If not, train it first
./run_complete_training.sh
```

### 2. Model Service Running (for API mode)

```bash
# Start model service
cd model_service
python3 enhanced_app.py

# Verify it's running
curl http://localhost:8000/health
```

### 3. MongoDB Running

```bash
# Check MongoDB status
sudo systemctl status mongodb

# Or start it
sudo systemctl start mongodb
```

### 4. Python Dependencies

```bash
pip install pymongo python-dotenv requests tqdm
```

## Step-by-Step Process

### Step 1: Create Backup

**Script**: `backup_classifications.py`

Create a backup of current email classifications:

```bash
python3 backup_classifications.py
```

**Output**: `classification_backup_YYYYMMDD_HHMMSS.json`

This backup includes:
- All email IDs with current classifications
- Category distribution statistics
- Timestamp and metadata

**Verify backup**:
```bash
python3 backup_classifications.py --verify classification_backup_20250129_120000.json
```

### Step 2: Dry-Run Preview

**Always do a dry-run first!**

```bash
python3 reclassify_all_emails.py --dry-run
```

This will:
- Show what changes would be made
- Display category migration statistics
- Flag low-confidence predictions
- Generate preview report
- **NOT update the database**

Review the output carefully:
- Check category distribution makes sense
- Verify confidence scores are high (>0.75 average)
- Review flagged low-confidence emails

### Step 3: Test on Sample

Test on a small sample first:

```bash
# Test on 100 emails
python3 reclassify_all_emails.py --sample 100 --dry-run

# If satisfied, run on sample (live)
python3 reclassify_all_emails.py --sample 100
```

### Step 4: Full Reclassification

Once confident, run full reclassification:

```bash
# Using API (slower but safer)
python3 reclassify_all_emails.py

# OR using direct model (faster)
python3 reclassify_all_emails.py --use-direct-model
```

**Processing time**:
- API mode: 30-60 minutes for 6000 emails
- Direct mode: 15-30 minutes with GPU

### Step 5: Review Results

Check the generated report:

```bash
# View latest report
cat reclassification_report_*.json | python3 -m json.tool | less
```

The report includes:
- Total processed/updated/skipped emails
- Confidence score statistics
- Category migration matrix
- Low confidence emails flagged
- Errors encountered

### Step 6: Verify in Application

1. Restart your application
2. Check each category tab
3. Verify emails are in correct categories
4. Review a few emails in each category

## Configuration Options

### Basic Options

```bash
# Dry-run (preview only)
python3 reclassify_all_emails.py --dry-run

# Set minimum confidence threshold
python3 reclassify_all_emails.py --min-confidence 0.8

# Process specific category only
python3 reclassify_all_emails.py --category "Other"

# Test on sample size
python3 reclassify_all_emails.py --sample 500
```

### Performance Options

```bash
# Adjust batch size (default: 100)
python3 reclassify_all_emails.py --batch-size 200

# Use direct model loading (faster)
python3 reclassify_all_emails.py --use-direct-model

# Custom model path
python3 reclassify_all_emails.py --use-direct-model --model-path ./custom_model
```

### Shell Script Options

```bash
# Dry-run with all safety checks
./run_reclassification.sh --dry-run

# Skip backup (not recommended)
./run_reclassification.sh --skip-backup

# Use direct model
./run_reclassification.sh --direct-model

# Test on sample
./run_reclassification.sh --sample 100

# Category-specific
./run_reclassification.sh --category "Promotions"
```

## Safety Features

### 1. Automatic Backup

Every reclassification (except dry-run) automatically creates a backup:

```json
{
  "backup_date": "2025-01-29T12:00:00",
  "total_emails": 6234,
  "emails": [...],
  "category_distribution": {...}
}
```

### 2. Dry-Run Mode

Test without making any changes:
```bash
./run_reclassification.sh --dry-run
```

### 3. Confidence Threshold

Only update high-confidence predictions:
```bash
python3 reclassify_all_emails.py --min-confidence 0.8
```

### 4. Rollback Capability

If something goes wrong, rollback to backup:

```bash
# Preview rollback
python3 rollback_reclassification.py classification_backup_20250129_120000.json --dry-run

# Perform rollback
python3 rollback_reclassification.py classification_backup_20250129_120000.json
```

### 5. Progress Tracking

Real-time progress bar shows:
- Number of emails processed
- Processing speed
- Estimated time remaining

### 6. Error Handling

- Automatic retry on transient errors
- Detailed error logging
- Processing continues on individual failures
- Errors reported in final report

## Execution Modes

### Mode 1: Safe Preview (Recommended First)

```bash
./run_reclassification.sh --dry-run --sample 100
```

- Tests on 100 emails
- Shows what would change
- No database updates
- Safe to run anytime

### Mode 2: Gradual Rollout

```bash
# 1. Test on 100 emails (live)
./run_reclassification.sh --sample 100

# 2. Verify results

# 3. Test on 1000 emails
./run_reclassification.sh --sample 1000

# 4. If good, process all
./run_reclassification.sh
```

### Mode 3: Category-by-Category

```bash
# Reclassify one category at a time
./run_reclassification.sh --category "Other"
./run_reclassification.sh --category "Promotions"
./run_reclassification.sh --category "Assistant"
# ... etc
```

### Mode 4: Full Reclassification

```bash
# Process all emails at once
./run_reclassification.sh --direct-model
```

## Understanding the Report

### Category Migration Matrix

Shows how emails moved between categories:

```
From 'Other' (2534 emails):
  → Placement: 234 (9.2%)
  → NPTEL: 156 (6.2%)
  → Promotions: 421 (16.6%)
  → Whats happening: 89 (3.5%)
  → Assistant: 1634 (64.5%)
```

### Confidence Statistics

```
Average: 0.8534
Min: 0.4521
Max: 0.9987
Low Confidence (<0.7): 87 emails (1.4%)
```

### Low Confidence Flags

Emails with confidence <0.7 are flagged for review:

```
⚠ Low Confidence Emails:
  - "Re: Question about..." 
    Other → Assistant (confidence: 0.6234)
  - "Fwd: Important update"
    Other → HOD (confidence: 0.6891)
```

## Troubleshooting

### Issue 1: Model Service Not Running

**Error**: `Connection refused to http://localhost:8000`

**Solution**:
```bash
cd model_service
python3 enhanced_app.py
```

### Issue 2: MongoDB Connection Failed

**Error**: `Cannot connect to MongoDB`

**Solution**:
```bash
# Check MongoDB status
sudo systemctl status mongodb

# Start MongoDB
sudo systemctl start mongodb
```

### Issue 3: Low Confidence Scores

**Symptom**: Average confidence <0.70

**Solutions**:
1. Ensure model is properly trained
2. Check if you're using the trained model (not base model)
3. Consider retraining with more data

### Issue 4: Incorrect Classifications

**Symptom**: Emails in wrong categories

**Solutions**:
1. Review training data quality
2. Check category pattern definitions in `categories.json`
3. Retrain model with corrected examples
4. Use rollback script to restore previous state

### Issue 5: Out of Memory

**Error**: `MemoryError` or slow processing

**Solutions**:
```bash
# Reduce batch size
python3 reclassify_all_emails.py --batch-size 50

# Use API mode instead of direct model
python3 reclassify_all_emails.py
```

### Issue 6: API Timeout

**Error**: `Request timeout`

**Solutions**:
- Use direct model mode: `--use-direct-model`
- Reduce batch size
- Check model service logs for issues

## Best Practices

### Before Reclassification

1. ✅ **Backup your database** (automatic but verify)
2. ✅ **Test on sample** (--sample 100)
3. ✅ **Do dry-run** (--dry-run)
4. ✅ **Review model performance** (check training metrics)
5. ✅ **Ensure model service is healthy**

### During Reclassification

1. ✅ **Monitor progress** (progress bar and logs)
2. ✅ **Check for errors** (review error messages)
3. ✅ **Don't interrupt** (let it complete)
4. ✅ **Have rollback ready** (backup file accessible)

### After Reclassification

1. ✅ **Review report** (check statistics make sense)
2. ✅ **Verify in UI** (spot-check each category)
3. ✅ **Check low-confidence emails** (may need manual review)
4. ✅ **Keep backup** (for 30 days minimum)
5. ✅ **Document changes** (note in your logs)

## Performance Benchmarks

### Expected Processing Speed

| Mode | Speed | 6000 Emails |
|------|-------|-------------|
| API (CPU) | 100-150/min | 40-60 min |
| Direct (CPU) | 150-200/min | 30-40 min |
| Direct (GPU) | 250-350/min | 17-24 min |

### Resource Usage

- **RAM**: 2-4 GB (API), 4-8 GB (Direct)
- **CPU**: Moderate usage
- **GPU**: 2-4 GB VRAM (if available)
- **Network**: Minimal (local API calls)

## Advanced Usage

### Custom Confidence Threshold

Only update if very confident:
```bash
python3 reclassify_all_emails.py --min-confidence 0.85
```

### Parallel Processing

For very large datasets, consider batching:
```bash
# Process in 3 batches
python3 reclassify_all_emails.py --sample 2000 --category "Other"
python3 reclassify_all_emails.py --sample 2000 --category "Assistant"
python3 reclassify_all_emails.py --sample 2000 --category "Promotions"
```

### Custom API Endpoint

If model service is on different port:
```bash
python3 reclassify_all_emails.py --api-url http://localhost:8080
```

## Rollback Procedure

If reclassification causes issues:

### Step 1: Stop New Classifications

Prevent new emails from being classified incorrectly.

### Step 2: Restore from Backup

```bash
# Find your backup
ls -lt classification_backup_*.json | head -1

# Preview rollback
python3 rollback_reclassification.py classification_backup_20250129_120000.json --dry-run

# Execute rollback
python3 rollback_reclassification.py classification_backup_20250129_120000.json
```

### Step 3: Verify Restoration

Check a few emails to ensure categories are restored.

### Step 4: Investigate Issue

- Review reclassification report
- Check training data
- Examine model performance
- Fix issues before retrying

## Summary

The reclassification system provides a safe, reliable way to update all your email classifications. Key points:

1. **Always backup** - Automatic safety net
2. **Test first** - Use --dry-run and --sample
3. **Monitor progress** - Watch the progress bar and logs
4. **Review results** - Check the generated report
5. **Rollback available** - If needed, restore previous state

For most users, this simple workflow is sufficient:

```bash
# 1. Preview changes
./run_reclassification.sh --dry-run

# 2. If good, reclassify
./run_reclassification.sh

# 3. Review and verify
```

---

**Need help?** Check the troubleshooting section or review the generated report files.

