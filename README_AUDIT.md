# Supabase Database Query Audit Report - November 22, 2025

## Quick Links

Start here based on your role:

**For Decision Makers:**
- Read: `AUDIT_SUMMARY.md` (5 min) - Executive summary of issues and fixes

**For Developers:**
- Read: `AUDIT_FINDINGS.txt` (10 min) - Technical overview of all issues
- Then: `SUPABASE_FIXES_GUIDE.md` (30-60 min) - Step-by-step fix instructions

**For Database Admins:**
- Read: `SUPABASE_AUDIT_REPORT.md` (20 min) - Complete schema audit with SQL details

**For Code Reviewers:**
- Read: `SUPABASE_FIXES_GUIDE.md` - Each fix is marked with exact line numbers

---

## Files in This Audit

| File | Size | Purpose | Read Time |
|------|------|---------|-----------|
| `AUDIT_SUMMARY.md` | 4 KB | Executive summary | 5 min |
| `AUDIT_FINDINGS.txt` | 10 KB | Technical findings summary | 10 min |
| `SUPABASE_AUDIT_REPORT.md` | 20 KB | Complete detailed audit | 20 min |
| `SUPABASE_FIXES_GUIDE.md` | 15 KB | Step-by-step fix instructions | 30 min |
| `README_AUDIT.md` | This file | Navigation guide | 2 min |

---

## The Problem (TL;DR)

The campaign execution system is broken due to 4 critical mismatches between code and database:

1. **Code queries `campaign_name`, database has `name`** - Undefined values
2. **Code joins on `campaigns.linkedin_account_id`, column doesn't exist** - Join fails
3. **Code uses wrong status values** (failed, approved, connection_request_sent) - No rows returned
4. **Code tries to set `contacted_at`, column doesn't exist** - Update fails

Affected routes:
- `/api/campaigns/direct/send-connection-requests` - BROKEN
- `/api/campaigns/direct/process-follow-ups` - BROKEN
- `/api/campaigns/linkedin/execute-via-n8n` - BROKEN
- `/api/campaigns/linkedin/execute-inngest` - BROKEN

---

## The Solution (TL;DR)

**Total Time:** 2-3 hours

1. **Database:** Add missing `linkedin_account_id` column (5 min)
2. **Code:** Fix column names and status values (1 hour)
3. **Policy:** Update RLS to use Supabase Auth (10 min)
4. **Test:** Verify end-to-end (30 min)

---

## Key Findings

### Critical Issues (System Breaking)

| Issue | Files | Fix Time |
|-------|-------|----------|
| Missing `campaign_name` field | 2 | 5 min |
| Broken `linkedin_account_id` join | 4 | 15 min + schema |
| Wrong status enum values | 2 | 10 min |
| Missing `contacted_at` field | 1 | 5 min |

### Medium Issues (Operational)

| Issue | Files | Fix Time |
|-------|-------|----------|
| Prospect data not joined properly | 1 | 20 min |
| Invalid OR clause in filters | 1 | 5 min |
| RLS policy references removed column | 1 | 10 min |

---

## Database Schema Reference

### Campaigns Table - Actual Columns

```
id, workspace_id, funnel_id, name (NOT campaign_name!),
description, campaign_type, target_icp, ab_test_variant,
message_templates, status, launched_at, completed_at,
created_by, created_at, updated_at

MISSING: linkedin_account_id (NEEDS TO BE ADDED)
```

### Campaign_Prospects Table - Actual Columns

```
id, campaign_id, prospect_id, status, invitation_sent_at,
invitation_id, connection_accepted_at, first_message_sent_at,
last_message_sent_at, message_count, first_reply_at,
last_reply_at, reply_count, error_message, retry_count,
last_retry_at, sequence_step, next_action_due_at,
added_to_campaign_at, updated_at, linkedin_user_id,
follow_up_due_at, follow_up_sequence_index, last_follow_up_at

MISSING: contacted_at (should use invitation_sent_at)
MISSING: first_name, last_name, company_name, title, linkedin_url
  (these are in workspace_prospects, not campaign_prospects)
```

### Status Values - Actual Enums

```
'pending', 'invitation_sent', 'connected', 'message_sent',
'replied', 'interested', 'not_interested', 'bounced', 'error',
'completed', 'paused', 'excluded'

WRONG VALUES IN CODE:
- 'approved' (doesn't exist)
- 'failed' (should be 'error')
- 'connection_request_sent' (should be 'invitation_sent')
- 'messaging' (should be 'message_sent')
```

---

## How to Use This Audit

### Step 1: Understand the Issues
- Read `AUDIT_FINDINGS.txt` for a clear explanation of each issue

### Step 2: Plan the Fix
- Read `AUDIT_SUMMARY.md` for high-level overview
- Check time estimates to plan your sprint

### Step 3: Implement the Fix
- Follow `SUPABASE_FIXES_GUIDE.md` step-by-step
- Each change shows BEFORE/AFTER code
- Line numbers reference the actual files

### Step 4: Verify the Fix
- Run the SQL verification queries (in audit report)
- Test each API endpoint
- Check database records

---

## Critical Points

1. **The database schema is correct** - No data loss, just mismatches
2. **The code needs fixes** - Straightforward column/value name changes
3. **Must add one new column** - `linkedin_account_id` to campaigns table
4. **Must update RLS policy** - Remove reference to removed Clerk column

---

## Files Affected

```
/app/api/campaigns/direct/send-connection-requests/route.ts (CRITICAL)
/app/api/campaigns/direct/process-follow-ups/route.ts (CRITICAL)
/app/api/campaigns/linkedin/execute-via-n8n/route.ts (CRITICAL)
/app/api/campaigns/linkedin/execute-inngest/route.ts (CRITICAL)
/supabase/migrations/20250918100000_campaign_prospects_junction.sql (RLS POLICY)
```

---

## Implementation Checklist

- [ ] Read audit findings
- [ ] Create database migration for `linkedin_account_id` column
- [ ] Fix send-connection-requests route (6 changes)
- [ ] Fix process-follow-ups route (3 changes)
- [ ] Fix execute-via-n8n route (already works after schema)
- [ ] Fix execute-inngest route (already works after schema)
- [ ] Update RLS policies
- [ ] Run verification SQL queries
- [ ] Test each endpoint
- [ ] Monitor production for 24 hours

---

## Questions?

All questions should be answerable from the audit files:

- **"What's wrong?"** → See `AUDIT_FINDINGS.txt`
- **"How do I fix it?"** → See `SUPABASE_FIXES_GUIDE.md`
- **"Why is this broken?"** → See `SUPABASE_AUDIT_REPORT.md`
- **"What's the impact?"** → See `AUDIT_SUMMARY.md`

---

## Audit Methodology

This audit:
1. ✓ Examined actual database schema from migrations
2. ✓ Found all Supabase queries in codebase (40+ files)
3. ✓ Compared queries against actual schema
4. ✓ Identified 7 specific issues across 4 critical files
5. ✓ Provided exact SQL and code fixes
6. ✓ Created testing verification steps

---

**Audit Date:** November 22, 2025
**Auditor:** Claude Code Database Analysis
**Status:** Complete - Ready for Implementation
