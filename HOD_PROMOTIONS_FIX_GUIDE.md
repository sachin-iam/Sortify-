# HOD and Promotions Classification Fix - Complete Guide

## 🎯 Problem Solved

### Before the Fix:
- ❌ **HOD emails** with placement/internship content were tagged as "HOD" instead of "Placement"
- ❌ **Promotion emails** with "'Promotions' via..." in sender were tagged as "Whats happening" instead of "Promotions"
- ❌ Category counts showed 0 for HOD and Promotions even though such emails existed

### After the Fix:
- ✅ **Content-first classification**: HOD emails about placements → "Placement" category
- ✅ **Sender-based priority**: "'Promotions' via..." → "Promotions" category
- ✅ **Correct counts**: HOD and Promotions categories show accurate email counts

---

## 🔧 What Was Changed

### 1. **Added Priority System to Categories**

**File**: `server/src/models/Category.js`

Added a new `priority` field to control classification order:
- `high`: Content-specific categories (Promotions, Placement, NPTEL, E-Zone, Whats happening)
- `normal`: Standard categories
- `low`: Fallback categories (HOD)

```javascript
priority: {
  type: String,
  enum: ['high', 'normal', 'low'],
  default: 'normal'
}
```

### 2. **Updated Phase 1 Classification Logic**

**File**: `server/src/services/phase1ClassificationService.js`

**New Priority-Based Matching Order**:

```
Priority Level 1: High-priority categories (checked first)
  └─ Promotions, Placement, NPTEL, E-Zone, Whats happening
  └─ Checks: Sender domain + Sender name + Keywords
  └─ Returns: First match with confidence >= 0.75

Priority Level 2: Normal-priority categories
  └─ Standard categories
  └─ Checks: Sender domain + Sender name + Keywords
  └─ Returns: First match

Priority Level 3: Low-priority categories (checked last)
  └─ HOD
  └─ Checks: Sender domain + Sender name + Keywords
  └─ Returns: First match
```

**Why This Works**:
- **Placement** (high priority) is checked before **HOD** (low priority)
- So "HOD CSE" email about placements → matches Placement keywords first → tagged as "Placement" ✅
- Only HOD emails WITHOUT specific keywords → tagged as "HOD" ✅

### 3. **Improved Pattern Matching**

**Files**: 
- `server/src/routes/categories.js`
- `server/fix-existing-categories.js`

**Promotions Category Patterns**:
```javascript
Sender Names: ['Promotions', "'Promotions'", "Promotions' via", 'Promotion']
Sender Domains: ['promo', 'offer', 'deal', 'marketing']
Keywords: ['promo', 'promotion', 'offer', 'discount', 'sale', 'deal', 
          'limited', 'special', 'off', 'care', 'opd', 'diagnostics', 'percent']
Priority: high
```

**HOD Category Patterns**:
```javascript
Sender Names: ['HOD', 'Head of Department', 'Department Head', 'Dept. Head', 
              'hod.cse', 'hod cse', 'HOD CSE']
Keywords: ['hod', 'department', 'head', 'dept']
Priority: low
```

### 4. **Created Migration Script**

**File**: `server/fix-hod-promotions-classification.js`

Script to update existing categories with:
- Improved patterns
- Correct priority levels
- ML service synchronization

---

## 📋 How to Use

### Step 1: Start Your Application

Make sure MongoDB and your application are running:

```bash
# Start MongoDB (if not running)
# On macOS:
brew services start mongodb-community

# Start the server
cd server
npm start

# Start the client (in another terminal)
cd client
npm run dev
```

### Step 2: Log In and Create Categories

1. Open your application in the browser
2. Log in with your account
3. The system will automatically create default categories
4. Or manually create these categories:
   - **HOD** (will auto-set to low priority)
   - **Promotions** (will auto-set to high priority)
   - **Placement** (will auto-set to high priority)
   - **NPTEL** (will auto-set to high priority)
   - **E-Zone** (will auto-set to high priority)
   - **Whats happening** (will auto-set to high priority)

### Step 3: Run the Migration Script

Update existing categories with improved patterns:

```bash
cd server
node fix-hod-promotions-classification.js
```

**Expected Output**:
```
✅ Connected to MongoDB

🚀 Starting HOD and Promotions Category Fix...

📋 Found 6 categories to fix

🔧 Fixing category: "Promotions" (User: ...)
   - Setting priority: high
   - Sender names: 4
   - Sender domains: 4
   - Keywords: 13
✅ Updated "Promotions"
   - Synced to ML service

🔧 Fixing category: "HOD" (User: ...)
   - Setting priority: low
   - Sender names: 7
   - Keywords: 4
✅ Updated "HOD"
   - Synced to ML service

... (continues for other categories)

============================================================
📊 SUMMARY
============================================================
✅ Successfully fixed: 6
⏭️  Skipped: 0
❌ Failed: 0
```

### Step 4: Reclassify All Emails

1. Go to your Dashboard
2. Click the **"Reclassify All Emails"** button
3. Wait for reclassification to complete (progress shown in UI)
4. Refresh the page

### Step 5: Verify Results

Check that:
- ✅ Promotions category shows correct count (emails with "'Promotions'" in sender)
- ✅ HOD category shows correct count (HOD emails without specific content keywords)
- ✅ Placement category includes HOD emails about placements/internships

---

## 🧪 Testing Examples

### Example 1: Promotion Email
```
From: "'Promotions' via UG Student Group" <ug.group@ug.sharda.ac.in>
Subject: World-Class Cancer Care at Sharda Care - 20% OFF
Content: ...mentions HOD, Radiation Oncology...
```
**Result**: Should be tagged as **Promotions** ✅ (high priority, sender name match)

### Example 2: HOD Email About Placement
```
From: "HOD CSE" <hod.cse@sharda.ac.in>
Subject: Mandatory Participation: Autodesk Internship
Content: ...placement, internship, opportunity...
```
**Result**: Should be tagged as **Placement** ✅ (high priority, keywords match)

### Example 3: HOD Email General Announcement
```
From: "HOD CSE" <hod.cse@sharda.ac.in>
Subject: Department Meeting Schedule
Content: ...department meeting, attendance...
```
**Result**: Should be tagged as **HOD** ✅ (low priority, no competing keywords)

---

## 🔍 Troubleshooting

### Issue: Categories still show 0 emails

**Solution**:
1. Make sure you ran the migration script: `node fix-hod-promotions-classification.js`
2. Click "Reclassify All Emails" in the Dashboard
3. Wait for reclassification to complete
4. Refresh the page

### Issue: Migration script shows "Found 0 categories"

**Solution**:
1. Make sure you're logged into the application first
2. Check that categories exist in the database
3. Verify MongoDB connection string in `.env` file

### Issue: Emails still misclassified

**Solution**:
1. Check the server logs for classification details
2. Verify patterns are set correctly:
   ```bash
   cd server
   node -e "
   import mongoose from 'mongoose';
   import Category from './src/models/Category.js';
   await mongoose.connect(process.env.MONGODB_URI);
   const cat = await Category.findOne({ name: 'Promotions' });
   console.log(cat.patterns);
   console.log('Priority:', cat.priority);
   "
   ```
3. Re-run the migration script
4. Reclassify all emails again

---

## 📊 Technical Details

### Classification Flow

```
New Email Arrives
    ↓
Phase 1: Rule-Based Classification (Immediate)
    ↓
Check HIGH Priority Categories (Promotions, Placement, NPTEL, etc.)
    ├─ Sender Domain Match? → Tag & Return
    ├─ Sender Name Match? → Tag & Return
    └─ Keywords Match (≥0.75 conf)? → Tag & Return
    ↓
Check NORMAL Priority Categories
    ├─ Sender/Keyword Match? → Tag & Return
    ↓
Check LOW Priority Categories (HOD)
    ├─ Sender/Keyword Match? → Tag & Return
    ↓
No Match? → Tag as "Other"
    ↓
Phase 2: ML Refinement (Background, 5s later)
    └─ Improve confidence if needed
```

### Priority Levels Explained

| Priority | Categories | Match Threshold | When Checked |
|----------|-----------|----------------|--------------|
| **high** | Promotions, Placement, NPTEL, E-Zone, Whats happening | ≥0.75 confidence | First |
| **normal** | Default categories | Any match | Second |
| **low** | HOD | Any match | Last (only if no high/normal match) |

---

## ✅ Files Modified

1. ✅ `server/src/models/Category.js` - Added priority field
2. ✅ `server/src/services/phase1ClassificationService.js` - Implemented priority-based matching
3. ✅ `server/src/routes/categories.js` - Updated pattern generation
4. ✅ `server/fix-existing-categories.js` - Updated pattern generation
5. ✅ `server/fix-hod-promotions-classification.js` - New migration script

---

## 🎉 Summary

The fix ensures:

1. **Content-first classification**: Emails are classified based on their content (keywords) first
2. **Sender-based priority for Promotions**: "'Promotions' via..." immediately goes to Promotions
3. **HOD as fallback**: HOD category only catches emails without specific content keywords
4. **Correct email counts**: All categories now show accurate counts

This solves the problem where HOD and Promotions showed 0 emails despite having relevant emails in the inbox.

