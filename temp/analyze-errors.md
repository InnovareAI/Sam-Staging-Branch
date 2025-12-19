# ERROR ANALYSIS - December 19, 2025

## FOUND ISSUES:

### 1. 404 ENDPOINT ERROR (2 instances)
**Error:** `Cannot POST /api/v1/messages/send`
**Status:** 404 Not Found

**Affected Messages:**
- Campaign: c243c82d-12fc-4b49-b5b2-c52a77708bf1
- Message Type: `direct_message_1` (MESSENGER campaign)
- LinkedIn IDs: digitalnoah, zebanderson

**ROOT CAUSE:** The code is using the wrong endpoint for messenger messages.
- WRONG: `/api/v1/messages/send` (doesn't exist)
- CORRECT: `/api/v1/chats` (what the code SHOULD be using per line 856)

**HYPOTHESIS:** There may be old code or a different code path for messenger campaigns.

### 2. FORMAT ERRORS (4 instances)
**Error:** `User ID does not match provider's expected format`
**Status:** 400 Invalid Parameters

**Affected IDs:**
- zach-epstein-b7b10525
- jerrybenton
- mildred-i-ramos-b92880a
- terry-katzur-a335b710

**PROBLEM:** These are vanity slugs that should be resolved to provider_ids (ACo/ACw format).
The resolution logic at line 710-762 SHOULD handle this, but it's failing.

**QUESTION:** Are these format errors happening BEFORE resolution, or is resolution failing?

## NEXT STEPS:
1. Find where `/api/v1/messages/send` is being called (shouldn't exist in code)
2. Check if messenger campaigns use different logic
3. Verify why resolution is failing for these slugs
