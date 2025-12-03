# Handover: Database-First Prospect Architecture

**Date:** December 4, 2025
**Status:** COMPLETE
**Build:** Verified passing

---

## Summary

Implemented database-first architecture across the entire codebase. All prospect data now flows through `workspace_prospects` (master table) before being inserted into `campaign_prospects` or `prospect_approval_data`.

---

## Changes Made

### P0: Emergency Bypass DELETED

| File | Action |
|------|--------|
| `/api/campaigns/[id]/add-prospects-direct/route.ts` | **DELETED** - Was an emergency bypass that inserted directly to campaign_prospects |

### P1: Critical Fixes (4 files)

| File | Change |
|------|--------|
| `/api/campaigns/transfer-prospects/route.ts` | Added workspace_prospects upsert before campaign_prospects insert with `master_prospect_id` FK |
| `/api/campaigns/upload-prospects/route.ts` | Added workspace_prospects upsert before campaign_prospects insert with `master_prospect_id` FK |
| `/api/prospect-approval/upload-prospects/route.ts` | Added workspace_prospects upsert before prospect_approval_data insert with `master_prospect_id` |
| `/api/prospects/quick-add/route.ts` | Added workspace_prospects upsert before prospect_approval_data insert with `master_prospect_id` |

### P2: Legacy Endpoints

| File | Status |
|------|--------|
| `/api/campaigns/charissa/upload-csv/route.ts` | **FIXED** - Added workspace_prospects upsert with `master_prospect_id` FK |
| `/api/campaigns/upload-with-resolution/route.ts` | **Already compliant** - Uses workspace_prospects (lines 168-210) |
| `/api/cron/process-outbox/route.ts` | **Already compliant** - Read-only from workspace_prospects |

---

## Pattern Applied

Every file now follows this pattern:

```typescript
// 1. Helper function added to each file
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) return match[1].toLowerCase().trim();
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

// 2. STEP 1: Upsert to workspace_prospects (master table)
const linkedinHash = normalizeLinkedInUrl(linkedin_url);

const { data: masterProspect } = await supabase
  .from('workspace_prospects')
  .upsert({
    workspace_id,
    linkedin_url,
    linkedin_url_hash: linkedinHash,
    first_name,
    last_name,
    // ... other fields
  }, {
    onConflict: 'workspace_id,linkedin_url_hash',
    ignoreDuplicates: false
  })
  .select('id')
  .single();

// 3. STEP 2: Insert to campaign_prospects WITH master_prospect_id FK
const { error } = await supabase
  .from('campaign_prospects')
  .insert({
    campaign_id,
    workspace_id,
    master_prospect_id: masterProspect.id,  // FK to workspace_prospects
    linkedin_url,
    // ... other fields
  });
```

---

## Data Flow (After Changes)

```
ALL INPUTS NOW GO THROUGH SAME PATH:

CSV Upload ─────────────┐
                        │
LinkedIn Search ────────┼──→ workspace_prospects (UPSERT)
                        │         │
Manual Paste ───────────┤         ▼
                        │   Get master_prospect_id
Quick Add ──────────────┘         │
                                  ▼
                        campaign_prospects / prospect_approval_data
                        (WITH master_prospect_id FK)
```

---

## Previously Completed (Before This Session)

These files were already fixed in an earlier session:

| File | Status |
|------|--------|
| `/api/prospects/linkedin-search/route.ts` | Saves to workspace_prospects |
| `/api/prospect-approval/upload-csv/route.ts` | Saves to workspace_prospects with approval_status='pending' |
| `/api/prospects/add-to-campaign/route.ts` | Uses master_prospect_id FK correctly |
| `/api/campaigns/route.ts` | Auto-transfer uses workspace_prospects first |
| `/api/campaigns/add-approved-prospects/route.ts` | Uses workspace_prospects with master_prospect_id FK |
| `/api/campaigns/draft/route.ts` | Uses workspace_prospects first |

---

## Database Schema

### workspace_prospects (Master Table)

```sql
-- Key columns for deduplication
workspace_id UUID NOT NULL
linkedin_url TEXT
linkedin_url_hash TEXT  -- Normalized vanity name for unique constraint
email TEXT
email_hash TEXT

-- UNIQUE constraint for deduplication
UNIQUE(workspace_id, linkedin_url_hash)
```

### campaign_prospects (Campaign Table)

```sql
-- FK to master table
master_prospect_id UUID REFERENCES workspace_prospects(id)

-- Kept for backwards compatibility
linkedin_url TEXT
```

### prospect_approval_data (Approval Queue)

```sql
-- FK to master table
master_prospect_id UUID REFERENCES workspace_prospects(id)
```

---

## Cron Jobs Status

All cron jobs are safe (read-only on prospect data or only update status fields):

| Cron Job | Status |
|----------|--------|
| `/api/cron/process-send-queue` | Only updates campaign_prospects status |
| `/api/cron/poll-accepted-connections` | Only updates connection status |
| `/api/cron/poll-message-replies` | Only updates reply status |
| `/api/cron/send-follow-ups` | Only updates sequence index |
| `/api/cron/queue-pending-prospects` | Only inserts to send_queue |
| `/api/cron/process-outbox` | Reads from workspace_prospects (correct) |

---

## Testing Checklist

- [x] Build passes (`npm run build`)
- [ ] CSV upload creates workspace_prospects records
- [ ] LinkedIn search creates workspace_prospects records
- [ ] Quick add creates workspace_prospects record
- [ ] Manual paste creates workspace_prospects records
- [ ] Transfer to campaign includes master_prospect_id
- [ ] Duplicate LinkedIn URLs are properly deduplicated

---

## Rollback Plan

If issues arise:

1. The `master_prospect_id` column is nullable - campaigns will still work without it
2. The `linkedin_url` column is still populated in campaign_prospects (backwards compatible)
3. Can revert individual files without affecting others

---

## Next Steps

1. **Deploy to production** - All changes are backwards compatible
2. **Monitor logs** - Watch for upsert errors in workspace_prospects
3. **Data migration** - Consider backfilling master_prospect_id for existing campaign_prospects records

---

## Files Modified This Session

```
DELETED:
- app/api/campaigns/[id]/add-prospects-direct/route.ts

MODIFIED:
- app/api/campaigns/transfer-prospects/route.ts
- app/api/campaigns/upload-prospects/route.ts
- app/api/prospect-approval/upload-prospects/route.ts
- app/api/prospects/quick-add/route.ts
- app/api/campaigns/charissa/upload-csv/route.ts
```

---

## Plan File Location

Full plan details: `/Users/tvonlinz/.claude/plans/robust-doodling-pumpkin.md`
