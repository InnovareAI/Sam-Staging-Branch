# "fetch failed" Error Diagnosis Report
**Date:** 2025-12-19
**Time:** 12:30 UTC
**Affected Queue Items:** 30 in last 15 minutes

## Root Cause

**The Unipile API server (`api6.unipile.com`) is currently DOWN or experiencing network connectivity issues.**

## Evidence

### 1. Error Pattern from Database
- **Count:** 30 failed sends in 15 minutes
- **Error Message:** `fetch failed` (generic Node.js fetch error)
- **Pattern:** ALL errors are identical - no variation in error types
- **Affected Campaigns:** 5 different campaigns affected
- **LinkedIn User IDs:** All are vanity slugs (e.g., `robin-ward-53065512`)

### 2. Direct Network Test Results

**Test with port :13670 (configured DSN):**
```
URL: https://api6.unipile.com:13670/api/v1/users/tanja-peric-787b5329
Error: ECONNREFUSED
Details: connect ECONNREFUSED 62.210.90.198:13670
```
- The server at IP `62.210.90.198` is **refusing connections** on port 13670
- This is a TCP-level connection refusal, not an HTTP error

**Test without port (default HTTPS 443):**
```
URL: https://api6.unipile.com/api/v1/users/tanja-peric-787b5329
Status: 502 Bad Gateway
Error: nginx/1.29.1
```
- Nginx reverse proxy is returning 502 (cannot reach backend server)
- This confirms the backend Unipile service is unreachable

### 3. Timeline
- **First failure:** 2025-12-19 12:01:00 (approx)
- **Last checked:** 2025-12-19 12:30:00
- **Duration:** ~30 minutes of continuous failures

## Technical Analysis

### Where "fetch failed" Originates

**File:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/cron/process-send-queue/route.ts`

**Function:** `resolveToProviderId()` (lines 196-216)

The error occurs when calling:
```typescript
const profile = await unipileRequest(`/api/v1/users/${encodeURIComponent(vanity)}?account_id=${accountId}`);
```

**Function:** `unipileRequest()` (lines 133-176)

The fetch call:
```typescript
const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
  ...options,
  headers: {
    'X-API-KEY': UNIPILE_API_KEY,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers
  }
});
```

Where `UNIPILE_BASE_URL` is:
```typescript
const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
// = https://api6.unipile.com:13670
```

### Error Flow

1. Queue processor tries to resolve LinkedIn vanity to provider_id
2. Makes HTTP request to Unipile API
3. **TCP connection fails** (ECONNREFUSED)
4. Node.js fetch throws generic `TypeError: fetch failed`
5. Error is caught in try/catch at line 1024
6. Error message is extracted: `sendError.message = "fetch failed"`
7. Queue item is marked as failed with this message (line 1177)

### Why the Generic Error Message

The error handling code (lines 1026-1035) tries to extract a meaningful message:
```typescript
let errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
```

But when the underlying error is a network connection failure, the Error object only contains:
- `message`: "fetch failed"
- `cause.code`: "ECONNREFUSED"
- `cause.errno`: -61

The cause details are NOT being extracted and logged, resulting in the unhelpful "fetch failed" message.

## Impact Assessment

### Immediate Impact
- **All LinkedIn connection requests are failing**
- **30+ prospects affected** in last 15 minutes
- **5 campaigns blocked** from sending
- **Queue is backing up** - items remain in "pending" status

### Cascading Effects
1. Prospects stay in "pending" status
2. Campaign execution is halted
3. Follow-up sequences delayed
4. Daily sending limits may bunch up when service resumes

## Recommended Actions

### Immediate (User Must Do)

1. **Check Unipile Status**
   - Visit Unipile dashboard: https://app.unipile.com
   - Check for service status announcements
   - Verify API credentials are still valid

2. **Contact Unipile Support**
   - Report: "Cannot connect to api6.unipile.com:13670"
   - Provide error: "ECONNREFUSED on IP 62.210.90.198:13670"
   - Ask: "Is there a service outage?"

3. **Monitor Queue**
   - Failed items will retry automatically if marked with proper status
   - Current implementation marks as "failed" (permanent)
   - May need manual retry once Unipile is back online

### Short-Term Fixes (Code)

#### Fix 1: Better Error Logging
**File:** `app/api/cron/process-send-queue/route.ts`
**Lines:** 1024-1038

Add cause extraction:
```typescript
catch (sendError: unknown) {
  let errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';

  // ENHANCEMENT: Extract network error details
  if (sendError instanceof Error && sendError.cause) {
    const cause = sendError.cause as any;
    if (cause.code === 'ECONNREFUSED') {
      errorMessage = `Unipile API unavailable (connection refused to ${cause.address}:${cause.port})`;
    } else if (cause.code) {
      errorMessage = `Network error: ${cause.code} - ${errorMessage}`;
    }
  }

  console.error(`❌ Failed to send CR:`, errorMessage);
  // ... rest of error handling
}
```

#### Fix 2: Retry Logic for Network Errors
**File:** `app/api/cron/process-send-queue/route.ts`
**Lines:** 1078-1098

Add network error detection:
```typescript
// Determine specific status based on error message
let prospectStatus = 'failed';
let queueStatus = 'failed';

// NEW: Handle network errors differently
if (errorMsg.includes('fetch failed') || errorMsg.includes('econnrefused') || errorMsg.includes('network error')) {
  // Network/service issue - retry later
  prospectStatus = 'approved'; // Keep as approved for retry
  queueStatus = 'pending'; // Back to pending

  // Reschedule for 15 minutes later
  const retryTime = new Date(Date.now() + 15 * 60 * 1000);
  queueUpdate.scheduled_for = retryTime.toISOString();
  cleanErrorMessage = `Unipile API unavailable - retrying at ${retryTime.toISOString()}`;

  console.log(`🔄 Network error - rescheduling for 15 minutes: ${cleanErrorMessage}`);
}
```

### Long-Term Improvements

1. **Health Check Endpoint**
   - Add `/api/health/unipile` endpoint
   - Check Unipile connectivity before processing queue
   - Skip queue processing if Unipile is down

2. **Circuit Breaker Pattern**
   - Stop making requests after N consecutive failures
   - Wait X minutes before retry
   - Prevents hammering a down service

3. **Better Monitoring**
   - Alert when >5 "fetch failed" errors in 5 minutes
   - Dashboard showing Unipile connectivity status
   - Historical uptime tracking

## Current Environment

**Unipile DSN:** `api6.unipile.com:13670`
**Resolved IP:** `62.210.90.198`
**Port:** `13670`
**Protocol:** HTTPS

**Environment Variables:**
```bash
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=85ZMr7iE.P... (set)
```

## Sample Failed Queue Item

```json
{
  "id": "5048d1ef-d80f-4cb5-81a8-8e35675b8c55",
  "campaign_id": "d0e5c1ec-46d2-49f4-96a7-cfc0c558c8e2",
  "linkedin_user_id": "robin-ward-53065512",
  "error_message": "fetch failed",
  "status": "failed",
  "updated_at": "2025-12-19T12:17:39.056"
}
```

## Next Steps

1. ✅ **Wait for Unipile service restoration**
2. ⏳ Check Unipile status page / contact support
3. ⏳ Once Unipile is back online, manually retry failed items or reset them to pending
4. ⏳ Consider implementing the error handling improvements above

---

**Diagnosis Summary:**
The "fetch failed" errors are caused by **Unipile's API server being unreachable** (ECONNREFUSED). This is a **service outage**, not a code issue. The queue processor is working correctly but cannot communicate with Unipile's backend. Once Unipile's service is restored, messages should process normally.
