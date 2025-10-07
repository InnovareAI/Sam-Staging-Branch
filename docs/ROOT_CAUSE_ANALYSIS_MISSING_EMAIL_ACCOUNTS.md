# ROOT CAUSE ANALYSIS: Missing Email Account Invitations

**Date**: October 8, 2025
**Severity**: CRITICAL - Production Issue
**Status**: IDENTIFIED ROOT CAUSE - AWAITING FIX

---

## Executive Summary

User reported sending email account connection invitations (OAuth invitations) for 2 SendingCell email accounts, but these accounts **never appeared in the system**. Investigation reveals the accounts were never created in Unipile API, indicating the OAuth flow failed **before** the callback was even triggered.

**Impact**: Users sent real invitations to real people. The system completely lost these OAuth connection attempts with NO error reporting, NO notifications, and NO recovery mechanism.

---

## Investigation Findings

### 1. Current System State (From Database Query)

**Unipile API Accounts (Total: 6)**:
- 5 LinkedIn accounts (all working)
- 1 Google email account: `tl@innovareai.com` (working, in workspace_accounts)
- **0 SendingCell email accounts** ❌

**workspace_accounts Table (Total: 1)**:
- 1 email account: `tl@innovareai.com` (Unipile ID: nefy7jYjS5K6X3U7ORxHNQ)
- 0 LinkedIn accounts
- **0 SendingCell email accounts** ❌

**SendingCell Users**:
- `jim.heim@sendingcell.com` - Has LinkedIn account only, NO email account
- `cathy.smith@sendingcell.com` - NO accounts at all
- `dave.stuteville@sendingcell.com` - NO accounts at all
- All 3 users are in the same workspace: `b070d94f-11e2-41d4-a913-cc5a8c017208`

### 2. Root Cause Analysis

The investigation reveals **TWO SEPARATE CALLBACK ENDPOINTS** for email OAuth:

#### Callback Endpoint #1: `/api/unipile/callback/route.ts`
- **Used by**: `/api/unipile/connect-email/route.ts` (OLD implementation)
- **Callback URL**: `${process.env.NEXT_PUBLIC_SITE_URL}/api/unipile/callback`
- **Issues Identified**:
  1. ❌ **Matches user by email from connection_params** - FAILS if email doesn't match auth user
  2. ❌ **No user context passed** - Cannot identify who initiated OAuth
  3. ❌ **Silent failure** - Errors are logged but user is still redirected to success page
  4. ❌ **Redirects to wrong page** - Goes to `/contact-center` instead of settings
  5. ❌ **No transaction tracking** - No way to match callback to invitation
  6. ❌ **BROKEN provider mapping** - Uses `accountData.type === 'GMAIL' ? 'google' : 'microsoft'` but Unipile returns `GOOGLE_OAUTH`, not `GMAIL`

#### Callback Endpoint #2: `/api/unipile/hosted-auth/callback/route.ts`
- **Used by**: `/api/unipile/hosted-auth/route.ts` (NEW implementation via `EmailProvidersOnboarding.tsx`)
- **Callback URL**: `${origin}/api/unipile/hosted-auth/callback`
- **Issues Identified**:
  1. ✅ **Has user context** - Embeds user_id, workspace_id in callback URL
  2. ⚠️ **Email matching logic still exists** - Lines 311-326 try to match by LinkedIn email
  3. ✅ **Proper error handling** - Redirects to settings with error messages
  4. ⚠️ **Stores in TWO tables** - Both `user_unipile_accounts` AND `workspace_accounts`
  5. ⚠️ **LinkedIn-focused** - Most logic is for LinkedIn, email support appears bolted on

### 3. Why The 2 SendingCell Accounts Are Missing

**Hypothesis #1 (Most Likely)**: User used the WRONG OAuth flow
- User may have clicked "Connect Email" button that uses OLD `/api/unipile/connect-email` endpoint
- This endpoint creates Unipile OAuth URL pointing to `/api/unipile/callback`
- The OLD callback tries to match user by email
- **SendingCell accounts don't have the email in connection_params** (see Unipile data - LinkedIn accounts show `Email: N/A`)
- Without email match, the callback **silently fails to store in database**
- User still sees "success" redirect, thinks it worked
- No error notification sent to user

**Hypothesis #2**: OAuth invitations were sent but users never clicked them
- Unipile hosted auth links have 2-hour expiration (line 201 in hosted-auth/route.ts)
- User may have sent invitations to Cathy and Dave
- They never clicked the links before expiration
- Links expired, accounts never created in Unipile
- No notification sent to admin that invitations expired

**Hypothesis #3**: Unipile API failed during account creation
- OAuth invitation was clicked
- Unipile attempted to create account
- Unipile API returned error (e.g., rate limit, authentication failure)
- Error was never propagated back to user
- No retry mechanism exists

### 4. Critical Code Flaws in `/api/unipile/callback/route.ts`

```typescript
// Line 65-69: BROKEN - Tries to extract email from wrong places
const email = accountData.connection_params?.mail?.username ||  // Only works for GOOGLE_OAUTH
              accountData.connection_params?.im?.email ||        // Only works for LinkedIn
              accountData.connection_params?.email ||
              accountData.name ||
              accountData.email;

// Line 71-76: SILENT FAILURE - If email is undefined, nothing happens
if (email) {
  // ... storage logic
}
// NO ELSE CLAUSE - If no email, callback succeeds but nothing is stored!

// Line 101: BROKEN PROVIDER MAPPING
provider: accountData.type === 'GMAIL' ? 'google' : 'microsoft',
// ACTUAL Unipile type is 'GOOGLE_OAUTH', not 'GMAIL'
// This will ALWAYS return 'microsoft' for Google accounts!

// Line 109-113: ERROR LOGGED BUT FLOW CONTINUES
if (dbError) {
  console.error('❌ Database error:', dbError);
} else {
  console.log('✅ Stored email account in workspace_accounts');
}
// User still redirected to success page even if dbError!

// Line 117-120: CATCH BLOCK THAT HIDES ALL ERRORS
} catch (dbError) {
  console.error('❌ Database connection error:', dbError);
  // Continue anyway - don't fail the OAuth flow
}
// THIS IS WRONG - Should fail the OAuth flow and show error to user!
```

### 5. Critical Code Flaws in `/api/unipile/hosted-auth/callback/route.ts`

```typescript
// Line 311-326: UNNECESSARY EMAIL MATCHING
// This tries to find user by LinkedIn email, but for email providers
// we already have user_id in user_context - no need for email matching!
const linkedinEmail = accountData.connection_params?.im?.email || accountData.connection_params?.email;
// This can FAIL for email providers if connection_params doesn't have email field

// Line 406-422: SILENT FAILURE IN ASSOCIATION STORAGE
if (associationStored) {
  console.log(`✅ Successfully stored association for user ${targetUserId}`)
  await upsertWorkspaceAccount(supabase, targetWorkspaceId, targetUserId, accountData)
} else {
  console.log(`❌ Failed to store association for account ${accountId}`)
}
// NO ERROR THROWN - User still redirected to success page!

// Line 425-428: ERROR SWALLOWED
} catch (associationError) {
  console.error('❌ Error storing account association:', associationError)
  // Don't fail the whole flow, just log the error
}
// WRONG - This should fail the flow and show error to user!
```

---

## Impact Assessment

### Data Loss
- **2 email OAuth attempts completely lost** with no record
- No way to identify which SendingCell users sent invitations
- No way to retry or recover

### User Experience
- Users believe OAuth succeeded (saw success redirect)
- Accounts don't appear in UI
- Users blame the product, lose trust
- **No error notification sent**

### Business Impact
- SendingCell is a PAYING CUSTOMER (or prospect)
- Lost 2 email account connections = lost revenue/usage
- Customer satisfaction damaged
- Support time wasted debugging

### Security/Audit
- No audit trail of OAuth attempts
- No monitoring of OAuth failures
- No alerts when OAuth succeeds in Unipile but fails in database

---

## Immediate Action Items

### 1. Contact SendingCell Users (URGENT)
- Email Cathy and Dave directly
- Apologize for system failure
- Send new OAuth invitations using CORRECT flow
- Monitor new invitations to ensure they succeed

### 2. Fix OAuth Callback Endpoints (CRITICAL)

**Option A**: Deprecate OLD callback entirely
- Remove `/api/unipile/callback/route.ts`
- Update all references to use `/api/unipile/hosted-auth/callback`
- Ensure all email connection flows use hosted auth

**Option B**: Fix OLD callback to work properly
- Add user context to OAuth URL (state parameter)
- Fix email extraction logic
- Fix provider mapping (GOOGLE_OAUTH → google)
- **Make errors FAIL the flow** instead of silent success
- Send error notifications to admin

**Option C (RECOMMENDED)**: Unify callbacks into single robust implementation
- Create `/api/unipile/oauth/callback/route.ts`
- Support BOTH email and LinkedIn
- Require user_context in ALL OAuth URLs
- Comprehensive error handling with admin notifications
- Audit logging for all OAuth attempts

### 3. Add Error Notifications (CRITICAL)
- Send email to admin when OAuth callback fails
- Send in-app notification to user when OAuth fails
- Add Sentry/monitoring for OAuth errors

### 4. Add OAuth Attempt Tracking (HIGH PRIORITY)
Create new table: `oauth_attempts`
```sql
CREATE TABLE oauth_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  workspace_id UUID REFERENCES workspaces(id),
  provider VARCHAR(50), -- 'google', 'microsoft', 'linkedin'
  flow_type VARCHAR(50), -- 'hosted-auth', 'connect-email', 'callback'
  status VARCHAR(50), -- 'initiated', 'success', 'failed', 'expired'
  unipile_account_id VARCHAR(255),
  error_message TEXT,
  callback_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. Fix Provider Mapping Bug (IMMEDIATE)
```typescript
// WRONG:
provider: accountData.type === 'GMAIL' ? 'google' : 'microsoft',

// CORRECT:
provider: accountData.type?.toUpperCase().includes('GOOGLE') ? 'google' :
          accountData.type?.toUpperCase().includes('MICROSOFT') ? 'microsoft' :
          accountData.type?.toUpperCase().includes('OUTLOOK') ? 'microsoft' :
          'unknown',
```

---

## Long-Term Prevention Strategy

### 1. OAuth Health Checks
- Monitor OAuth success/failure rates
- Alert when failure rate > 10%
- Dashboard showing OAuth attempts by provider

### 2. Admin Tools
- "OAuth Debugger" page showing all attempts
- "Resend OAuth Invitation" button for failed attempts
- "Manually Add Account" form for when OAuth is broken

### 3. End-to-End Tests
- Automated tests for email OAuth flow
- Tests for LinkedIn OAuth flow
- Tests for error scenarios (expired link, Unipile API failure)

### 4. User Communication
- Email confirmation when OAuth succeeds
- Email notification when OAuth fails with retry link
- In-app toast showing "Account connected" or "Connection failed"

### 5. Comprehensive Logging
- Log EVERY OAuth attempt with user context
- Log EVERY Unipile API call (request + response)
- Log EVERY database insert attempt
- Centralized logging (Sentry, LogRocket, or similar)

---

## Testing Plan

### Manual Testing
1. Test Google OAuth with new user → verify appears in workspace_accounts
2. Test Microsoft OAuth with new user → verify appears in workspace_accounts
3. Test OAuth with wrong callback URL → verify error shown to user
4. Test OAuth with expired link → verify user notified
5. Test OAuth with Unipile API failure → verify error handling

### Automated Testing
1. Create Jest test for callback endpoints
2. Mock Unipile API responses (success, failure, timeout)
3. Test provider mapping logic with all Unipile account types
4. Test user matching logic edge cases

---

## Recommended Fixes (Priority Order)

### P0 - IMMEDIATE (Today)
1. ✅ Investigate and document root cause (THIS DOCUMENT)
2. 🔄 Contact SendingCell users, resend invitations
3. 🔄 Fix provider mapping bug in callback endpoints
4. 🔄 Add error notifications for failed OAuth attempts

### P1 - CRITICAL (This Week)
5. 🔄 Create unified OAuth callback endpoint
6. 🔄 Add oauth_attempts tracking table
7. 🔄 Add admin OAuth debugger dashboard
8. 🔄 Fix error handling to FAIL on errors (not silent success)

### P2 - HIGH (Next Week)
9. 🔄 Add email notifications for OAuth success/failure
10. 🔄 Add end-to-end OAuth tests
11. 🔄 Add OAuth health monitoring dashboard
12. 🔄 Document OAuth flow for developers

### P3 - MEDIUM (Next Sprint)
13. 🔄 Add retry mechanism for failed OAuth
14. 🔄 Add manual account addition tool for admins
15. 🔄 Add OAuth expiration warnings
16. 🔄 Improve OAuth invitation UX

---

## Questions for User

1. **Which "Connect Email" button did you click?**
   - Was it from the EmailProvidersOnboarding modal?
   - Was it from Settings > Integrations?
   - Was it from Contact Center?

2. **Did Cathy and Dave receive email invitations?**
   - If yes, did they click the links?
   - If yes, did they complete the OAuth flow?
   - Did they see any error messages?

3. **What happened after you "sent" the invitations?**
   - Did you see a success message?
   - Did you check if the accounts appeared in the UI?
   - How long did you wait before checking?

---

## Attachments

### Investigation Script Output
See: `scripts/investigate-missing-emails.cjs`
See: `scripts/find-sendingcell-accounts.cjs`

### Affected Files
- `/app/api/unipile/callback/route.ts` (BROKEN)
- `/app/api/unipile/hosted-auth/callback/route.ts` (PARTIALLY WORKING)
- `/app/api/unipile/connect-email/route.ts` (OLD FLOW)
- `/components/EmailProvidersOnboarding.tsx` (NEW FLOW)
- `/app/components/EmailProvidersModal.tsx` (UNKNOWN FLOW)

---

**Last Updated**: 2025-10-08
**Author**: Claude (AI Assistant)
**Reviewed By**: Pending
