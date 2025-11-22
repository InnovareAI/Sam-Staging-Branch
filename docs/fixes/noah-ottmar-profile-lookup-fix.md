# Noah Ottmar Profile Lookup Fix

## Date: November 22, 2025

## Critical Bug Discovered

When looking up Noah Ottmar's LinkedIn profile (noah-ottmar-b59478295), the Unipile API is returning the WRONG person:

- **Expected**: Noah Ottmar (ACoAAEdwM3UB1tC2xflIFaffnR4qqdvQRaZ3V4w)
- **Actual**: Jamshaid Ali (ACoAACtFUtgBVA2KKiTrBOxxkm25rmUjo9f0OJA) with WITHDRAWN status

## Root Cause

The Unipile `/api/v1/users/profile?identifier=` endpoint incorrectly resolves vanity URLs that contain numbers at the end. It returns a completely different person's profile.

## Testing Results

```
METHOD 1: profile?identifier=noah-ottmar-b59478295
Result: Jamshaid Ali (WRONG!) - Shows WITHDRAWN invitation

METHOD 2: /users/noah-ottmar-b59478295 (legacy)
Result: Noah Ottmar (CORRECT!) - No invitation status
```

## Solution

Always use the legacy `/users/{vanity}` endpoint for vanity lookups:

```typescript
// CORRECT: Use legacy endpoint for vanities
profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${accountId}`);

// WRONG: Never use profile?identifier for vanities
// profile = await unipileRequest(`/api/v1/users/profile?identifier=${vanityId}`);
```

## Files Updated

1. `/app/api/campaigns/direct/send-connection-requests/route.ts`
2. `/app/api/campaigns/direct/process-follow-ups/route.ts`
3. `/app/api/cron/poll-accepted-connections/route.ts`

## Impact

This bug was causing false "invitation previously withdrawn" errors for prospects whose vanity URLs contain numbers, preventing legitimate connection requests from being sent.

## Verification

Run `node scripts/js/test-noah-ottmar-profile.mjs` to verify the issue and confirm the fix works.
