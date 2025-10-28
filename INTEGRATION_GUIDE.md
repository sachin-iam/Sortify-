# Quick Integration Guide - Category Diagnostic Tool

## What We've Built

A comprehensive diagnostic and fix system for the "What's Happening" email classification issue:

### Backend (Already Integrated ✓)
- ✅ Diagnostic API endpoint: `GET /api/diagnostic/whats-happening`
- ✅ Fix API endpoint: `POST /api/diagnostic/fix-whats-happening`
- ✅ Route registered in server.js

### Frontend (Ready to Use)
- ✅ React component: `CategoryDiagnostic.jsx`
- ✅ Beautiful UI with real-time status
- ✅ One-click fix button

### Standalone Scripts (Optional)
- ✅ Command-line diagnostic: `diagnose-whats-happening.js`
- ✅ Command-line fix: `fix-whats-happening-classification.js`

## How to Use

### Option 1: Add UI Component to Dashboard (Recommended)

1. **Import the component** in your `Dashboard.jsx`:

```jsx
import CategoryDiagnostic from '../components/CategoryDiagnostic'
```

2. **Add it to your dashboard render**:

```jsx
<div className="container mx-auto px-4 py-8">
  {/* Add this at the top of your dashboard */}
  <CategoryDiagnostic />
  
  {/* Rest of your dashboard content */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {/* ... existing dashboard cards ... */}
  </div>
</div>
```

3. **Restart your development server**:
```bash
cd client
npm run dev
```

4. **Use the tool**:
   - Click "Run Diagnostic" to analyze the issue
   - Review the results and recommendations
   - Click "Apply Fix" to automatically reclassify emails
   - Refresh your browser to see the updated email list

### Option 2: Use API Directly (For Testing)

```bash
# 1. Get your authentication token
TOKEN="your_jwt_token_here"

# 2. Run diagnostic
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/diagnostic/whats-happening

# 3. Apply fix
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/diagnostic/fix-whats-happening
```

### Option 3: Use Browser Console (Quick Test)

```javascript
// Open browser console (F12) while logged in to your dashboard
// Then run:

// 1. Diagnostic
fetch('http://localhost:5000/api/diagnostic/whats-happening', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log('Diagnosis:', data))

// 2. Fix (if needed)
fetch('http://localhost:5000/api/diagnostic/fix-whats-happening', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log('Fix result:', data))
```

## What the Fix Does

1. **Analyzes** all emails from "What's Happening" senders
2. **Creates/Updates** the "Whats happening" category with:
   - Sender domain patterns: `batch2022-2023@ug.sharda.ac.in`, `ug.group@ug.sharda.ac.in`
   - Sender name patterns: "What's Happening", "Whats Happening"
   - Keywords: happening, announcement, campus, event, notice, circular
3. **Reclassifies** all matching emails to "Whats happening" category
4. **Clears** analytics cache to refresh dashboard metrics

## Verification Steps

After applying the fix:

1. **Refresh your browser** (Cmd/Ctrl + R)
2. **Click "Refresh Data"** button in dashboard (if available)
3. **Go to Emails tab**
4. **Filter by "Whats happening"** category
5. **Verify** you now see ~2,795 emails (1,149 + 1,013 + 633)

## Troubleshooting

### Issue: Component shows error or doesn't load

**Check:**
- Server is running on port 5000
- You're logged in (token exists in localStorage)
- No CORS errors in browser console

**Solution:**
```bash
# Restart server
cd server
npm run dev

# Restart client
cd client
npm run dev
```

### Issue: Fix applied but emails still show 0

**Solution:**
1. Hard refresh browser (Cmd/Ctrl + Shift + R)
2. Clear browser cache
3. Click "Refresh Data" in dashboard
4. Re-run the diagnostic to verify fix was applied

### Issue: "Not authorized" error

**Solution:**
- Log out and log back in
- Check token expiration
- Verify token in localStorage: `localStorage.getItem('token')`

## File Structure

```
Sortify-/
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   └── diagnostic.js         ← New: API endpoints
│   │   └── server.js                 ← Modified: Added route
│   ├── diagnose-whats-happening.js   ← New: CLI diagnostic
│   └── fix-whats-happening-classification.js  ← New: CLI fix
├── client/
│   └── src/
│       └── components/
│           └── CategoryDiagnostic.jsx ← New: UI component
├── WHATS_HAPPENING_FIX_GUIDE.md      ← New: Detailed guide
└── INTEGRATION_GUIDE.md              ← This file
```

## Next Steps

1. **Restart your server** to load the new diagnostic routes
2. **Add the CategoryDiagnostic component** to your dashboard
3. **Run the diagnostic** to see current status
4. **Apply the fix** if issues are detected
5. **Verify** emails now show correctly in category filter

## Support

If you encounter any issues:

1. Check server logs for error messages
2. Check browser console for client-side errors
3. Review the detailed guide: `WHATS_HAPPENING_FIX_GUIDE.md`
4. Check network tab in DevTools for API responses

---

**Quick Start Command:**
```bash
# Backend is ready - just restart if needed
cd server && npm run dev

# Frontend - add component to Dashboard.jsx
# Then restart
cd client && npm run dev
```

**Success Indicators:**
- ✅ Diagnostic shows: "No issues detected"
- ✅ "Whats happening" filter shows 2,795+ emails
- ✅ Top Senders matches category filter counts
- ✅ Dashboard metrics updated correctly

