# Quick Start - Email Classification Training

## 🚀 Get Your Email Classification Working in 3 Steps!

### Prerequisites Check

Before starting, make sure:
- ✅ MongoDB is running
- ✅ Gmail account is connected in the app
- ✅ You have some emails synced (check in the app)

### Step 1: Start Model Service (Keep Running)

Open a **new terminal** and run:

```bash
cd /Users/sachingupta/Desktop/Sortify-/model_service
python3 enhanced_app.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Leave this terminal open!** The model service must keep running.

### Step 2: Run Training & Classification

Open **another terminal** and run:

```bash
cd /Users/sachingupta/Desktop/Sortify-
./train-and-classify.sh
```

### What Will Happen:

```
═══════════════════════════════════════════════════
  EMAIL CLASSIFICATION TRAINING & DEPLOYMENT
═══════════════════════════════════════════════════

✅ Connected to MongoDB
👤 User: your-email@gmail.com
✅ Model service is running

==================================================
PHASE 1: TRAINING DATA COLLECTION
==================================================

📥 Step 1: Fetching full email bodies from Gmail...
📊 Progress: 100/4500 (2%)
📊 Progress: 500/4500 (11%)
📊 Progress: 1000/4500 (22%)
... (5-15 minutes)

📊 Step 2: Extracting training data...
✓ Extracted 4500 emails
✓ Exported 4500 emails

📋 Step 3: Preparing training dataset...
✓ Created balanced dataset with 9 categories

==================================================
PHASE 2: MODEL TRAINING
==================================================

🎓 Step 4: Training DistilBERT model...
⏱️  This will take 30-60 minutes. Please be patient...

Epoch 1/4: 100%|████████████| 63/63 [05:23<00:00]
Eval accuracy: 0.8240
Epoch 2/4: 100%|████████████| 63/63 [05:21<00:00]
Eval accuracy: 0.8720
... (30-60 minutes)

✅ Training complete! Accuracy: 90.4%

📈 Step 5: Evaluating trained model...
✓ Generated evaluation_report.json

📥 Step 6: Loading trained model...
✅ Model loaded successfully

==================================================
PHASE 3: CLASSIFY ALL EMAILS
==================================================

🤖 Classifying ALL emails...
📧 Found 4500 emails to classify

📦 Processing batch 1/45
✅ Classified: "Placement Drive: TCS" → Placement (0.95)
✅ Classified: "NPTEL Course Update" → NPTEL (0.92)
... (10-20 minutes)

📊 Progress: 1000/4500 (22%) - Classified: 998, Failed: 2
📊 Progress: 2000/4500 (44%) - Classified: 1996, Failed: 4
...

✅ Classification complete!
   Total: 4500
   Classified: 4485
   Failed: 15

==================================================
PHASE 4: CLEANUP & VERIFICATION
==================================================

🧹 Step 8: Cleaning up full email bodies...
✅ Cleaned up 4500 emails
   Removed: fullBody, html, text, body fields
   Kept: subject, from, snippet, classification

📊 Step 9: Final category distribution...

📈 Category Distribution:
──────────────────────────────────────────────────
  Promotions          : 380
  Assistant           : 165
  NPTEL               : 178
  E-Zone              : 192
  Placement           : 245
  Whats happening     : 156
  HOD                 : 78
  Other               : 856
  All                 : 0

═══════════════════════════════════════════════════
✅ TRAINING & CLASSIFICATION COMPLETE!
═══════════════════════════════════════════════════

📊 Summary:
   Emails Fetched: 4500
   Emails Classified: 4485
   Failed Classifications: 15
   Emails Cleaned: 4500

🎉 Your email classification system is ready!
   New emails will be automatically classified on sync.
```

### Step 3: Refresh Your Application

1. Go to your browser
2. Open the Sortify application
3. Press **Ctrl+R** (or **Cmd+R** on Mac) to refresh
4. Click through the categories - you should now see emails!

## ✅ Expected Results

After completion, you should see:

- ✅ **Promotions**: 200-400 promotional emails properly classified
- ✅ **Assistant**: 100-200 emails from assistant professors
- ✅ **HOD**: 50-100 emails from Head of Department
- ✅ **NPTEL**: 100-200 NPTEL course emails
- ✅ **E-Zone**: 100-200 student portal emails
- ✅ **Placement**: 150-300 placement-related emails
- ✅ **Whats happening**: 100-200 campus event emails
- ✅ **Other**: Miscellaneous emails

## 🔄 What Happens to New Emails?

From now on, when new emails are synced:

1. ✅ Full body is fetched automatically
2. ✅ Classified using your trained model
3. ✅ Result is cached for fast retrieval
4. ✅ Full body is removed (DB stays lightweight)
5. ✅ Email appears in correct category instantly!

## 📊 Verify It's Working

### Check in MongoDB:

```bash
mongosh sortify --eval "
db.emails.aggregate([
  { \$match: { isDeleted: false } },
  { \$group: { _id: '\$category', count: { \$sum: 1 } } },
  { \$sort: { count: -1 } }
])
"
```

### Check Cached Classifications:

```bash
mongosh sortify --eval "
db.emails.find({ 
  'classification.model': 'distilbert-trained' 
}).count()
"
```

Should show the number of emails classified with your trained model.

## 🐛 Troubleshooting

### "No user found with Gmail connected"

**Fix**: 
1. Open your Sortify application
2. Go to Settings
3. Connect/Re-connect your Gmail account

### "Model service is not running"

**Fix**: 
```bash
cd model_service
python3 enhanced_app.py
```
Keep this terminal open.

### "No emails found to fetch"

**Fix**: 
1. Open your Sortify application
2. Sync your Gmail account first
3. Wait for emails to appear
4. Run the training script again

### Training takes too long

**Normal**: Training 4000+ emails takes 40-80 minutes.  
**Speed up**: Use a machine with GPU if available.  
**Monitor**: Check progress messages to ensure it's running.

### Categories still show 0 emails

**Fix**: 
1. Hard refresh browser: **Ctrl+Shift+R** (Cmd+Shift+R on Mac)
2. Check MongoDB has classified emails (see "Verify" section above)
3. Check browser console for errors

## 📝 Important Notes

1. **First Time Only**: This training process is only needed once (or when you want to retrain)
2. **Keep Model Service Running**: The model service should keep running for new email classification
3. **Database Size**: Your database will be lightweight - full bodies are not stored long-term
4. **New Emails**: Automatically classified when synced
5. **Retraining**: Recommended monthly to improve accuracy

## 🎯 Next Steps

After successful training:

1. ✅ Verify all categories have emails
2. ✅ Test by syncing new emails
3. ✅ Check that new emails are classified correctly
4. ✅ Monitor classification accuracy
5. ✅ Retrain monthly with new data

## 📚 More Information

- **Full Documentation**: See `EMAIL_CLASSIFICATION_SYSTEM.md`
- **API Details**: See `model_service/enhanced_app.py`
- **Training Guide**: See `model_service/TRAINING_GUIDE.md`

## 🆘 Need Help?

1. Check `EMAIL_CLASSIFICATION_SYSTEM.md` for detailed documentation
2. Review server logs: `tail -f server/logs/backend.log`
3. Review model service logs: `tail -f model_service/model_service.log`
4. Check MongoDB: `mongosh sortify`

---

## Summary Commands

```bash
# Terminal 1 - Keep running
cd model_service && python3 enhanced_app.py

# Terminal 2 - Run once
cd /Users/sachingupta/Desktop/Sortify-
./train-and-classify.sh

# Then refresh browser
# Press Ctrl+R or Cmd+R
```

That's it! Your email classification system is ready! 🎉

