# Prospect Recovery Guide

## Current Status

✅ **Your prospects are SAFE in the database!**

You have **200 pending prospects** from today ready to review:

### Recent Sessions

1. **Session 1:** 100 prospects - "CISO US 2025 - 2nd Degree"
   - Session ID: `51b7df55-6ef0-4f0c-8ad9-73ba1b7ab96c`
   - Created: 46 minutes ago
   - Status: 100 pending

2. **Session 2:** 100 prospects - "CISO US 2025 - 2nd Degree"
   - Session ID: `aa706d01-cfd1-40c9-96b6-61ba8e72b6af`
   - Created: 50 minutes ago
   - Status: 100 pending

---

## How to Access Your Prospects

### Method 1: Via Data Approval Tab (Recommended)

1. Click **"Data Approval"** in the left sidebar
2. Your prospects should automatically load
3. You'll see sessions grouped by campaign name

### Method 2: Direct URL

Navigate to this URL in your browser:

```
/workspace/014509ba-226e-43ee-ba58-ab5f20d2ed08/data-approval?session=51b7df55-6ef0-4f0c-8ad9-73ba1b7ab96c
```

### Method 3: Via Database Query (Verification)

Run this script to verify prospects are in database:

```bash
node scripts/js/show-my-prospects.mjs
```

---

## Why Prospects "Disappeared"

**Root Cause:** The `selectedWorkspaceId` was `null` after page reload.

**What Happened:**
1. You imported 100 prospects via streaming import ✅
2. Prospects saved to database successfully ✅
3. Page reloaded (or navigated away)
4. `selectedWorkspaceId` was lost (not persisted to localStorage) ❌
5. UI couldn't load prospects without workspace context ❌

**The Fix Applied:**
- `selectedWorkspaceId` now persists to localStorage automatically
- On page reload, workspace selection is restored
- Prospects will show in Data Approval tab

---

## Creating Campaign from Your Prospects

Once you can see your prospects in Data Approval:

### Step 1: Review and Approve Prospects

1. Go to **Data Approval** tab
2. Review the 100 prospects
3. Click ✅ to approve the ones you want in your campaign
4. Click ❌ to reject any you don't want

### Step 2: Create Campaign

After approving prospects:

1. Click **"Create Campaign"** button
2. Name your campaign (e.g., "CISO Outreach Q4")
3. Select campaign type (Connector/Messenger/etc.)
4. Write your connection message
5. Click **"Save Campaign"**

### Step 3: Activate Campaign

1. Find your campaign in **Campaign Hub**
2. Click **"Activate"**
3. LinkedIn messages will be sent via N8N workflow

---

## Troubleshooting

### If prospects still don't show:

**Check workspace selection:**
```javascript
// In browser console:
localStorage.getItem('selectedWorkspaceId')
// Should return: "014509ba-226e-43ee-ba58-ab5f20d2ed08"
```

**Force set workspace:**
```javascript
localStorage.setItem('selectedWorkspaceId', '014509ba-226e-43ee-ba58-ab5f20d2ed08');
location.reload();
```

### If Data Approval tab is empty:

1. Check browser console for errors
2. Look for logs starting with `[WORKSPACE LOAD]`
3. Verify you see: "Auto-selecting first workspace"
4. If not, workspace loading failed

---

## Database Verification

Your prospects are stored in:

**Table:** `prospect_approval_data`
**Query:**
```sql
SELECT COUNT(*)
FROM prospect_approval_data
WHERE workspace_id = '014509ba-226e-43ee-ba58-ab5f20d2ed08'
  AND approval_status = 'pending';
```

**Expected Result:** 200+ pending prospects

---

## Next Steps

1. ✅ Reload your page (workspace should auto-load now)
2. ✅ Click "Data Approval" tab
3. ✅ You should see your 200 pending prospects
4. ✅ Review and approve the ones you want
5. ✅ Create campaign from approved prospects

**If you still can't see them, let me know and I'll investigate further!**
