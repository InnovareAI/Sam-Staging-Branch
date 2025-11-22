# Supabase Database Query Audit - Executive Summary

**Date:** November 22, 2025
**Scope:** Campaign execution system
**Status:** CRITICAL ISSUES FOUND - System is Broken

---

## Key Finding

The campaign execution system (`/api/campaigns/direct/*` routes) is **currently non-functional** due to 4 critical mismatches between the code and the actual database schema.

---

## Critical Issues at a Glance

### 1. Missing `campaign_name` Field ❌
- **What code expects:** `campaigns.campaign_name`
- **What actually exists:** `campaigns.name`
- **Impact:** Campaign queries return `campaign_name: undefined`
- **Files affected:** 2
- **Severity:** Critical

### 2. Broken Foreign Key Join ❌
- **What code expects:** `campaigns.linkedin_account_id` (to join to `workspace_accounts`)
- **What exists:** Column doesn't exist
- **Impact:** Join fails, returns no data
- **Files affected:** 4
- **Severity:** Critical

### 3. Wrong Status Enum Values ❌
- **What code uses:** `pending`, `approved`, `failed`, `connection_request_sent`, `messaging`
- **What exists:** `pending`, `invitation_sent`, `error`, `message_sent`
- **Impact:** Queries return 0 rows or updates fail
- **Files affected:** 2
- **Severity:** Critical

### 4. Missing `contacted_at` Field ❌
- **What code expects:** `campaign_prospects.contacted_at`
- **What exists:** `campaign_prospects.invitation_sent_at`
- **Impact:** Updates fail with column doesn't exist error
- **Files affected:** 1
- **Severity:** Critical

---

## Files Impacted

| File | Critical Issues | Impact |
|------|-----------------|--------|
| `/app/api/campaigns/direct/send-connection-requests/route.ts` | All 4 + more | Completely broken |
| `/app/api/campaigns/direct/process-follow-ups/route.ts` | Issues 1, 2, 3 | Completely broken |
| `/app/api/campaigns/linkedin/execute-via-n8n/route.ts` | Issue 2 | Will fail |
| `/app/api/campaigns/linkedin/execute-inngest/route.ts` | Issue 2 | Will fail |

---

## What Happens When These Routes Run

1. **send-connection-requests** - Fails immediately at campaign fetch (line 57)
   - Error: Column `campaign_name` doesn't exist OR broken join on non-existent column

2. **process-follow-ups** - Fails immediately at prospects fetch (line 62)
   - Error: Column `campaign_name` doesn't exist OR broken join on non-existent column

3. **execute-via-n8n** - Fails when campaign query executes
   - Error: Cannot join on non-existent column `linkedin_account_id`

4. **execute-inngest** - Fails when campaign query executes
   - Error: Cannot join on non-existent column `linkedin_account_id`

---

## Root Cause

The code was written expecting a different database schema than what currently exists. The schema was refactored (migrations show `campaigns.name` instead of `campaigns.campaign_name`) but the code was not updated.

---

## Required Fixes

### Database Level (Step 1)
Add missing column to enable joins:
```sql
ALTER TABLE campaigns
ADD COLUMN linkedin_account_id UUID REFERENCES workspace_accounts(id) ON DELETE SET NULL;
```
**Time:** 5 minutes

### Code Level (Steps 2-5)
Fix column references and status values:
- Change `campaign_name` → `name`
- Change `connection_request_sent` → `invitation_sent`
- Change `contacted_at` → `invitation_sent_at`
- Change `failed` → `error`
- Fix joins to include `workspace_prospects` for prospect data

**Time:** 1-2 hours

### RLS Policy (Step 6)
Update RLS to use Supabase Auth instead of removed Clerk references

**Time:** 10 minutes

### Testing (Step 7-9)
Verify all changes

**Time:** 30 minutes

**Total Time:** ~2 hours

---

## Detailed Documentation

For complete details, see:
- **`SUPABASE_AUDIT_REPORT.md`** - Full audit with all findings
- **`SUPABASE_FIXES_GUIDE.md`** - Step-by-step fix instructions
