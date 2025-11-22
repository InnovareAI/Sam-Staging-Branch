# Unipile API Endpoints Audit Report

**Date:** November 22, 2025
**Auditor:** Claude
**Codebase:** /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

## Executive Summary

This audit reviewed all Unipile API endpoint usage in the codebase and verified them against the official Unipile documentation at https://developer.unipile.com. The audit found **1 critical issue** and **3 areas for improvement**.

## Configuration

- **DSN:** `api6.unipile.com:13670`
- **API Key:** Available in environment as `UNIPILE_API_KEY`
- **Authentication Header:** `X-Api-Key` (Note: Documentation shows `X-API-KEY`)
- **Content Headers:** `Accept: application/json`, `Content-Type: application/json`

## Endpoints Audited

### 1. GET `/api/v1/accounts` - List All Accounts

**File:** `/app/api/admin/test-bradley-invite/route.ts:29`

**Status:** ✅ CORRECT

**Implementation:**
```typescript
const accountsUrl = `https://${UNIPILE_DSN}/api/v1/accounts`;
headers: {
  'X-API-KEY': UNIPILE_API_KEY,
  'Accept': 'application/json',
}
```

**Notes:** Endpoint URL and headers match documentation.

---

### 2. GET `/api/v1/accounts/{account_id}` - Get Specific Account

**File:** `/scripts/js/test-unipile-api.cjs:77`

**Status:** ✅ CORRECT

**Implementation:**
```javascript
const url = `https://${unipileDsn}/api/v1/accounts/${accountId}`;
headers: {
  'X-API-KEY': unipileApiKey,
  'Accept': 'application/json'
}
```

**Notes:** Endpoint URL and headers match documentation.

---

### 3. GET `/api/v1/users/profile` - Get LinkedIn Profile

**File:** `/app/api/campaigns/direct/send-connection-requests/route.ts:217`

**Status:** ⚠️ NEEDS VERIFICATION

**Implementation:**
```typescript
`/api/v1/users/profile?account_id=${unipileAccountId}&identifier=${encodeURIComponent(cleanedUrl)}`
```

**Issues Found:**
- Using `/api/v1/users/profile` with query parameters
- Documentation shows `/api/v1/users/{identifier}` as path parameter
- However, the implementation with query parameters seems to work in production

**Recommendations:**
- Verify with Unipile if both patterns are supported
- Consider migrating to documented pattern if query parameter version is deprecated

---

### 4. POST `/api/v1/users/invite` - Send Connection Request

**File:** `/app/api/campaigns/direct/send-connection-requests/route.ts:306`

**Status:** ✅ CORRECT

**Implementation:**
```typescript
await unipileRequest('/api/v1/users/invite', {
  method: 'POST',
  body: JSON.stringify({
    account_id: unipileAccountId,
    provider_id: providerId,
    message: personalizedMessage
  })
});
```

**Headers:**
```typescript
headers: {
  'X-Api-Key': UNIPILE_API_KEY,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}
```

**Notes:**
- Endpoint URL matches documentation
- Request body parameters are correct
- Headers are properly set

---

### 5. Messaging Endpoints (SDK Usage)

**File:** `/app/api/campaigns/direct/process-follow-ups/route.ts`

**Status:** ❌ INCORRECT - CRITICAL ISSUE

**Implementation:**
```typescript
import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY!
);

// Line 97-99:
const chats = await unipile.messaging.getAllChats({
  account_id: unipileAccountId
});

// Line 166-169:
await unipile.messaging.sendMessage({
  chat_id: chat.id,
  text: message
});
```

**Issues Found:**
1. **INCONSISTENT IMPLEMENTATION:** This file uses the Unipile SDK while ALL other files use direct REST API calls
2. **POTENTIAL FAILURE POINT:** SDK may have different error handling or response formats
3. **MAINTENANCE ISSUE:** Having two different approaches (SDK vs REST) increases complexity

**Correct REST API Implementation Should Be:**
```typescript
// Get all chats
const chatsResponse = await fetch(
  `https://${UNIPILE_DSN}/api/v1/chats?account_id=${unipileAccountId}`,
  {
    headers: {
      'X-Api-Key': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  }
);
const chats = await chatsResponse.json();

// Send message
await fetch(
  `https://${UNIPILE_DSN}/api/v1/chats/${chat.id}/messages`,
  {
    method: 'POST',
    headers: {
      'X-Api-Key': UNIPILE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ text: message })
  }
);
```

---

## Common Issues Found

### 1. Header Inconsistency

**Issue:** Documentation sometimes shows `X-API-KEY` (uppercase) but implementation uses `X-Api-Key` (mixed case)

**Status:** ⚠️ NEEDS VERIFICATION

**Recommendation:** Verify with Unipile if header names are case-sensitive. If not, standardize on one format.

### 2. LinkedIn URL Cleaning

**Good Practice Found:** The code properly cleans LinkedIn URLs before sending to Unipile:

```typescript
const cleanLinkedInUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    urlObj.search = ''; // Remove all query parameters
    let cleanUrl = urlObj.toString().replace(/\/$/, ''); // Remove trailing slash

    if (cleanUrl.includes('linkedin.com/in/')) {
      const match = cleanUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
      if (match) {
        return `https://www.linkedin.com/in/${match[1]}`;
      }
    }
    return cleanUrl;
  } catch {
    return url;
  }
};
```

This prevents issues with URLs containing `miniProfileUrn` and other parameters.

### 3. Error Handling

**Good Practice Found:** Comprehensive error handling with detailed logging:

```typescript
const errorDetails = {
  message: error.message || 'Unknown error',
  status: error.status || error.statusCode,
  type: error.type,
  title: error.title,
  response: error.response?.data,
  stack: error.stack
};
```

---

## Recommendations

### Priority 1: Critical Fix

1. **Fix process-follow-ups route** - Convert from SDK to direct REST API calls for consistency
   - This ensures all API calls use the same error handling and response processing
   - Reduces complexity and potential failure points

### Priority 2: Improvements

2. **Verify profile endpoint pattern** - Check if query parameter version is officially supported
3. **Standardize header casing** - Use consistent header format across all endpoints
4. **Add retry logic** - Implement exponential backoff for rate limiting (429 errors)

### Priority 3: Nice to Have

5. **Create shared API client** - Centralize all Unipile API calls in one module
6. **Add request/response logging** - For debugging production issues
7. **Implement circuit breaker** - Prevent cascading failures when Unipile is down

---

## Test Coverage

The codebase has good test coverage with multiple test files:
- `/scripts/js/test-unipile-api.cjs` - Basic API connectivity
- `/scripts/js/test-unipile-auth.cjs` - Authentication testing
- `/app/api/admin/test-bradley-invite/route.ts` - End-to-end invite flow
- Various diagnostic scripts for specific issues

---

## Compliance with Documentation

| Endpoint | Documentation Match | Issues |
|----------|-------------------|---------|
| GET /api/v1/accounts | ✅ Full match | None |
| GET /api/v1/accounts/{id} | ✅ Full match | None |
| GET /api/v1/users/profile | ⚠️ Partial match | Using query params instead of path params |
| POST /api/v1/users/invite | ✅ Full match | None |
| Messaging endpoints | ❌ Not matching | Using SDK instead of REST API |

---

## Conclusion

The codebase generally follows Unipile API documentation correctly with one critical exception: the process-follow-ups route uses the SDK while everything else uses REST. This inconsistency should be fixed immediately to prevent potential issues.

The implementation shows good practices including:
- Proper URL cleaning for LinkedIn profiles
- Comprehensive error handling
- Protection against withdrawn invitation cooldowns
- Human-like delays between requests

**Overall Grade: B+**
- Points deducted for SDK/REST inconsistency
- Points added for robust error handling and safety checks

---

## Action Items

1. [ ] **IMMEDIATE:** Fix `/app/api/campaigns/direct/process-follow-ups/route.ts` to use REST API
2. [ ] **THIS WEEK:** Verify profile endpoint pattern with Unipile support
3. [ ] **FUTURE:** Consider creating centralized API client module

---

**End of Audit Report**