# Email Classification System - Complete Guide

## Overview

This system implements a smart email classification approach that handles both existing and new emails efficiently:

### For Existing Emails:
```
Metadata in DB → Fetch Full Bodies → Train Model → Classify All → Cache Results → Remove Bodies
```

### For New Emails:
```
New Email Synced → Fetch Full Body → Classify with Model → Cache Result → Remove Body → Keep Metadata + Cache
```

## Why This Approach?

**Problem**: Your system uses lazy loading - only email metadata is stored in the database. When emails are classified using just subject and snippet, the model doesn't have enough context and fails to classify correctly (0 emails in Promotions, Assistant, HOD, etc.).

**Solution**: 
1. Fetch full bodies from Gmail for training
2. Train DistilBERT model on full-body emails
3. Classify ALL emails with the trained model
4. For new emails: auto-fetch body → classify → cache → cleanup
5. Database stays lightweight (no full bodies stored long-term)

## Architecture

### Components Created

#### 1. Gmail Bulk Fetcher (`server/src/services/gmailBulkFetcher.js`)
- Fetches full email bodies from Gmail API for all existing emails
- Stores temporarily in DB with `fullBody` field
- Processes in batches with concurrency control
- Handles rate limiting and errors gracefully

#### 2. Email Classification Pipeline (`server/src/services/emailClassificationPipeline.js`)
- Classifies emails using trained DistilBERT model
- Caches classification results in database
- Automatically removes full body after classification
- Background worker for processing pending classifications

#### 3. Training Orchestrator (`server/src/scripts/trainAndClassifyAll.js`)
- Coordinates entire training and classification workflow
- Fetches full bodies → Extracts data → Trains model → Classifies all → Cleanup
- Progress tracking and comprehensive reporting
- Error handling and graceful degradation

#### 4. Updated Gmail Sync Service (`server/src/services/gmailSyncService.js`)
- Modified to fetch full bodies for new emails
- Triggers immediate classification via pipeline
- Automatic cleanup after classification

#### 5. Updated Classification Service (`server/src/services/enhancedClassificationService.js`)
- Checks for cached classifications first
- Uses cached results when available (no re-fetching)
- Fallback to rule-based classification if needed

### Updated Python Scripts

#### extract_training_data.py
- Now extracts `fullBody` field from MongoDB
- Falls back to text/html/body/snippet if fullBody not available
- Generates balanced training dataset

## Installation & Setup

### Prerequisites

1. **MongoDB** - Running locally or remotely
2. **Python 3.8+** - For model training
3. **Node.js 16+** - For server
4. **Gmail API Access** - Connected account
5. **Model Service** - Running on port 8000

### Python Dependencies

```bash
cd model_service
pip install -r requirements.txt
```

Required packages:
- `pymongo` - MongoDB connector
- `transformers` - DistilBERT model
- `torch` - PyTorch deep learning
- `scikit-learn` - ML utilities
- `python-dotenv` - Environment variables

## Usage

### Step 1: Start Model Service

```bash
cd model_service
python3 enhanced_app.py
```

Keep this running in a separate terminal.

### Step 2: Run Training & Classification

```bash
# From project root
./train-and-classify.sh
```

OR manually:

```bash
cd server
node src/scripts/trainAndClassifyAll.js
```

### What Happens:

#### Phase 1: Training Data Collection
1. **Fetch Full Bodies** - Downloads full email content from Gmail
   - Progress: "Fetching 1234/5000 emails..."
   - Time: 5-15 minutes (depends on email count)

2. **Extract Training Data** - Extracts from MongoDB
   - Creates `extracted_emails.json`
   - Analyzes category distribution

3. **Prepare Dataset** - Creates balanced training set
   - Creates `email_training_dataset.jsonl`
   - Balances categories (100-200 samples each)

#### Phase 2: Model Training
4. **Train DistilBERT** - Deep learning model training
   - Time: 30-60 minutes
   - GPU accelerated if available
   - Creates `distilbert_email_model/` directory

5. **Evaluate Model** - Tests model performance
   - Generates `evaluation_report.json`
   - Shows accuracy, precision, recall, F1 scores

6. **Load Model** - Loads into model service
   - Model ready for predictions

#### Phase 3: Classify All Emails
7. **Batch Classification** - Classifies all existing emails
   - Progress: "Classified 500/4500 (11%)"
   - Uses trained model with full context
   - Caches results in database

#### Phase 4: Cleanup & Verification
8. **Cleanup Full Bodies** - Removes temporary data
   - Deletes `fullBody`, `html`, `text`, `body` fields
   - Keeps only metadata + cached classification
   - Database returns to lightweight state

9. **Final Statistics** - Shows category distribution
   - Promotions: 300 emails
   - Assistant: 150 emails
   - HOD: 80 emails
   - Etc.

## Expected Results

After completion, you should see proper distribution:

| Category | Expected Count | Description |
|----------|----------------|-------------|
| **Promotions** | 200-400 | Marketing emails, offers, deals |
| **Assistant** | 100-200 | Assistant professor emails |
| **HOD** | 50-100 | Head of Department communications |
| **NPTEL** | 100-200 | NPTEL course emails |
| **E-Zone** | 100-200 | Student portal emails |
| **Placement** | 150-300 | Job placement emails |
| **Whats happening** | 100-200 | Campus events |
| **Other** | 500-1000 | Miscellaneous |

## How It Works for New Emails

Once the model is trained, new emails are handled automatically:

### 1. Email Synced from Gmail
```javascript
// gmailSyncService.js
const emailData = parseEmailMessage(message)
emailData.fullBody = emailData.text || emailData.html || emailData.snippet
emailData.needsClassification = true
const savedEmail = await upsertEmail(user, emailData)
```

### 2. Immediate Classification
```javascript
// emailClassificationPipeline.js
const result = await classifyAndCache(savedEmail, userId)
// Classifies with trained model
// Caches result in email.classification
// Removes fullBody, html, text, body fields
```

### 3. Cached for Fast Retrieval
```javascript
// enhancedClassificationService.js
if (emailData.classification && 
    emailData.classification.model === 'distilbert-trained') {
  return cachedClassification // Fast!
}
```

## Database Schema Changes

### New Fields in Email Model:

```javascript
{
  // Temporary fields (removed after classification)
  fullBody: String,          // Full email body for training/classification
  needsClassification: Boolean, // Flag for pending classification
  
  // Permanent fields
  isTrainingData: Boolean,   // Used during training phase
  classification: {
    label: String,           // Cached classification
    confidence: Number,
    model: String,           // 'distilbert-trained'
    classifiedAt: Date,
    // ... other metadata
  }
}
```

## Monitoring & Maintenance

### Check Classification Status

```javascript
// Find emails pending classification
db.emails.find({ needsClassification: true }).count()

// Check cached classifications
db.emails.find({ 
  'classification.model': 'distilbert-trained' 
}).count()
```

### Manually Trigger Classification

```bash
cd server
node -e "
import('./src/services/emailClassificationPipeline.js').then(async (module) => {
  await module.processPendingClassifications('USER_ID_HERE')
  process.exit(0)
})
"
```

### Retrain Model (Monthly Recommended)

```bash
# Fetch new email bodies
# Train model with updated data
./train-and-classify.sh
```

## Troubleshooting

### Issue: "No emails found to classify"

**Cause**: Database has no emails or all emails already classified

**Solution**: 
1. Check if Gmail is synced: `db.emails.count()`
2. Sync Gmail: Open app → Settings → Sync
3. Run script again

### Issue: "Model service not running"

**Cause**: Model service not started

**Solution**:
```bash
cd model_service
python3 enhanced_app.py
```

### Issue: "Failed to fetch email bodies"

**Cause**: Gmail API rate limiting or token expired

**Solution**:
1. Wait a few minutes (rate limit)
2. Re-authenticate Gmail in app
3. Check `gmailAccessToken` is valid

### Issue: "Training failed - Out of memory"

**Cause**: Insufficient RAM for training

**Solution**:
1. Reduce batch size in `train_email_classifier.py`
2. Close other applications
3. Use GPU if available
4. Train on subset of data

### Issue: "Low classification accuracy"

**Cause**: Insufficient or poor quality training data

**Solution**:
1. Ensure at least 100 emails per category
2. Check `evaluation_report.json` for insights
3. Review category definitions in `categories.json`
4. Retrain with more data

## Performance Metrics

### Training Performance

- **Data Extraction**: ~1 minute per 1000 emails
- **Dataset Preparation**: ~2-3 minutes
- **Model Training**: 30-60 minutes (CPU), 10-20 minutes (GPU)
- **Classification**: ~100-200 emails/minute
- **Total Time**: 40-80 minutes for 5000 emails

### Resource Usage

- **RAM**: 4-8 GB during training
- **Storage**: ~500 MB for trained model
- **Database**: Lightweight (no long-term full bodies)
- **Network**: ~100KB per email for Gmail API

## API Endpoints

### Model Service (Port 8000)

```bash
# Get status
GET /status

# Classify single email
POST /predict
{
  "subject": "Email subject",
  "body": "Full email body",
  "user_id": "user123"
}

# Load trained model
POST /model/load
{
  "model_path": "/path/to/distilbert_email_model"
}
```

## File Structure

```
Sortify-/
├── server/
│   └── src/
│       ├── models/
│       │   └── Email.js (updated with new fields)
│       ├── services/
│       │   ├── gmailBulkFetcher.js (NEW)
│       │   ├── emailClassificationPipeline.js (NEW)
│       │   ├── gmailSyncService.js (updated)
│       │   └── enhancedClassificationService.js (updated)
│       └── scripts/
│           └── trainAndClassifyAll.js (NEW)
├── model_service/
│   ├── extract_training_data.py (updated)
│   ├── prepare_distilbert_dataset.py
│   ├── train_email_classifier.py
│   ├── evaluate_model.py
│   └── enhanced_app.py
└── train-and-classify.sh (NEW - main runner)
```

## Security Considerations

1. **Gmail Access Tokens** - Stored securely, refreshed automatically
2. **Full Body Storage** - Temporary only, removed after classification
3. **Model Files** - Local storage, not exposed publicly
4. **API Security** - Model service should be internal only

## Future Enhancements

### Possible Improvements:

1. **User-Specific Models** - Train separate models per user
2. **Active Learning** - Use user corrections to improve model
3. **Real-time Classification** - WebSocket updates during sync
4. **Category Suggestions** - AI-powered category recommendations
5. **Multi-language Support** - Classify emails in different languages

## Support & Maintenance

### Regular Tasks:

- **Weekly**: Monitor classification accuracy
- **Monthly**: Retrain model with new data
- **Quarterly**: Review and update category definitions
- **Yearly**: Upgrade DistilBERT to newer versions

### Logs to Monitor:

```bash
# Server logs
tail -f server/logs/backend.log

# Model service logs
tail -f model_service/model_service.log

# MongoDB logs
tail -f /var/log/mongodb/mongod.log
```

## Summary

This system provides:

✅ **Accurate Classification** - Uses full email bodies for context  
✅ **Efficient Storage** - Removes full bodies after classification  
✅ **Fast Retrieval** - Cached classifications for instant access  
✅ **Automatic Processing** - New emails classified on sync  
✅ **Scalable Architecture** - Handles thousands of emails  
✅ **Production Ready** - Error handling, monitoring, logging  

Your email classification system is now production-ready!

## Quick Reference

```bash
# Start model service
cd model_service && python3 enhanced_app.py

# Train and classify everything
./train-and-classify.sh

# Check classification status
db.emails.aggregate([
  { $match: { isDeleted: false } },
  { $group: { _id: '$category', count: { $sum: 1 } } }
])

# Manually classify pending emails
node server/src/scripts/trainAndClassifyAll.js
```

---

**Questions?** Check the troubleshooting section or review the code comments in the source files.

