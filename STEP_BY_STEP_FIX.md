# Step-by-Step Fix for Email Classification

## 🎯 Current Situation

- **Database**: 518 emails (only today's sync)
- **Gmail Inbox**: ~6,300 emails
- **Problem**: Missing 5,800+ historical emails
- **Training**: Failed due to MongoDB Atlas timeout (cloud database issue)

## ✅ New Approach (Simpler & More Reliable)

Instead of complex training with full bodies (which times out), we'll:
1. **Full Sync** - Get all 6,300 emails as metadata
2. **Train on snippets** - Snippets are enough for classification!
3. **Reclassify all** - Use trained model to fix categories

## 📋 Step-by-Step Instructions

### Step 1: Run Full Sync (Get All Emails)

**What to do:**
1. Open your browser → Sortify dashboard
2. Find the Gmail card
3. Click **"Full Sync (All)"** button (purple)
4. Wait 15-30 minutes

**OR via terminal:**
```bash
curl -X POST http://localhost:5000/api/emails/gmail/full-sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What happens:**
- Fetches all 6,300+ emails from Gmail
- Stores metadata (subject, from, snippet, date)
- Progress updates every 500 emails
- Total time: 15-30 minutes

**Check progress:**
```bash
# Watch email count increase
watch -n 10 "mongosh sortify --quiet --eval 'db.emails.countDocuments({})'"
```

### Step 2: Train Model on Snippets

Once full sync completes and you have 6,300+ emails:

```bash
cd /Users/sachingupta/Desktop/Sortify-/model_service

# Extract training data (from snippets)
python3 extract_training_data.py

# Prepare dataset
python3 prepare_distilbert_dataset.py

# Train model (30-60 min)
python3 train_email_classifier.py

# Evaluate
python3 evaluate_model.py
```

**OR use the all-in-one script:**
```bash
cd /Users/sachingupta/Desktop/Sortify-/model_service
./run_complete_training.sh
```

**Time**: 40-70 minutes total

**Check if complete:**
```bash
ls -la model_service/distilbert_email_model/
# Should show: pytorch_model.bin, config.json, etc.
```

### Step 3: Load Trained Model

```bash
curl -X POST http://localhost:8000/model/load \
  -H 'Content-Type: application/json' \
  -d '{"model_path": "/Users/sachingupta/Desktop/Sortify-/model_service/distilbert_email_model"}'
```

**Check if loaded:**
```bash
curl http://localhost:8000/status | python3 -m json.tool
# Should show model details
```

### Step 4: Reclassify All Emails

**What to do:**
1. Go to dashboard
2. Click **"Reclassify All"** button (green)
3. Wait 10-20 minutes
4. Refresh browser

**OR via terminal:**
```bash
curl -X POST http://localhost:5000/api/emails/reclassify-all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What happens:**
- Reclassifies all 6,300+ emails
- Uses trained model
- Updates categories
- Progress: 1,000/6,300 (16%), 2,000/6,300 (32%), etc.

### Step 5: Verify Success

**Check category distribution:**
```bash
mongosh sortify --eval "
db.emails.aggregate([
  { \$match: { isDeleted: false } },
  { \$group: { _id: '\$category', count: { \$sum: 1 } } },
  { \$sort: { count: -1 } }
])
"
```

**Should see:**
```
Promotions: 1,200
Assistant: 450
NPTEL: 320
E-Zone: 380
Placement: 680
Whats happening: 560
HOD: 145
Other: 865
```

All categories should have emails! ✅

## 🚀 Quick Command Summary

```bash
# 1. Full sync (via dashboard or curl)
# Click "Full Sync (All)" button in dashboard
# Wait 15-30 minutes

# 2. Check email count
mongosh sortify --eval "db.emails.countDocuments({})"
# Should show ~6,300

# 3. Train model
cd model_service
./run_complete_training.sh
# Wait 40-70 minutes

# 4. Load model
curl -X POST http://localhost:8000/model/load \
  -H 'Content-Type: application/json' \
  -d '{"model_path": "/Users/sachingupta/Desktop/Sortify-/model_service/distilbert_email_model"}'

# 5. Reclassify all (via dashboard)
# Click "Reclassify All" button
# Wait 10-20 minutes

# 6. Verify
mongosh sortify --eval "db.emails.aggregate([
  { \$match: { isDeleted: false } },
  { \$group: { _id: '\$category', count: { \$sum: 1 } } }
])"
```

## ⏱️ Total Time Estimate

| Step | Duration | Can Run In Parallel? |
|------|----------|---------------------|
| Full Sync | 15-30 min | ✅ Start immediately |
| Model Training | 40-70 min | ✅ Start after full sync |
| Reclassification | 10-20 min | ❌ Wait for training |
| **Total** | **65-120 min** | If optimized: ~60-80 min |

## 🎯 Optimized Timeline

```
Minute 0:   Start Full Sync
Minute 20:  Full Sync complete (6,300 emails)
Minute 20:  Start Training (runs in background)
Minute 80:  Training complete
Minute 80:  Start Reclassification
Minute 95:  Reclassification complete
            ✅ ALL DONE!
```

## 🎉 Final Verification Checklist

After completing all steps:

- [ ] Total emails: ~6,300 (check dashboard)
- [ ] Promotions category: 800-1,200 emails
- [ ] Assistant category: 300-500 emails
- [ ] HOD category: 100-200 emails
- [ ] NPTEL category: 200-400 emails
- [ ] All categories have emails (>0)
- [ ] New emails auto-classify correctly
- [ ] Categories load quickly
- [ ] No errors in browser console

## 📖 Documentation Reference

- **This File** - Step-by-step fix
- **FULL_SYNC_USAGE_GUIDE.md** - Detailed usage guide
- **EMAIL_CLASSIFICATION_SYSTEM.md** - Complete system docs
- **QUICK_START_CLASSIFICATION.md** - Quick start

## 🆘 If You Get Stuck

1. Check logs: `tail -f server/logs/backend.log`
2. Check model: `curl http://localhost:8000/status`
3. Check database: `mongosh sortify --eval "db.emails.count()"`
4. Refresh browser: Ctrl+Shift+R
5. Restart services if needed

---

**Ready to fix your email classification?**

**Start with Step 1: Click "Full Sync (All)" in your dashboard!** 🚀

