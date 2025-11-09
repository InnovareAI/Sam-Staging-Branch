# Clear Corrupted Cookies - Fix Workspace Loading Issue

## Problem
Supabase session cookies are corrupted, causing 401 authentication errors and preventing workspaces from loading.

## Solution: Clear All Cookies and Re-login

### Step 1: Open Browser Console
- Press `F12` or right-click → Inspect
- Go to "Console" tab

### Step 2: Run This Command
Copy and paste this entire block into the console:

```javascript
// Clear all cookies
document.cookie.split(";").forEach(c => document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"));

// Clear localStorage
localStorage.clear();

// Clear sessionStorage
sessionStorage.clear();

// Reload page
location.reload();
```

### Step 3: After Page Reloads
1. Log back in with your credentials (tl@innovareai.com)
2. Check if workspace IA1 appears at the top
3. Try uploading a CSV file

## Expected Behavior After Fix

✅ Workspaces will load successfully (you should see IA1)
✅ IA1 workspace will be auto-selected
✅ CSV upload will work
✅ Data will be saved to YOUR workspace only (security enforced)

## If Still Not Working

Call the diagnostic endpoint to check status:
```
https://[your-domain]/api/debug/workspace-status
```

This will show:
- Authentication status
- Your user ID and email
- Workspaces you have access to
- Current workspace selection
