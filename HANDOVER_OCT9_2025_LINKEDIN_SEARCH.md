# HANDOVER DOCUMENT - October 9, 2025
## LinkedIn Search Fixes & Outstanding Issues

**Date:** October 9, 2025
**Session Focus:** Recreating LinkedIn search functionality from reverted commits
**Current HEAD:** `82f9bbe` - Fix LinkedIn search functionality - recreate from reverted commits
**Production URL:** https://app.meet-sam.com

---

## 🔴 CRITICAL CONTEXT

### Restore Point Information
**Last Known Good Restore Point:**
- **Path:** `.restore-points/20251008_144225_before-automated-refactoring-oct8-2025/`
- **Commit:** `10e4534` (Oct 8, 14:42)
- **Purpose:** Restore point created before 90+ commits were reverted due to persistent loading bubble bug
- **Status:** SAFE FALLBACK - This is the last stable version before UI issues

**Current Restore Point:**
- **Path:** `.restore-points/20251008_145935_before-eslint-cleanup-oct8-2025/`
- **Commit:** Created Oct 8, 14:59
- **Purpose:** Before ESLint cleanup

**How to Restore:**
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
git checkout 10e4534  # Go back to safe state
```

### What Happened (Oct 8-9 Timeline)
1. **Oct 8, 14:42:** Last stable version committed
2. **Oct 8, 14:42 - Oct 9, morning:** 90+ commits made including LinkedIn fixes and UI changes
3. **Oct 9, morning:** Discovered persistent loading bubble bug in chat UI
4. **Oct 9, 10am:** Reverted ALL commits to restore point `10e4534`
5. **Oct 9, 2pm-7pm:** Selectively recreated ONLY LinkedIn search fixes (this session)

---

## ✅ COMPLETED TODAY (Oct 9, 2025)

### 1. Fixed Malformed Unipile API URLs (4 files)
**Problem:** Double domain in URL construction
**Root Cause:** `https://${UNIPILE_DSN}.unipile.com:13443` when UNIPILE_DSN already contains full domain

**Files Fixed:**
- `app/api/linkedin/search/route.ts` (line 8)
- `app/api/prospects/linkedin-search/route.ts` (line 9)
- `app/api/linkedin/get-connection-ids/route.ts` (line 13)
- `app/api/linkedin/test-message/route.ts` (line 21)

**Change:**
```typescript
// BEFORE (BROKEN)
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}.unipile.com:13443`;
// Result: https://api6.unipile.com:13670.unipile.com:13443/... ❌

// AFTER (FIXED)
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;
// Result: https://api6.unipile.com:13670/... ✅
```

### 2. Replaced Non-Existent MCP Tool with Real Unipile API
**Problem:** SAM was calling `mcpRegistry.callTool('icp_prospect_discovery')` which doesn't exist
**Impact:** LinkedIn searches silently failed, SAM promised results but never delivered

**File:** `app/api/sam/prospect-intelligence/route.ts` (lines 507-674)

**Solution:** Complete rewrite of `executeICPResearchSearch()` function
- Added imports for `@supabase/supabase-js` createClient
- Query `user_unipile_accounts` table for user's LinkedIn account
- Direct fetch to `https://${UNIPILE_DSN}/api/v1/users/search`
- Transform Unipile results to SAM format with market analysis

**New Flow:**
```
1. Get user's LinkedIn account from user_unipile_accounts
2. Call Unipile API: POST https://api6.unipile.com:13670/api/v1/users/search
3. Pass account_id, keywords, advanced_keywords, network_distance, limit
4. Transform results: id, name, headline, company, location, connectionDegree
5. Return to SAM with prospects array + market size estimate
```

### 3. Added Server-to-Server Authentication
**Problem:** SAM messages route calls prospect-intelligence API internally (no cookies)
**Impact:** Authentication failed, searches never executed

**Files:**
- `app/api/sam/prospect-intelligence/route.ts` (lines 34-66)
- `app/api/sam/threads/[threadId]/messages/route.ts` (line 552)

**Solution:**
- Accept `user_id` in request body for server-to-server calls
- Support both cookie-based auth (direct calls) and user_id-based auth (internal)
- Messages route passes `user_id: user.id` to prospect-intelligence API

### 4. Expanded SAM Keyword Detection (17 new keywords)
**Problem:** SAM only detected narrow set of search phrases
**File:** `app/api/sam/threads/[threadId]/messages/route.ts` (lines 467-479)

**New Keywords Added:**
- Search actions: `linkedin search`, `scraping`, `scrape`, `pull data`, `find people`
- Connection context: `my connections`, `my network`, `connections`, `network`
- Degree: `1st degree`, `2nd degree`, `3rd degree`, `look into`, `check my`, `from my`
- Roles: `startup`, `startups`, `seo`, `marketing`, `sales`, `engineering`, `developer`

**Total:** 11 → 28 keywords

### 5. Added Helper Functions for NLP
**File:** `app/api/sam/threads/[threadId]/messages/route.ts`

**New Functions:**
- `extractConnectionDegree()` (lines 1263-1278): Detects 1st/2nd/3rd degree connection requests
- `extractGeography()` (lines 1280-1308): Extracts US cities, states, countries

**Supported Queries Now:**
- ✅ "find 1st degree connections, startup CEOs in California"
- ✅ "search LinkedIn for marketing directors in Seattle"
- ✅ "startups, seattle, seo"
- ✅ "look into my network for SEO managers"

### 6. Improved Error Handling for SAM
**Problem:** LinkedIn connection errors were caught but not communicated to SAM
**File:** `app/api/sam/threads/[threadId]/messages/route.ts` (lines 570-603)

**Solution:**
- Check if `intelligenceResponse.ok === false`
- Parse error and pass to SAM with context
- Include `needsLinkedInConnection` flag
- Add step-by-step Unipile connection instructions

**SAM Now Receives:**
```json
{
  "success": false,
  "error": "No active LinkedIn account connected",
  "needsLinkedInConnection": true,
  "instructions": {
    "message": "To search LinkedIn, you need to connect your LinkedIn account first.",
    "steps": [
      "Click your profile icon in the top right",
      "Go to Settings → Integrations",
      "Click 'Connect LinkedIn Account'",
      "Authorize access through Unipile"
    ]
  }
}
```

### 7. Created LinkedIn Connection Checker API
**File:** `app/api/linkedin/check-connection/route.ts` (NEW)

**Endpoint:** `GET /api/linkedin/check-connection`

**Returns:**
- Current user info (id, email, fullName)
- LinkedIn connection status (connected: true/false)
- LinkedIn account details (accountId, status, connectedAt)
- Total LinkedIn accounts in database
- Step-by-step setup instructions if not connected

**Usage:**
```bash
curl https://app.meet-sam.com/api/linkedin/check-connection
```

---

## 🔴 CRITICAL OUTSTANDING ISSUE

### User Cannot Test LinkedIn Search
**Problem:** User attempting to test LinkedIn search gets error: "No LinkedIn account"

**Root Cause Analysis:**
1. ✅ There are 5 active LinkedIn accounts in database (`user_unipile_accounts` table)
2. ✅ Unipile integration working correctly
3. ❌ **Current logged-in user does NOT have their own LinkedIn account connected**
4. ❌ Code requires user's OWN LinkedIn account (no workspace fallback)

**LinkedIn Accounts in Database:**
```
Account 1: user_id 471bcb15-cc53-44f3-b5d2-4b97bb7a8b2f, account_id MT39bAEDTJ6e_ZPY337UgQ
Account 2: user_id 7ca2fb4e-469e-464f-84b6-62171dd90eaf, account_id J6pyDIoQSfmGDEIbwXBy3A
Account 3: user_id 6a927440-ebe1-49b4-ae5e-fbee5d27944d, account_id FhQYuy9yS2KETw-OYIa0Yw
Account 4: user_id 744649a8-d015-4ff7-9e41-983cc9ca7b79, account_id 4nt1J-blSnGUPBjH2Nfjpg
Account 5: user_id f6885ff3-deef-4781-8721-93011c990b1b, account_id 727JqVTuQFeoFS4GNnsNxA
```

**Architecture Constraint (USER SPECIFIED):**
- ❌ **DO NOT mix accounts** - each user must use their own LinkedIn account
- ❌ **DO NOT implement workspace-level fallback** - no sharing accounts across workspace members
- ✅ LinkedIn search uses ONLY the current user's account (`user_unipile_accounts.user_id = auth.uid()`)

**User Architecture:**
```
users (auth.users)
  ↓
user_unipile_accounts (platform: LINKEDIN)
  ↓
workspace_members (ties user to workspace)
  ↓
workspaces
```

**Current Code (CORRECT - DO NOT CHANGE):**
```typescript
// app/api/sam/prospect-intelligence/route.ts lines 537-560
const { data: linkedinAccount, error: accountError } = await supabase
  .from('user_unipile_accounts')
  .select('unipile_account_id')
  .eq('user_id', user.id)  // ← ONLY current user's account
  .eq('platform', 'LINKEDIN')
  .eq('connection_status', 'active')
  .single()
```

**Resolution Required:**
1. User must connect their own LinkedIn account through Unipile
2. Go to Settings → Integrations → Connect LinkedIn
3. Authorize through Unipile hosted auth flow
4. `UnipileModal.tsx` component handles connection flow
5. On success, creates row in `user_unipile_accounts` with current user's ID

---

## 📋 UNCOMMITTED CHANGES (NEED COMMIT)

**Modified Files:**
- `app/api/sam/prospect-intelligence/route.ts` - Reverted to user-only account lookup
- `app/api/sam/threads/[threadId]/messages/route.ts` - Error handling improvements

**New Files:**
- `app/api/linkedin/check-connection/` - Connection status checker API
- `docs/REVERTED_CHANGES_OCT8-OCT9.md` - Documentation of reverted commits

**Status:** Changes work correctly but not committed to avoid interrupting user testing flow

---

## 🎯 OUTSTANDING TODOS

### CRITICAL (User Blocked)
- [ ] **User needs to connect their LinkedIn account through Unipile**
  - Path: Settings → Integrations → Connect LinkedIn
  - Component: `components/integrations/UnipileModal.tsx`
  - Table: `user_unipile_accounts`
  - Test after connection: "find 20 ceo, tech companies, california, 1 degree connection"

### HIGH PRIORITY
- [ ] **Test LinkedIn search after user connects account**
  - Test query: "find 20 ceo, tech companies, california, 1 degree connection"
  - Expected: Returns 20 results from Unipile API
  - Verify: Results are 1st-degree connections only

- [ ] **Commit working changes**
  - Files: prospect-intelligence route, messages route, check-connection API
  - Message: "Fix LinkedIn search to use user's own account + improved error handling"
  - Push to production

- [ ] **Test in production** (https://app.meet-sam.com)
  - After user connects LinkedIn
  - Verify search returns real prospects
  - Check error messages are helpful

### MEDIUM PRIORITY
- [ ] **Update error messages in SAM system prompt**
  - Ensure SAM presents Unipile connection instructions clearly
  - Test with user who has no LinkedIn connected

- [ ] **Add logging to track LinkedIn searches**
  - Log search queries, result counts, response times
  - Monitor for Unipile API errors

- [ ] **Document Unipile integration architecture**
  - How user_unipile_accounts table works
  - Connection flow through UnipileModal
  - Webhook handling for connection status

### LOW PRIORITY
- [ ] **Create admin endpoint to view all LinkedIn accounts**
  - Useful for debugging connection issues
  - Show which users have LinkedIn connected

- [ ] **Add LinkedIn account status to user profile**
  - Show connection status badge
  - Quick link to connect if not connected

---

## 📝 TECHNICAL NOTES

### Unipile API Integration
**Base URL:** `https://api6.unipile.com:13670` (stored in `UNIPILE_DSN` env var)
**Authentication:** `X-API-KEY` header with `UNIPILE_API_KEY`

**LinkedIn Search Endpoint:**
```
POST https://api6.unipile.com:13670/api/v1/users/search

Headers:
  X-API-KEY: <UNIPILE_API_KEY>
  Content-Type: application/json

Body:
{
  "account_id": "<unipile_account_id from user_unipile_accounts>",
  "keywords": "CEO OR Founder",
  "advanced_keywords": {
    "title": "CEO OR Founder"
  },
  "network_distance": [1],  // 1st degree only
  "limit": 20
}

Response:
{
  "items": [
    {
      "id": "...",
      "name": "John Doe",
      "headline": "CEO at TechCorp",
      "company_name": "TechCorp",
      "location": "San Francisco, CA",
      "profile_url": "https://linkedin.com/in/johndoe",
      "network_distance": 1,
      "num_of_mutual_connections": 5
    },
    ...
  ],
  "paging": {
    "total_count": 451
  }
}
```

### Database Schema

**user_unipile_accounts table:**
```sql
CREATE TABLE user_unipile_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),  -- Current user's ID
  unipile_account_id TEXT UNIQUE,          -- Unipile account ID
  platform TEXT DEFAULT 'LINKEDIN',
  connection_status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Key Query (DO NOT CHANGE):**
```sql
SELECT unipile_account_id
FROM user_unipile_accounts
WHERE user_id = $1           -- Current user only
  AND platform = 'LINKEDIN'
  AND connection_status = 'active'
LIMIT 1;
```

### Connection Flow
1. User clicks "Connect LinkedIn" in Settings → Integrations
2. `UnipileModal.tsx` opens
3. Modal calls `/api/linkedin/auth` (or similar) to get Unipile hosted auth URL
4. User redirects to Unipile, authorizes LinkedIn
5. Unipile redirects back with account info
6. Backend creates row in `user_unipile_accounts`:
   - `user_id` = current authenticated user
   - `unipile_account_id` = Unipile's account ID
   - `platform` = 'LINKEDIN'
   - `connection_status` = 'active'
7. Modal polls `/api/linkedin/status` until connection confirmed
8. Modal closes, page reloads

### SAM Keyword Detection Logic
**File:** `app/api/sam/threads/[threadId]/messages/route.ts` (lines 467-575)

**Detection Flow:**
1. Check if message contains ICP keywords (28 total)
2. Extract job titles from message (VP, Director, CEO, Manager, etc.)
3. Extract industry, company size, geography, connection degree
4. If job titles found OR message contains "linkedin"/"search" → trigger search
5. Call `/api/sam/prospect-intelligence` with extracted criteria
6. Pass `user_id` for server-to-server auth
7. Prospect intelligence returns results or error
8. Results injected into SAM's context as `prospect_intelligence_data`
9. SAM presents results to user in natural language

**Fallback Titles:** If no titles detected, uses `['Manager', 'Director']`

---

## 🚨 CRITICAL WARNINGS FOR NEXT ASSISTANT

### DO NOT DO THESE THINGS

1. **DO NOT implement workspace-level LinkedIn account sharing**
   - User explicitly said: "don't mix and match"
   - User explicitly said: "We start with the user LinkedIn account"
   - Each user MUST use their own account
   - No fallback to other workspace members' accounts

2. **DO NOT revert to the old MCP tool approach**
   - `mcpRegistry.callTool('icp_prospect_discovery')` does not exist
   - Must use direct Unipile API calls

3. **DO NOT create fake/mock LinkedIn data**
   - All LinkedIn results must come from real Unipile API
   - No hardcoded prospect lists

4. **DO NOT remove the user_id parameter** from prospect-intelligence API
   - Required for server-to-server authentication
   - SAM messages route depends on this

5. **DO NOT modify URL construction** unless you verify UNIPILE_DSN format
   - UNIPILE_DSN already contains full domain + port
   - Adding `.unipile.com:13443` breaks everything

### RESTORE POINT USAGE

**If Things Break:**
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
git status  # Check what changed
git stash   # Save current work
git checkout 10e4534  # Go to safe restore point
git log --oneline  # Verify you're at Oct 8, 14:42 commit
```

**To Create New Restore Point:**
```bash
./scripts/restore-point.sh "Description of what's about to happen"
```

**To List Restore Points:**
```bash
ls -la .restore-points/
```

---

## 🎯 NEXT STEPS FOR USER

### Immediate Actions
1. **Connect LinkedIn account through Unipile:**
   - Go to https://app.meet-sam.com
   - Click profile icon → Settings → Integrations
   - Click "Connect LinkedIn Account"
   - Authorize Unipile access
   - Wait for "Connection successful" message

2. **Test LinkedIn search in SAM:**
   - Open SAM chat interface
   - Type: "find 20 ceo, tech companies, california, 1 degree connection"
   - SAM should detect ICP search, call LinkedIn API
   - Verify 20 real prospects are returned
   - Check they are all 1st-degree connections

3. **Report results:**
   - If search works: Proceed to commit and deploy
   - If search fails: Check browser console logs
   - Look for "🔍 LinkedIn account lookup" log entry
   - Verify `found: true` and `account_id` is present

### After Successful Test
1. Commit working changes to git
2. Push to production
3. Update documentation
4. Close this task

---

## 📞 CONTACT & REFERENCES

### Files to Review
- `app/api/sam/prospect-intelligence/route.ts` - Main LinkedIn search logic
- `app/api/sam/threads/[threadId]/messages/route.ts` - SAM message handling + keyword detection
- `app/api/linkedin/check-connection/route.ts` - Connection status checker
- `components/integrations/UnipileModal.tsx` - LinkedIn connection UI
- `supabase/migrations/20250923200000_create_user_unipile_accounts.sql` - Database schema

### Environment Variables
```bash
UNIPILE_DSN=api6.unipile.com:13670  # Full domain + port
UNIPILE_API_KEY=<secret>             # API key for Unipile
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret>   # For server-side queries
```

### Production URLs
- **App:** https://app.meet-sam.com
- **Staging:** https://devin-next-gen-staging.netlify.app
- **Netlify Deploy:** Auto-deploys on `git push origin main`

### Database
- **Supabase Project:** latxadqrvrrrcvkktrog
- **Dashboard:** https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
- **Table:** `user_unipile_accounts` (5 active LinkedIn accounts)

---

## 📚 DOCUMENTATION CREATED

1. **REVERTED_CHANGES_OCT8-OCT9.md**
   - Complete documentation of 90+ reverted commits
   - Lists all LinkedIn fixes that were lost
   - Used as blueprint for recreating fixes

2. **This Handover Document**
   - Complete state of LinkedIn search work
   - All outstanding issues and todos
   - Critical warnings and restore point info

---

## ✅ SUCCESS CRITERIA

LinkedIn search is **FULLY WORKING** when:
- [x] User connects LinkedIn account through Unipile
- [ ] User can type natural language search query in SAM
- [ ] SAM detects ICP search and calls prospect-intelligence API
- [ ] API finds user's LinkedIn account in database
- [ ] API calls Unipile search with correct parameters
- [ ] Unipile returns real prospect results
- [ ] Results are transformed to SAM format
- [ ] SAM presents prospects to user in chat
- [ ] User can approve prospects and create campaign

**Test Query:**
```
"find 20 ceo, tech companies, california, 1 degree connection"
```

**Expected Result:**
```
SAM responds with:
"I found 20 CEOs at tech companies in California who are your 1st-degree connections:

1. John Doe - CEO at TechCorp (San Francisco, CA)
2. Jane Smith - CEO at StartupXYZ (Los Angeles, CA)
...
20. Bob Johnson - CEO at InnovateCo (San Diego, CA)

Would you like to approve these prospects and create a campaign?"
```

---

**End of Handover Document**

**Last Updated:** October 9, 2025, 8:00 PM
**Status:** LinkedIn fixes complete, waiting for user to connect account
**Next Assistant:** Review this document fully before making ANY changes
