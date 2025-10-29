# Sortify Email Classification - Quick Reference

## 🚀 Quick Commands

### Training

```bash
cd model_service

# Complete training pipeline (one command)
./run_complete_training.sh

# Manual steps
python3 extract_training_data.py      # Extract from MongoDB
python3 analyze_category_patterns.py  # Analyze patterns
python3 prepare_distilbert_dataset.py # Prepare dataset
python3 train_email_classifier.py     # Train model
python3 evaluate_model.py              # Evaluate performance
```

### Reclassification

```bash
cd model_service

# Preview changes (safe)
./run_reclassification.sh --dry-run

# Test on 100 emails
./run_reclassification.sh --sample 100

# Reclassify all emails
./run_reclassification.sh

# Fast mode with direct model
./run_reclassification.sh --direct-model
```

### Backup & Rollback

```bash
# Create backup
python3 backup_classifications.py

# Rollback to backup
python3 rollback_reclassification.py classification_backup_YYYYMMDD_HHMMSS.json
```

## 📊 Check Status

### Model Service

```bash
# Check if running
curl http://localhost:8000/health

# Start model service
cd model_service && python3 enhanced_app.py
```

### MongoDB

```bash
# Check status
sudo systemctl status mongodb

# Check email counts by category
mongo sortify --eval "db.emails.aggregate([
  {$match: {isDeleted: {$ne: true}}},
  {$group: {_id: '\$category', count: {$sum: 1}}},
  {$sort: {count: -1}}
])"
```

### Training Status

```bash
# Check if model exists
ls -la model_service/distilbert_email_model/

# View training results
cat model_service/distilbert_email_model/training_results.json | python3 -m json.tool
```

## 🎯 Common Operations

### 1. First-Time Setup

```bash
# 1. Train the model
cd model_service
./run_complete_training.sh

# 2. Load model into service
curl -X POST http://localhost:8000/model/load \
  -H 'Content-Type: application/json' \
  -d '{"model_path": "/absolute/path/to/distilbert_email_model"}'

# 3. Reclassify all emails
./run_reclassification.sh --dry-run  # Preview
./run_reclassification.sh            # Execute
```

### 2. Update Model (Retraining)

```bash
cd model_service

# 1. Extract latest data
python3 extract_training_data.py

# 2. Retrain
python3 train_email_classifier.py --output-dir distilbert_email_model_v2

# 3. Evaluate
python3 evaluate_model.py --model-path distilbert_email_model_v2

# 4. Load new model
curl -X POST http://localhost:8000/model/load \
  -H 'Content-Type: application/json' \
  -d '{"model_path": "/path/to/distilbert_email_model_v2"}'
```

### 3. Fix Misclassifications

```bash
# 1. Identify problem category
./run_reclassification.sh --category "Promotions" --dry-run

# 2. Reclassify just that category
./run_reclassification.sh --category "Promotions"
```

### 4. Testing New Categories

```bash
# Add new category to categories.json
# Then retrain and reclassify

cd model_service
./run_complete_training.sh         # Retrain with new category
./run_reclassification.sh --dry-run  # Preview changes
./run_reclassification.sh            # Execute
```

## 🔧 Troubleshooting

### Model Service Won't Start

```bash
# Check port availability
lsof -i :8000

# Check Python dependencies
pip install -r model_service/requirements.txt

# Start with logs
cd model_service && python3 enhanced_app.py 2>&1 | tee service.log
```

### MongoDB Connection Issues

```bash
# Start MongoDB
sudo systemctl start mongodb

# Check connection
mongo --eval "db.runCommand({ connectionStatus: 1 })"

# Reset connection
sudo systemctl restart mongodb
```

### Low Classification Accuracy

```bash
# 1. Check training metrics
cat model_service/distilbert_email_model/training_results.json

# 2. Review evaluation
cat model_service/evaluation_report.json

# 3. Check category patterns
cat model_service/category_patterns_report.json

# 4. Retrain with more data or adjust parameters
python3 train_email_classifier.py --num-epochs 6 --batch-size 32
```

### Reclassification Fails

```bash
# 1. Check logs
tail -f model_service/reclassification_report_*.json

# 2. Rollback
python3 rollback_reclassification.py [backup_file]

# 3. Try with smaller batch
python3 reclassify_all_emails.py --batch-size 50

# 4. Use API mode instead of direct
python3 reclassify_all_emails.py  # (without --use-direct-model)
```

## 📈 Monitoring

### Check Processing Speed

```bash
# During reclassification, monitor with:
watch -n 1 'tail -20 reclassification.log'
```

### View Real-time Categories

```bash
# Watch category distribution change
watch -n 5 'mongo sortify --quiet --eval "
  db.emails.aggregate([
    {$match: {isDeleted: {$ne: true}}},
    {$group: {_id: \"$category\", count: {$sum: 1}}},
    {$sort: {count: -1}}
  ]).forEach(printjson)
"'
```

## 🎓 Category Definitions

| Category | ID | Keywords | Sender Patterns |
|----------|----|-----------|---------------------------------|
| Placement | 1 | job, recruitment, interview | infylearn.com, placement@ |
| NPTEL | 2 | course, lecture, nptel | nptel.iitm.ac.in |
| HOD | 3 | notice, mandatory, administrative | HOD, Department Head |
| E-Zone | 4 | login, password, portal | ezone@, student.sharda |
| Promotions | 5 | offer, discount, deal | marketing@, promo@ |
| Whats happening | 6 | event, happening, campus | What's Happening, events@ |
| Assistant | 7 | university, student, office | sharda.ac.in |
| Other | 0 | misc, general | - |
| All | 8 | (meta-category) | - |

## 📁 Important Files

```
Sortify-/
├── model_service/
│   ├── categories.json                    # Category definitions
│   ├── distilbert_email_model/           # Trained model
│   ├── extracted_emails.json              # Training data
│   ├── category_patterns_report.json     # Pattern analysis
│   ├── email_training_dataset.jsonl      # Training dataset
│   ├── evaluation_report.json            # Model performance
│   ├── reclassification_report_*.json   # Reclassification results
│   └── classification_backup_*.json     # Backups
├── TRAINING_GUIDE.md                     # Training documentation
├── RECLASSIFICATION_GUIDE.md            # Reclassification docs
├── DISTILBERT_TRAINING_COMPLETE.md      # Training summary
└── RECLASSIFICATION_COMPLETE.md         # Reclassification summary
```

## 💡 Pro Tips

### Speed Up Processing

```bash
# Use GPU if available
export CUDA_VISIBLE_DEVICES=0
./run_reclassification.sh --direct-model

# Or increase batch size
python3 reclassify_all_emails.py --batch-size 200
```

### Confidence Filtering

```bash
# Only update very confident predictions
python3 reclassify_all_emails.py --min-confidence 0.85
```

### Incremental Reclassification

```bash
# Process each category separately
for cat in "Other" "Assistant" "Promotions"; do
  ./run_reclassification.sh --category "$cat"
done
```

### Scheduled Retraining

Add to crontab for monthly retraining:
```bash
# Retrain model first Sunday of each month at 2 AM
0 2 1-7 * 0 cd /path/to/Sortify-/model_service && ./run_complete_training.sh
```

## 🆘 Emergency Procedures

### System Unresponsive During Reclassification

```bash
# Don't kill the process! Wait for batch to complete
# Monitor progress:
tail -f reclassification_report_*.json

# If must stop, use Ctrl+C (will complete current batch)
```

### Accidentally Deleted Backup

```bash
# Create new backup from current state
python3 backup_classifications.py

# MongoDB backup
mongodump --db sortify --collection emails --out backup_$(date +%Y%m%d)
```

### Wrong Model Loaded

```bash
# Reload correct model
curl -X POST http://localhost:8000/model/load \
  -H 'Content-Type: application/json' \
  -d '{"model_path": "/correct/path/to/model"}'

# Verify
curl http://localhost:8000/status
```

## 📞 Quick Help

- **Training issues**: Check `TRAINING_GUIDE.md`
- **Reclassification issues**: Check `RECLASSIFICATION_GUIDE.md`
- **API documentation**: Visit http://localhost:8000/docs
- **Model performance**: Review `evaluation_report.json`

---

**Most Common Workflow:**
```bash
cd model_service
./run_complete_training.sh          # Train once
./run_reclassification.sh --dry-run # Preview
./run_reclassification.sh           # Execute
```

