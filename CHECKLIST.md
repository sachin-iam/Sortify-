# Email Classification Training - Checklist

## Pre-Training Checklist

Before running the training script, verify:

- [ ] **MongoDB is running**
  ```bash
  # Check status
  sudo systemctl status mongodb
  # or
  pgrep -f mongod
  ```

- [ ] **Gmail account is connected**
  - Open Sortify app
  - Go to Settings
  - Verify Gmail is connected
  - Check green checkmark next to Gmail

- [ ] **Emails are synced**
  - Open Sortify app
  - Should see emails in dashboard
  - If not, click "Sync" button

- [ ] **Model service is running**
  ```bash
  # Terminal 1 - Keep this open
  cd model_service
  python3 enhanced_app.py
  ```
  - Should see: `Uvicorn running on http://0.0.0.0:8000`

- [ ] **Run validation script**
  ```bash
  cd server
  node src/scripts/validateSetup.js
  ```
  - All checks should pass ✅

## Training Process Checklist

- [ ] **Step 1: Start model service** (if not already running)
  ```bash
  # Terminal 1
  cd model_service
  python3 enhanced_app.py
  ```

- [ ] **Step 2: Run training script**
  ```bash
  # Terminal 2
  cd /Users/sachingupta/Desktop/Sortify-
  ./train-and-classify.sh
  ```

- [ ] **Step 3: Wait for completion** (40-80 minutes)
  - Watch progress messages
  - Don't close terminals
  - Don't interrupt process

- [ ] **Step 4: Verify success**
  - Look for: `✅ TRAINING & CLASSIFICATION COMPLETE!`
  - Check final category distribution
  - All categories should have emails

## Post-Training Verification

- [ ] **Check category distribution**
  ```bash
  mongosh sortify --eval "
  db.emails.aggregate([
    { \$match: { isDeleted: false } },
    { \$group: { _id: '\$category', count: { \$sum: 1 } } },
    { \$sort: { count: -1 } }
  ])
  "
  ```

- [ ] **Verify these categories have emails**:
  - [ ] Promotions: Should have 200+ emails
  - [ ] Assistant: Should have 100+ emails
  - [ ] HOD: Should have 50+ emails
  - [ ] NPTEL: Should have 100+ emails
  - [ ] E-Zone: Should have 100+ emails
  - [ ] Placement: Should have emails
  - [ ] Whats happening: Should have emails

- [ ] **Check database is clean**
  ```bash
  mongosh sortify --eval "
  db.emails.find({ fullBody: { \$exists: true } }).count()
  "
  ```
  - Should return: 0 (bodies removed)

- [ ] **Verify cached classifications**
  ```bash
  mongosh sortify --eval "
  db.emails.find({ 
    'classification.model': 'distilbert-trained' 
  }).count()
  "
  ```
  - Should return: ~6000+ (all emails classified)

## Application Testing

- [ ] **Refresh browser**
  - Press Ctrl+R (Cmd+R on Mac)
  - Hard refresh: Ctrl+Shift+R

- [ ] **Check each category**
  - [ ] Click "Promotions" - should see promotional emails
  - [ ] Click "Assistant" - should see assistant prof emails
  - [ ] Click "HOD" - should see HOD emails
  - [ ] Click "NPTEL" - should see NPTEL emails
  - [ ] Click "E-Zone" - should see portal emails
  - [ ] Click "Placement" - should see job emails
  - [ ] Click "Whats happening" - should see event emails

- [ ] **Test new email classification**
  - Sync Gmail (click Sync button)
  - Wait for new emails
  - Check they appear in correct categories
  - Verify classification is fast (<1 second)

## Monitoring Checklist (First Week)

- [ ] **Day 1: Check classification accuracy**
  - Review categorized emails
  - Note any misclassifications
  - Check confidence scores

- [ ] **Day 3: Verify new email handling**
  - Sync new emails
  - Verify auto-classification works
  - Check database size hasn't grown significantly

- [ ] **Day 7: Review performance**
  - Check server logs for errors
  - Verify model service is stable
  - Note classification accuracy

## Troubleshooting Checklist

If something goes wrong:

### Training Failed

- [ ] Check MongoDB is running
- [ ] Check model service is running
- [ ] Check Gmail token hasn't expired
- [ ] Review error messages in terminal
- [ ] Check server logs: `tail -f server/logs/backend.log`
- [ ] Check model service logs: `tail -f model_service/model_service.log`

### Categories Still Empty

- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Check MongoDB has classified emails (see verification above)
- [ ] Clear browser cache
- [ ] Check browser console for errors (F12)
- [ ] Restart server and try again

### New Emails Not Classified

- [ ] Check model service is running
- [ ] Check server logs for classification errors
- [ ] Manually trigger classification:
  ```bash
  mongosh sortify --eval "
  db.emails.updateMany(
    { needsClassification: false, 'classification.model': { \$ne: 'distilbert-trained' } },
    { \$set: { needsClassification: true } }
  )
  "
  ```
- [ ] Restart server

### Database Too Large

- [ ] Check for emails with full bodies:
  ```bash
  mongosh sortify --eval "
  db.emails.find({ fullBody: { \$exists: true } }).count()
  "
  ```
- [ ] If >0, run cleanup:
  ```bash
  cd server
  node -e "
  import('./src/services/gmailBulkFetcher.js').then(async (m) => {
    await m.cleanupFullBodies('USER_ID_HERE')
    process.exit(0)
  })
  "
  ```

## Maintenance Checklist (Monthly)

- [ ] **Review classification accuracy**
  - Check misclassified emails
  - Note patterns in errors

- [ ] **Retrain model**
  ```bash
  ./train-and-classify.sh
  ```
  - Incorporates new emails
  - Improves accuracy

- [ ] **Check disk space**
  - MongoDB database size
  - Model files size
  - Logs size

- [ ] **Update categories** (if needed)
  - Review `model_service/categories.json`
  - Add/remove categories
  - Update keywords and patterns

## Quick Reference

```bash
# Start model service
cd model_service && python3 enhanced_app.py

# Validate setup
cd server && node src/scripts/validateSetup.js

# Run training
./train-and-classify.sh

# Check status
mongosh sortify --eval "db.emails.aggregate([
  { \$match: { isDeleted: false } },
  { \$group: { _id: '\$category', count: { \$sum: 1 } } }
])"

# Check logs
tail -f server/logs/backend.log
tail -f model_service/model_service.log
```

## Success Indicators

You'll know it's working when:

✅ All categories have emails (>0 count)  
✅ Promotions has 200+ emails  
✅ Assistant has 100+ emails  
✅ HOD has 50+ emails  
✅ New emails appear in correct categories immediately  
✅ Database size is reasonable (<1GB for 5000 emails)  
✅ No full bodies stored in database  
✅ Server logs show no classification errors  
✅ Users can browse emails by category smoothly  

## Complete!

Once all checkboxes are checked, your email classification system is fully operational! 🎉

---

**Need help?** Check:
- `QUICK_START_CLASSIFICATION.md` - Quick start guide
- `EMAIL_CLASSIFICATION_SYSTEM.md` - Full documentation
- `IMPLEMENTATION_SUMMARY_CLASSIFICATION.md` - Technical details

