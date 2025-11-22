# Unipile API: SDK to REST Migration Fix

**Date:** November 22, 2025
**Issue:** Inconsistent API implementation - one file using SDK while all others use REST
**File Fixed:** `/app/api/campaigns/direct/process-follow-ups/route.ts`

## Problem

The `process-follow-ups` route was using the Unipile Node SDK (`unipile-node-sdk`) while all other files in the codebase use direct REST API calls. This created:

1. **Inconsistency:** Two different approaches for the same API
2. **Maintenance burden:** Need to understand both SDK and REST patterns
3. **Potential bugs:** Different error handling and response formats
4. **Unnecessary dependency:** SDK adds complexity when REST is sufficient

## Solution

Converted the SDK calls to direct REST API calls matching the pattern used in `send-connection-requests/route.ts`.

## Changes Made

### 1. Removed SDK Import and Initialization

**Before:**
```typescript
import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY!
);
```

**After:**
```typescript
// Unipile REST API configuration - matching send-connection-requests route
const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

async function unipileRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'X-Api-Key': UNIPILE_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.title || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}
```

### 2. Converted getAllChats SDK Call

**Before (Line 97-99):**
```typescript
const chats = await unipile.messaging.getAllChats({
  account_id: unipileAccountId
});
```

**After (Line 114-116):**
```typescript
const chatsResponse = await unipileRequest(
  `/api/v1/chats?account_id=${unipileAccountId}`
);

const chat = chatsResponse.items?.find((c: any) =>
  c.attendees?.some((a: any) => a.provider_id === prospect.linkedin_user_id)
);
```

### 3. Converted sendMessage SDK Call

**Before (Line 166-169):**
```typescript
await unipile.messaging.sendMessage({
  chat_id: chat.id,
  text: message
});
```

**After (Line 183-188):**
```typescript
await unipileRequest(`/api/v1/chats/${chat.id}/messages`, {
  method: 'POST',
  body: JSON.stringify({
    text: message
  })
});
```

## Testing

Created test script: `/scripts/js/test-fixed-follow-ups.mjs` to verify:
- ✅ REST API endpoints match documentation
- ✅ Proper headers are sent
- ✅ Request payloads are correctly formatted
- ✅ No SDK dependency required

## Benefits

1. **Consistency:** All API calls now use the same pattern
2. **Simplicity:** One approach to understand and maintain
3. **Error handling:** Unified error handling across all endpoints
4. **Performance:** Direct REST calls without SDK overhead
5. **Debugging:** Easier to debug with consistent patterns

## Verification

The fixed endpoint maintains the same functionality:
- Gets all chats for an account
- Finds chats with specific prospects
- Sends follow-up messages
- Handles errors consistently

## Documentation References

- Unipile Chats API: https://developer.unipile.com/reference/chatscontroller_listallchats
- Unipile Messages API: https://developer.unipile.com/reference/chatscontroller_sendmessageinchat
- Original pattern: `/app/api/campaigns/direct/send-connection-requests/route.ts`

## Rollback Plan

If issues occur, the change can be reverted by:
1. Restoring the SDK import
2. Reverting the two function calls
3. No database or configuration changes required

## Status

✅ **COMPLETED** - The endpoint has been successfully migrated from SDK to REST API.