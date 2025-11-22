# LinkedIn Connection Request Fix - Vanity URL Issue

**Date:** November 22, 2025
**Issue:** Connection requests failing for profiles with numbers in vanity URLs
**Example:** Noah Ottmar (noah-ottmar-b59478295)

## Problem Discovered

When attempting to send connection requests to LinkedIn profiles with vanity URLs containing numbers (e.g., `noah-ottmar-b59478295`), the Unipile API's `/users/profile?identifier=` endpoint was returning the WRONG person's profile.

### Example Case: Noah Ottmar
- **LinkedIn URL:** `https://www.linkedin.com/in/noah-ottmar-b59478295`
- **Expected Person:** Noah Ottmar (San Diego State University student)
- **Returned Person:** Jamshaid Ali (completely different person with WITHDRAWN status)
- **Root Cause:** Unipile's identifier parameter misresolves vanity URLs with numbers

## Investigation Results

### API Testing Results

1. **Using `/users/profile?identifier=noah-ottmar-b59478295`** ❌
   - Returns: Jamshaid Ali (wrong person)
   - Provider ID: ACoAACtFUtgBVA2KKiTrBOxxkm25rmUjo9f0OJA (wrong)
   - Status: WITHDRAWN (incorrect)

2. **Using legacy `/users/noah-ottmar-b59478295`** ✅
   - Returns: Noah Ottmar (correct person!)
   - Provider ID: ACoAAEdwM3UB1tC2xflIFaffnR4qqdvQRaZ3V4w (matches miniProfileUrn)
   - Status: No invitation (can send)

3. **Using full URL as identifier** ❌
   - Also returns wrong person (Jamshaid Ali)

## Solution Implemented

Updated the profile lookup strategy to use the legacy `/users/{vanity}` endpoint as primary fallback when no provider_id is stored:

### Before (Failing Strategy)
```typescript
// Would use /users/profile?identifier= which returns wrong person
profile = await unipileRequest(
  `/api/v1/users/profile?account_id=${accountId}&identifier=${vanityId}`
);
```

### After (Fixed Strategy)
```typescript
// Try legacy endpoint first (works correctly with numbers)
try {
  profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${accountId}`);
} catch (legacyError) {
  // Only fall back to identifier parameter if legacy fails
  profile = await unipileRequest(
    `/api/v1/users/profile?account_id=${accountId}&identifier=${vanityId}`
  );
}
```

## Files Updated

1. `/app/api/campaigns/direct/send-connection-requests/route.ts`
   - Updated profile lookup logic (lines 194-226)
   - Added legacy endpoint as primary fallback

2. `/app/api/campaigns/direct/process-follow-ups/route.ts`
   - Applied same fix for consistency

## Deployment

- **Build Time:** 16:02 UTC
- **Deploy Time:** 16:03 UTC
- **Production URL:** https://app.meet-sam.com
- **Status:** ✅ LIVE

## Verification

Created test scripts that confirmed:
1. Legacy endpoint returns correct person (Noah Ottmar)
2. Profile has no existing invitation
3. Connection request can be sent successfully

## Key Learnings

1. **Unipile API Quirk:** The `/users/profile?identifier=` endpoint is unreliable for vanity URLs containing numbers or special characters
2. **Legacy Endpoint More Reliable:** The older `/users/{vanity}` pattern correctly resolves these edge cases
3. **Always Store provider_id:** When available from search results, store and use provider_id for most reliable lookups
4. **Three-Tier Strategy:** provider_id → legacy /users/{vanity} → /users/profile?identifier=

## Impact

This fix resolves connection request failures for any LinkedIn profile with:
- Numbers in the vanity URL (e.g., john-doe-123)
- Special characters that might confuse the identifier parameter
- Redirected or aliased profile URLs

## Testing Commands

```bash
# Test Noah's profile lookup
node scripts/js/test-noah-ottmar-profile.mjs

# Simulate connection request
node scripts/js/test-noah-cr-simulation.mjs
```

## Related Issues

- Similar issue might affect profiles with:
  - Unicode characters in vanity URLs
  - Very long vanity identifiers
  - Recently changed/redirected profiles

## Recommendation

For future prospects:
1. Always capture and store `provider_id` from search results
2. Use provider_id as primary lookup method
3. Only fall back to vanity-based lookups when provider_id unavailable