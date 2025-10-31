# FIX CLIENT CAMPAIGN - QUICK START

**Client Campaign:** 20251028-3AI-SEO search 3
**Issue:** 49 prospects stuck, 17 already sent but not tracked
**Priority:** URGENT

---

## 🚀 Quick Fix (3 Commands)

### Step 1: Get Database Password

Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/settings/database

Copy the password from "Connection String" section.

### Step 2: Run Migration

```bash
# Set password and run migration (one command)
PGPASSWORD='paste_password_here' ./scripts/shell/migrate-with-password.sh
```

### Step 3: Fix Stuck Prospects

```bash
node scripts/js/fix-stuck-queued-prospects.mjs
```

**Done!** Check dashboard - should show "17 of 49 contacted"

---

## 📋 Alternative Methods

### Method A: Using psql with password in environment

```bash
# Add to .env.local
echo 'export PGPASSWORD="your_password"' >> .env.local

# Load environment
source .env.local

# Run migration
./scripts/shell/migrate-with-password.sh
```

### Method B: Using Supabase SQL Editor (Manual)

1. Open: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql
2. Click "New Query"
3. Copy SQL from: `sql/migrations/20251031_cleanup_campaign_prospects.sql`
4. Paste and click "Run"
5. Verify success message appears
6. Then run: `node scripts/js/fix-stuck-queued-prospects.mjs`

### Method C: Using Node.js with pg (Requires password in .env.local)

```bash
# Add to .env.local first:
SUPABASE_DB_PASSWORD=your_password

# Then run:
node scripts/js/apply-migration-direct.mjs
```

---

## ✅ Verification

After running the migration and fix script:

### 1. Check Queue
```bash
node scripts/js/view-campaign-queue.mjs
```

Should show:
- **Before:** 56 prospects (17 with message IDs stuck)
- **After:** 39 prospects (only ones waiting to send)

### 2. Check Database
```bash
curl -s 'https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/campaign_prospects?select=status&campaign_id=eq.51803ded-bbc9-4564-aefb-c6d11d69f17c&status=eq.connection_requested' \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ' \
  | jq 'length'
```

Should return: **17**

### 3. Check Dashboard

Go to: https://app.meet-sam.com/workspace/[workspace_id]/campaigns

Campaign "20251028-3AI-SEO search 3" should show:
- **Contacted:** 17 (was 0)
- **Total:** 49

---

## 🛠️ What the Migration Does

1. **Drops broken status constraint**
   - Removes old constraint blocking updates

2. **Adds new status constraint** with valid values:
   - `pending`, `approved`, `ready_to_message`
   - `queued_in_n8n`, `contacted`, `connection_requested`
   - `connected`, `replied`, `completed`
   - `failed`, `error`, `bounced`
   - `not_interested`, `paused`, `excluded`

3. **Creates performance indexes**
   - Speeds up status queries
   - Optimizes campaign lookups

4. **Adds helper function**
   - `mark_prospect_contacted(prospect_id, message_id)`
   - For easy status updates

---

## 🔧 Troubleshooting

### Migration fails with "constraint already exists"

This is safe to ignore if it's the only error. The constraint is already applied.

### psql command not found

Install PostgreSQL client:
```bash
brew install postgresql@15
```

### Connection timeout

Check network/firewall. Supabase requires internet access to:
- db.latxadqrvrrrcvkktrog.supabase.co:5432

### Wrong password

Get fresh password from:
https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/settings/database

Click "Reset database password" if needed.

---

## 📁 Files Reference

**Migration:**
- `sql/migrations/20251031_cleanup_campaign_prospects.sql`

**Scripts:**
- `scripts/shell/migrate-with-password.sh` - Run migration with psql
- `scripts/js/apply-migration-direct.mjs` - Run with Node.js
- `scripts/js/fix-stuck-queued-prospects.mjs` - Fix stuck prospects

**Documentation:**
- `docs/URGENT_FIX_CLIENT_CAMPAIGN.md` - Detailed explanation
- `docs/FIX_CLIENT_CAMPAIGN_NOW.md` - This file (quick start)

---

## ⏱️ Time Estimate

- **Migration:** 30 seconds
- **Fix prospects:** 10 seconds
- **Verification:** 1 minute
- **Total:** ~2 minutes

---

## 🆘 If Still Stuck

1. Use Supabase SQL Editor (Method B above) - always works
2. Send error message to #dev-support
3. Include: Migration file name, error message, what step failed

---

**CRITICAL:** This fixes a production issue affecting client campaign tracking.

**Run this ASAP to unblock the client!**
