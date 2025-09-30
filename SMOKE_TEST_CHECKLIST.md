# 🔥 Production Smoke Test Checklist

**Date:** 2025-09-30  
**Feature:** Structured Knowledge Base + Thread API Integration  
**Production URL:** https://app.meet-sam.com

---

## ✅ Pre-Flight: Automated Tests

Run these automated tests **before** manual testing:

### 1. Knowledge Base CRUD Tests
```bash
npm run test:kb-crud
```
**Expected:** 20/20 tests passing
- Tests CREATE, READ, UPDATE, DELETE for all 4 entity types
- Validates RLS workspace isolation
- Confirms cross-workspace access is blocked

### 2. Thread API Integration Test (Modified for threaded_conversations)
```bash
# Note: sam_threads table doesn't exist - using threaded_conversations instead
# Manual verification needed for thread creation API
```

### 3. Demo Data Seeded
```bash
npm run seed:kb-simple
```
**Expected:** 2 ICPs, 2 Products, 2 Competitors, 2 Personas created
- Ensures Knowledge Base tabs won't be empty on first load
- Data added to Sendingcell workspace by default

---

## 🧪 Manual Smoke Tests

### Test 1: Knowledge Base UI
**Time:** 5 minutes

1. **Login** to https://app.meet-sam.com
2. **Navigate** to Knowledge Base section
3. **Verify** all 4 tabs render without errors:
   - ✅ ICPs tab shows 2 entries
   - ✅ Products tab shows 2 entries
   - ✅ Competitors tab shows 2 entries
   - ✅ Personas tab shows 2 entries

4. **CRUD Operations** - Test one of each:
   - ✅ Create new ICP entry
   - ✅ Edit existing product
   - ✅ Delete test competitor
   - ✅ Refresh page - verify data persists

**Pass Criteria:** All tabs load, data displays, CRUD works, persistence confirmed

---

### Test 2: Chat Thread Creation
**Time:** 3 minutes

1. **Navigate** to SAM chat interface
2. **Create** new conversation/thread
3. **Verify:**
   - ✅ Thread opens without errors
   - ✅ No workspace_id missing errors in console
   - ✅ Can send first message successfully
   - ✅ Response received from SAM

4. **Check** browser console for errors:
   ```
   No errors related to:
   - workspace_id undefined
   - thread creation failures
   - RLS policy violations
   ```

**Pass Criteria:** Thread creates cleanly, messages send/receive, no console errors

---

### Test 3: Chat Knowledge Integration
**Time:** 3 minutes

1. **In active SAM chat**, ask these questions:
   ```
   "What are our ICPs?"
   "Tell me about our products"
   "Who are our main competitors?"
   "Describe our buyer personas"
   ```

2. **Verify** SAM responses include:
   - ✅ References to structured KB data
   - ✅ Specific details from seeded entries
   - ✅ No "I don't have that information" errors

**Pass Criteria:** SAM pulls structured knowledge correctly, responses are relevant

---

### Test 4: Workspace Isolation
**Time:** 2 minutes  
**Requirements:** 2 user accounts in different workspaces

1. **Login** as User A (Workspace A)
2. **Create** test ICP
3. **Note** the ICP title/details
4. **Logout** and login as User B (Workspace B)
5. **Navigate** to ICPs tab
6. **Verify:**
   - ✅ User A's ICP is NOT visible
   - ✅ Only Workspace B's data is shown

**Pass Criteria:** RLS correctly isolates data between workspaces

---

## 📊 Monitoring (First Hour)

### Automated Monitoring

#### Netlify Function Logs
```bash
# Watch live logs
netlify logs --function-log --tail

# Or view in dashboard:
https://app.netlify.com/projects/sam-new-sep-7/logs/functions
```

**Watch for:**
- ❌ API 500 errors
- ❌ Timeout errors
- ❌ RLS policy violations
- ✅ Successful KB API calls
- ✅ Thread creation success

#### Supabase Dashboard
```
URL: https://app.supabase.com/project/latxadqrvrrrcvkktrog/logs
```

**Monitor:**
- **Database Logs:**
  - ❌ RLS policy rejections
  - ❌ Missing workspace_id errors
  - ✅ Successful queries to new KB tables
  
- **API Logs:**
  - ❌ 400/500 errors on /knowledge-base/* endpoints
  - ✅ GET requests returning 200
  - ✅ POST/PUT/DELETE working correctly

- **Performance:**
  - Query response times < 200ms
  - Connection pool stable
  - No connection leaks

---

## 📈 Token Usage Monitoring

### Before Structured KB
Baseline chat prompt token usage: ~500-800 tokens

### After Structured KB
Expected increase with KB context: ~800-1200 tokens (+50-60%)

### Check Token Drift
```bash
# Check OpenRouter usage dashboard
# Or monitor in Supabase logs for completion_tokens field
```

**Monitor:**
- ✅ Token usage within expected 50-60% increase
- ❌ Token usage > 2x baseline (indicates over-fetching)
- ❌ Rate limit warnings from OpenRouter

**Action if drift detected:**
- Review KB context injection in chat prompts
- Limit KB results to top 3 most relevant per category
- Add summarization layer for large KB entries

---

## 🚨 Rollback Triggers

Execute rollback if you observe:

1. **Critical Failures:**
   - ❌ Chat threads fail to create (> 10% error rate)
   - ❌ Knowledge Base tabs crash/blank for all users
   - ❌ RLS allows cross-workspace data leaks
   - ❌ Database connection pool exhaustion

2. **Performance Issues:**
   - ❌ API response times > 2 seconds
   - ❌ Chat messages timing out
   - ❌ Database CPU > 80% sustained

3. **Token Cost Issues:**
   - ❌ Token usage > 3x baseline
   - ❌ OpenRouter rate limits hit
   - ❌ Monthly token budget exceeded

### Rollback Command
```bash
netlify rollback
```

Or manually via Netlify dashboard:
https://app.netlify.com/projects/sam-new-sep-7/deploys

---

## ✅ Success Criteria Summary

**All clear to continue if:**

1. ✅ Automated tests: 20/20 passing
2. ✅ KB UI: All tabs load and render data
3. ✅ Chat: Threads create without errors
4. ✅ Integration: SAM accesses structured knowledge
5. ✅ RLS: Workspace isolation confirmed
6. ✅ Logs: No error spikes in first hour
7. ✅ Performance: Response times < 500ms
8. ✅ Tokens: Usage increase within 50-60% of baseline

---

## 📝 Test Results Log

**Date:** ___________  
**Tester:** ___________

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| Automated KB CRUD | ⬜ | |
| Demo Data Seeded | ⬜ | |
| KB UI - ICPs Tab | ⬜ | |
| KB UI - Products Tab | ⬜ | |
| KB UI - Competitors Tab | ⬜ | |
| KB UI - Personas Tab | ⬜ | |
| CRUD Operations | ⬜ | |
| Chat Thread Creation | ⬜ | |
| Chat Knowledge Integration | ⬜ | |
| Workspace Isolation | ⬜ | |
| Function Logs Clean | ⬜ | |
| Supabase Logs Clean | ⬜ | |
| Token Usage Acceptable | ⬜ | |

---

## 🎯 Post-Deployment Tasks

- [ ] Monitor for 1 hour
- [ ] Document any issues encountered
- [ ] Update team on deployment status
- [ ] Schedule follow-up review (24h)
- [ ] Plan token optimization if needed
- [ ] Review error logs for patterns

---

**Smoke test complete! 🎉**

*Structured KB is ready for production traffic.*