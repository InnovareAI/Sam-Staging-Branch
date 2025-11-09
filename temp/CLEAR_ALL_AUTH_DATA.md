# Clear All Auth Data - Fix "No Workspaces" Issue

## The Problem

Your browser has corrupted session/cookie data causing:
- Cookie parsing errors
- Auth APIs returning 401 errors
- Workspace APIs returning 0 workspaces

## The Fix

Run these commands in your browser console (F12):

```javascript
// 1. Clear all SAM-related localStorage
Object.keys(localStorage).forEach(key => {
  if (key.includes('supabase') || key.includes('workspace') || key.includes('auth')) {
    console.log('Removing:', key);
    localStorage.removeItem(key);
  }
});

// 2. Clear all SAM-related sessionStorage
Object.keys(sessionStorage).forEach(key => {
  if (key.includes('supabase') || key.includes('workspace') || key.includes('auth')) {
    console.log('Removing:', key);
    sessionStorage.removeItem(key);
  }
});

// 3. Clear specific known keys
localStorage.removeItem('selectedWorkspaceId');
localStorage.removeItem('sb-latxadqrvrrrcvkktrog-auth-token');

// 4. Confirm cleanup
console.log('✅ localStorage cleared');
console.log('✅ sessionStorage cleared');
console.log('🔄 Now refresh the page and log in again');
```

## Alternative: Manual Browser Cleanup

### Chrome/Edge
1. Press F12 to open DevTools
2. Go to Application tab
3. Under Storage:
   - Click "Clear site data"
   - Check all boxes
   - Click "Clear site data"
4. Close the tab completely
5. Open a new tab and go to https://app.meet-sam.com
6. Log in fresh

### Firefox
1. Press F12 to open DevTools
2. Go to Storage tab
3. Right-click on each item under:
   - Local Storage
   - Session Storage
   - Cookies
4. Select "Delete All"
5. Close the tab completely
6. Open a new tab and go to https://app.meet-sam.com
7. Log in fresh

## After Clearing

You should see in the console:
```
✅ [WORKSPACE LOAD] API returned X workspaces (where X > 0)
✅ [WORKSPACE LOAD] Auto-selecting first workspace: ...
```

If you still see "0 workspaces", that means there's a database issue (not a browser issue).
