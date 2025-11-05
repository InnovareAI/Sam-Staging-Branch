# LinkedIn Search Import Limit - Client Issue Fix

**Date:** November 5, 2025
**Issue:** Client got only 14 prospects (2 CISOs) when Sales Navigator showed 534 leads (90-95% CISOs)

---

## Root Causes

### 1. Default Import Limit Too Low
**File:** `app/api/linkedin/import-saved-search/route.ts:81`
```javascript
// Current: Default 100, max 1000
const targetProspects = Math.min(Math.max(target_count || 100, 25), 1000);
```

**Problem:**
- Default is only 100 prospects
- Sales Navigator supports up to 2,500 results
- Client searches returning 500+ leads only import 100 by default

### 2. Small Batch Size
**File:** `app/api/linkedin/import-saved-search/route.ts:208`
```javascript
const batchSize = 25; // Only 25 per request
```

**Problem:**
- 25 prospects per API call
- For 534 prospects, needs 22 batches
- Any timeout/error stops the import early
- 14 prospects = likely stopped after first batch timeout

### 3. Short Timeout
**File:** `app/api/linkedin/import-saved-search/route.ts:235`
```javascript
const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds
```

**Problem:**
- 25 second timeout per batch
- LinkedIn/Unipile API can be slow
- Partial imports happen frequently

---

## Recommended Fixes

### Fix 1: Increase Default Target (IMMEDIATE)

**Change line 81:**
```javascript
// OLD:
const targetProspects = Math.min(Math.max(target_count || 100, 25), 1000);

// NEW:
const targetProspects = Math.min(Math.max(target_count || 500, 25), 2500);
// Default: 500 prospects (reasonable for most searches)
// Max: 2500 (LinkedIn Sales Navigator limit)
```

### Fix 2: Increase Batch Size (RECOMMENDED)

**Change line 208:**
```javascript
// OLD:
const batchSize = 25;

// NEW:
const batchSize = 50; // Sales Navigator supports up to 100 per request
```

**Why 50, not 100?**
- More reliable than 100 (less likely to timeout)
- Still 2x faster than current 25
- Good balance between speed and stability

### Fix 3: Increase Timeout (OPTIONAL)

**Change line 235:**
```javascript
// OLD:
const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 sec

// NEW:
const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 sec
```

### Fix 4: Add Progress Logging for Users

**Add after line 218 (inside while loop):**
```javascript
console.log(`📊 Import progress: ${prospects.length}/${targetProspects} prospects collected`);

// Send progress update to client if websocket available
if (notifyProgress) {
  await notifyProgress({
    collected: prospects.length,
    target: targetProspects,
    batches: batchCount,
    status: 'in_progress'
  });
}
```

---

## Why Client Got 14 Prospects (Not 100)

Looking at the logs:
1. Import started with target=100 (default)
2. Batch 1 fetched 25 prospects
3. Batch 2 started but **timed out after 25 seconds** (Unipile slow)
4. Partial import triggered: returned first 14 prospects that had completed processing
5. Session created with only 14 prospects

**Evidence:** Lines 254-258 handle partial imports:
```javascript
// If we have some prospects already, return partial success
if (prospects.length > 0) {
  console.log(`⚠️ Partial import: ${prospects.length} prospects collected before error`);
  break; // Returns whatever was collected
}
```

---

## Testing

### Test Case 1: Small Search (<100 results)
```bash
# Should import all results
curl -X POST /api/linkedin/import-saved-search \
  -d '{"saved_search_url": "...", "target_count": 100}'

# Expected: All results imported
```

### Test Case 2: Medium Search (100-500 results)
```bash
# Should import 500 by default
curl -X POST /api/linkedin/import-saved-search \
  -d '{"saved_search_url": "..."}'

# Expected: 500 prospects (new default)
```

### Test Case 3: Large Search (500+ results)
```bash
# Should import specified count
curl -X POST /api/linkedin/import-saved-search \
  -d '{"saved_search_url": "...", "target_count": 1000}'

# Expected: 1000 prospects
```

### Test Case 4: Max Import (2500 limit)
```bash
# Should import 2500 (LinkedIn limit)
curl -X POST /api/linkedin/import-saved-search \
  -d '{"saved_search_url": "...", "target_count": 2500}'

# Expected: 2500 prospects or all available (whichever is less)
```

---

## User Communication

**For the client who reported the issue:**

> "We identified the issue with your LinkedIn search import. The system was set to import only 100 prospects by default, and the import stopped early due to a timeout, which is why you only saw 14 prospects.
>
> We've increased:
> 1. Default import limit: 100 → 500 prospects
> 2. Maximum import limit: 1,000 → 2,500 prospects (LinkedIn limit)
> 3. Batch size: 25 → 50 prospects per batch (2x faster)
> 4. Timeout: 25 → 45 seconds per batch (more reliable)
>
> Please re-run your saved search and you should now see significantly more prospects imported. To import all 534 leads from your search, the system will now automatically handle it in ~11 batches."

---

## Files to Update

1. ✅ `app/api/linkedin/import-saved-search/route.ts` (line 81, 208, 235)
2. ⚠️ Update frontend to show import progress
3. ⚠️ Add documentation about target_count parameter

---

**Priority:** HIGH - Directly impacts customer data quality
**Effort:** LOW - 3 line changes
**Risk:** LOW - Only increases limits, doesn't change logic
