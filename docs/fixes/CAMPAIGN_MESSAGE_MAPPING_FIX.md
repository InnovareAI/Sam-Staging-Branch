# Campaign Message Template Mapping Bug - FIXED

**Date:** December 12, 2025
**Severity:** CRITICAL - Data corruption bug
**Status:** ✅ FIXED

---

## Problem Summary

Users were creating campaigns in the Campaign Builder, but after approval, the messages saved to the database were WRONG. The "Initial Message" displayed after approval was showing Message 2 (first follow-up) instead of Message 1 (connection request).

### Database Evidence

Recent campaigns showed:
- ✅ `connection_request` field had the CR message **correctly**
- ❌ `alternative_message` **incorrectly** contained the first follow-up message
- ❌ `follow_up_messages` array was offset by 1 (missing Message 2, duplicating Message 3)

---

## Root Cause Analysis

### Message Architecture Explained

The system has 3 types of messages:

1. **Connection Request (Message 1)** - LinkedIn CR message (275 char limit) - for 2nd/3rd degree prospects
2. **Alternative Message** - **SEPARATE** optional message for prospects who are already 1st degree connections (no CR needed)
3. **Follow-up Messages (Messages 2-6)** - Sent after connection is accepted

**CRITICAL:** `alternative_message` is NOT part of the follow-up sequence. It's a separate, optional message.

### User Input Flow

In the Campaign Builder, users enter:
- **Connector campaigns:**
  - Message 1 (Connection Request) → `connectionMessage` state
  - Message 2 (First Follow-up) → `followUpMessages[0]`
  - Messages 3-6 → `followUpMessages[1-4]`
  - Optional: Alternative Message for 1st degree → `alternativeMessage` state

- **Messenger campaigns:**
  - Initial Message → `alternativeMessage` state (NOT `connectionMessage`)
  - Messages 2-6 → `followUpMessages[0-4]`

### Bug Locations

**BUG #1:** `/app/components/CampaignHub.tsx` line 7117
```typescript
// BEFORE (WRONG):
direct_message_1: finalCampaignData.messages.connection_request, // Empty for messenger campaigns!

// AFTER (FIXED):
direct_message_1: _executionData?.alternativeMessage || '', // User's actual "Initial Message"
```

**BUG #2:** `/app/components/CampaignHub.tsx` line 7476
```typescript
// BEFORE (WRONG):
alternative_message: finalCampaignData.messages.follow_up_1 || '', // Message 2 stored as alternative!
follow_up_messages: [
  finalCampaignData.messages.follow_up_2,  // Message 3
  finalCampaignData.messages.follow_up_3,  // Message 4
  // ...offset by 1!
]

// AFTER (FIXED):
alternative_message: _executionData?.alternativeMessage || '', // Correct source
follow_up_messages: [
  finalCampaignData.messages.follow_up_1,  // Message 2
  finalCampaignData.messages.follow_up_2,  // Message 3
  // ...correct mapping!
]
```

**BUG #3:** `/app/api/campaigns/route.ts` line 384-385
```typescript
// BEFORE (WRONG):
follow_up_1: finalMessageTemplates.alternative_message || finalMessageTemplates.follow_up_messages?.[0] || null,
follow_up_2: finalMessageTemplates.follow_up_messages?.[0] || null,  // Duplicate!

// AFTER (FIXED):
follow_up_1: finalMessageTemplates.follow_up_messages?.[0] || null,  // Message 2
follow_up_2: finalMessageTemplates.follow_up_messages?.[1] || null,  // Message 3
// Added:
alternative: finalMessageTemplates.alternative_message || null  // Stored separately
```

**BUG #4:** `/app/api/campaigns/linkedin/execute-via-n8n/route.ts` line 407
```typescript
// BEFORE (WRONG):
alternative_message: campaign.message_templates?.alternative_message || campaign.message_templates?.follow_up_messages?.[0] || ''

// AFTER (FIXED):
alternative_message: campaign.message_templates?.alternative_message || ''
```

---

## Impact

### Before Fix

**Connector campaigns:**
- ✅ Connection Request (Message 1) → Saved correctly
- ❌ Alternative Message → Received Message 2 content (WRONG!)
- ❌ Follow-up 1 → Empty or missing
- ❌ Follow-ups 2-5 → Offset by 1 (Messages 3-6 stored as 2-5)

**Messenger campaigns:**
- ❌ Initial Message (direct_message_1) → Empty! (User's input was in `alternativeMessage` but code read `connectionMessage`)
- ❌ Follow-ups → Offset by 1

**Result:** Users saw the wrong messages displayed, campaigns executed with incorrect message sequences.

### After Fix

**Connector campaigns:**
- ✅ Connection Request (Message 1) → Correctly saved
- ✅ Alternative Message → Empty OR user's optional message for 1st degree connections
- ✅ Follow-ups 1-5 → Messages 2-6 correctly mapped

**Messenger campaigns:**
- ✅ Initial Message → User's "Initial Message" from UI
- ✅ Follow-ups → Messages 2-6 correctly mapped

---

## Files Changed

1. `/app/components/CampaignHub.tsx` (lines 7117, 7480)
2. `/app/api/campaigns/route.ts` (lines 384-395)
3. `/app/api/campaigns/linkedin/execute-via-n8n/route.ts` (line 409)

---

## Testing Verification

### Test Cases

**Connector Campaign:**
1. Create connector campaign with:
   - Message 1: "Hi {first_name}, TechStars mentor here..."
   - Message 2: "Glad we connected..."
   - Messages 3-6: Various follow-ups
2. Verify database:
   - `connection_request` = "Hi {first_name}, TechStars mentor here..."
   - `alternative_message` = "" (empty or null)
   - `follow_up_messages[0]` = "Glad we connected..."

**Messenger Campaign:**
1. Create messenger campaign with:
   - Initial Message: "Hi {first_name}, wanted to reach out..."
   - Messages 2-6: Follow-ups
2. Verify database:
   - `direct_message_1` = "Hi {first_name}, wanted to reach out..."
   - `direct_message_2` = (first follow-up)

**With Alternative Message:**
1. Create connector campaign with optional "Alternative Message for 1st degree"
2. Verify it's stored in `alternative_message` field (NOT in follow_up_messages)

---

## Migration Notes

**No data migration needed** - this fix only affects NEW campaigns created after deployment. Existing campaigns with incorrect mappings will continue to function (messages are already sent), but users may see confusing data in the UI.

Optional: Run a migration script to fix historical data if needed.

---

## Deployment Status

- ✅ Code fixed
- ✅ Build verified (no TypeScript errors)
- ⏳ Awaiting production deployment
- ⏳ Awaiting user verification

---

## Related Issues

- Issue: "Campaign name not appearing after approval" (Nov 27) - Different bug, already fixed
- Issue: "N8N field name mismatch" (Nov 13) - Related architecture issue

---

## Prevention

**Code Review Checklist:**
- [ ] Verify `alternative_message` is NOT treated as a follow-up message
- [ ] Check array indices match user-visible message numbers (Message 2 = `followUpMessages[0]`)
- [ ] Test with BOTH connector and messenger campaigns
- [ ] Verify database contents match user input

**Documentation:**
- Updated `CLAUDE.md` with this fix reference
- Added inline comments explaining the correct message architecture
- Created this fix summary document

---

## Next Agent Instructions

If you see issues with campaign messages being wrong or offset:

1. **DON'T** add fallbacks like `|| follow_up_messages[0]` to `alternative_message`
2. **DO** remember: `alternative_message` is separate from follow-ups
3. **DO** use `_executionData.alternativeMessage` for messenger campaigns' initial message
4. **DO** check the message mapping in all 4 files listed above

**Quick Reference:**
```typescript
// CORRECT mapping
connection_request: Message 1 (Connection Request for 2nd/3rd degree)
alternative_message: Separate optional message for 1st degree (NOT a follow-up!)
follow_up_messages[0]: Message 2 (First follow-up)
follow_up_messages[1]: Message 3
// ...etc

// For messenger campaigns:
direct_message_1: _executionData.alternativeMessage (Initial Message)
direct_message_2: followUpMessages[0] (Message 2)
```

---

**Last Updated:** December 12, 2025
**Fixed By:** Claude Sonnet 4.5
**Verified By:** Build system ✅
