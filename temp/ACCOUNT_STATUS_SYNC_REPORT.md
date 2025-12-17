# LinkedIn Account Status Sync - Investigation & Fix Report

**Date:** December 17, 2025
**Issue:** UI showing LinkedIn accounts as "connected" when Unipile API reports them as "disconnected"

---

## 🔍 Root Cause Analysis

### The Problem

The database table `user_unipile_accounts` was storing `connection_status = 'active'` for all accounts, regardless of their actual connection status in Unipile. This caused the UI to display accounts as "connected" when they were actually:

1. **Deleted from Unipile** (account no longer exists in Unipile API)
2. **Credential Issues** (Unipile reports `status: 'CREDENTIALS'` - needs re-authentication)

### Why This Happened

The system had **no automatic sync mechanism** between Unipile API and the database. When accounts were:
- Deleted from Unipile dashboard
- Disconnected due to credential issues
- Removed by users

...the database was never updated to reflect these changes.

---

## 🔧 What Was Fixed

### 1. Database Sync (Immediate Fix)

**Updated accounts in `user_unipile_accounts` table:**

| Account Name | Unipile Account ID | Previous Status | New Status | Reason |
|--------------|-------------------|-----------------|------------|---------|
| Irish Maguad | `avp6xHsCRZaP5uSPmjc2jg` | active | **disconnected** | Deleted from Unipile |
| Stan Bounev | `4Vv6oZ73RvarImDN6iYbbg` | active | **disconnected** | Deleted from Unipile |
| Stan Bounev | `DMGuhuk_R_yBFqXJlT21ow` | active | **disconnected** | Deleted from Unipile |
| Michelle Angelica Gestuveo | `MT39bAEDTJ6e_ZPY337UgQ` | active | **disconnected** | Deleted from Unipile |
| Thorsten Linz | `mERQmojtSZq5GeomZZazlw` | active | **disconnected** | Credential issues (needs re-auth) |
| tl@innovareai.com (GOOGLE) | `nefy7jYjS5K6X3U7ORxHNQ` | active | **disconnected** | Deleted from Unipile |
| tl@innovareai.com (GOOGLE) | `-Y6jm1HIRXe3zwDkUz4Paw` | active | **disconnected** | Deleted from Unipile |
| tvonlinz@icloud.com (MAIL) | `8n8TtEvoQBuhUNr84vICWw` | active | **disconnected** | Deleted from Unipile |

**Total accounts updated:** 8 (5 LinkedIn accounts marked disconnected across all workspaces)

### 2. Created Sync Script

**File:** `/temp/sync-unipile-account-status.mjs`

This script:
- ✅ Fetches all accounts from Unipile API
- ✅ Compares with database records
- ✅ Updates `connection_status` based on Unipile's actual status
- ✅ Marks deleted accounts as "disconnected" (doesn't delete from DB)
- ✅ Provides detailed logging and reporting

---

## 📊 Current Status (InnovareAI Workspace)

**Workspace ID:** `babdcab8-1a78-4b2f-913e-6e9fd9821009`

| Account Name | Platform | Status | Unipile Account ID |
|--------------|----------|--------|-------------------|
| ✅ tl@innovareai.com | GOOGLE | **ACTIVE** | jYXN8FeCTEukNSXDoaH3hA |
| ❌ Thorsten Linz | LINKEDIN | **DISCONNECTED** | mERQmojtSZq5GeomZZazlw |
| ❌ Irish Maguad | LINKEDIN | **DISCONNECTED** | avp6xHsCRZaP5uSPmjc2jg |
| ❌ Stan Bounev | LINKEDIN | **DISCONNECTED** | 4Vv6oZ73RvarImDN6iYbbg |
| ❌ Michelle Angelica Gestuveo | LINKEDIN | **DISCONNECTED** | MT39bAEDTJ6e_ZPY337UgQ |

**Working LinkedIn Account:** None currently active
**Working Google Calendar:** tl@innovareai.com (jYXN8FeCTEukNSXDoaH3hA)

---

## 🚨 Critical Finding: Thorsten Linz Account

**Account ID:** `mERQmojtSZq5GeomZZazlw`
**Status in Unipile:** `CREDENTIALS` (not fully disconnected, just needs re-authentication)

This account is **configured in `.env.local`** as:
```
UNIPILE_ACCOUNT_ID=mERQmojtSZq5GeomZZazlw
```

**This is the primary LinkedIn account used for campaigns.** It needs to be reconnected via the UI:

1. Go to Settings → Integrations
2. Click "Reconnect LinkedIn"
3. Re-enter LinkedIn credentials
4. Complete 2FA if required

---

## 🔄 Recommendations

### Immediate Actions

1. **Reconnect Thorsten Linz LinkedIn Account**
   - Navigate to Settings → Integrations
   - Click "Reconnect LinkedIn"
   - Enter credentials for account `mERQmojtSZq5GeomZZazlw`

2. **Run Sync Script Regularly**
   ```bash
   node temp/sync-unipile-account-status.mjs
   ```
   - Recommended: Weekly or after any Unipile account changes

### Long-Term Solutions

1. **Implement Automated Sync Cron Job**
   - Create `/app/api/cron/sync-unipile-status/route.ts`
   - Schedule to run every 6 hours via Netlify scheduled functions
   - Automatically update `connection_status` in database

2. **Add Webhook Handler**
   - Use Unipile's webhook for account status changes
   - Update database immediately when account is disconnected
   - Endpoint: `/app/api/webhooks/unipile/account-status/route.ts`

3. **Improve UI Error Handling**
   - Show clear warning when account needs re-authentication
   - Display "Last synced" timestamp
   - Add "Refresh status" button

---

## 📁 Files Created/Modified

### New Files
- ✅ `/temp/analyze_accounts.js` - Account status analysis script
- ✅ `/temp/fix-account-status.js` - Database update script (already executed)
- ✅ `/temp/sync-unipile-account-status.mjs` - **Sync script for future use**
- ✅ `/temp/ACCOUNT_STATUS_SYNC_REPORT.md` - This report

### Existing Files
- 📖 `/scripts/sync-with-unipile.mjs` - Only checks for orphaned accounts (doesn't sync status)
- 📖 `/app/api/unipile/accounts/route.ts` - Returns connection status but doesn't persist it

---

## 🧪 Verification Commands

### Check Database Status
```bash
# Query InnovareAI workspace LinkedIn accounts
curl -X GET "https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/user_unipile_accounts?workspace_id=eq.babdcab8-1a78-4b2f-913e-6e9fd9821009&platform=eq.LINKEDIN&select=account_name,connection_status" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Check Unipile API
```bash
# Get all accounts from Unipile
curl -X GET "https://api6.unipile.com:13670/api/v1/accounts" \
  -H "X-API-KEY: 85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA="
```

### Run Sync Script
```bash
# Sync database with Unipile API
node temp/sync-unipile-account-status.mjs
```

---

## 📝 Summary

| Metric | Value |
|--------|-------|
| Total accounts in database | 21 |
| Accounts with status mismatch | 8 |
| LinkedIn accounts needing reconnection | 5 |
| Active LinkedIn accounts (InnovareAI workspace) | 0 ⚠️ |
| Active Google Calendar accounts | 1 ✅ |

**Status:** ✅ Database sync complete. User needs to reconnect LinkedIn account `mERQmojtSZq5GeomZZazlw`.

---

**Next Steps:**
1. User reconnects Thorsten Linz LinkedIn account via UI
2. Implement automated sync cron job (optional)
3. Monitor for future credential issues
