# Handover: Inbound-First Reply Detection

**Date:** December 20, 2025
**Status:** ✅ Complete and Deployed

---

## Summary

Fixed the reply detection system by implementing an **inbound-first approach** that catches replies the prospect-first approach was missing. The issue was that LinkedIn user IDs stored in `campaign_prospects.linkedin_user_id` often don't match Unipile's `sender_id` format.

---

## Problem

The poll-message-replies cron was missing replies from Irish, Charissa, and Michelle's accounts because:

1. **ID format mismatch:** LinkedIn user IDs can be stored as:
   - Full LinkedIn URLs (`linkedin.com/in/john-doe-12345`)
   - Provider IDs (`abc123xyz789`)
   - Vanity names (`john-doe`)
   - Truncated versions of any of the above

2. **Prospect-first limitation:** The original approach started from prospects and tried to find their messages. If the ID didn't match exactly, the reply was missed.

---

## Solution: Inbound-First Pass

Added a new `processInboundMessagesFirst()` function that runs AFTER the prospect-first pass. It:

1. **Fetches inbound messages** from Unipile for each LinkedIn account
2. **Tries 3 matching strategies** to find the prospect:
   - **Strategy 1: Exact match** on `linkedin_user_id = sender_id`
   - **Strategy 2: Prefix match** using `linkedin_user_id LIKE 'prefix%'`
   - **Strategy 3: Name match** using `first_name` + `last_name` (fallback)
3. **Self-heals:** When a name match is found, updates the prospect's `linkedin_user_id` to prevent future mismatches

---

## Key Code Changes

**File:** `app/api/cron/poll-message-replies/route.ts`

### Added Inbound-First Pass Call (Lines 473-484)
```typescript
// INBOUND-FIRST PASS (Dec 20, 2025)
// Catch replies that weren't matched in the prospect-first pass
console.log('\n Starting INBOUND-FIRST pass to catch missed replies...');

const inboundResults = await processInboundMessagesFirst(supabase, accountCache);
results.replies_found += inboundResults.replies_found;
if (inboundResults.unmatched_count > 0) {
  console.log(`${inboundResults.unmatched_count} inbound messages could not be matched`);
}
```

### New Function: processInboundMessagesFirst (Lines 505-797)

3-strategy matching:
```typescript
// Strategy 1: Exact match on linkedin_user_id
const { data: exactMatch } = await supabase
  .from('campaign_prospects')
  .select(`id, first_name, last_name, linkedin_user_id, ...`)
  .eq('linkedin_user_id', senderId)
  .in('campaign_id', campaignIds)
  .maybeSingle();

// Strategy 2: Prefix match (handles truncation)
if (!matchedProspect && senderId.length >= 15) {
  const senderPrefix = senderId.slice(0, 20);
  const { data: prefixMatches } = await supabase
    .from('campaign_prospects')
    .select(`...`)
    .like('linkedin_user_id', `${senderPrefix}%`)
    .in('campaign_id', campaignIds)
    .limit(1);
}

// Strategy 3: Name match (fallback for completely different IDs)
if (!matchedProspect && senderName) {
  const nameParts = senderName.toLowerCase().split(' ');
  const { data: nameMatches } = await supabase
    .from('campaign_prospects')
    .select(`...`)
    .ilike('first_name', firstName)
    .ilike('last_name', `%${lastName}%`)
    .in('campaign_id', campaignIds)
    .in('status', ['connected', 'connection_request_sent', 'messaging', 'follow_up_sent'])
    .limit(1);

  // Self-healing: update linkedin_user_id when name match found
  await supabase
    .from('campaign_prospects')
    .update({ linkedin_user_id: senderId })
    .eq('id', matchedProspect.id);
}
```

### Actions on Reply Detection

When a reply is found, the function:
1. **Updates prospect status** to `replied`
2. **Syncs to Airtable** via `airtableService.syncLinkedInLead()`
3. **Cancels pending queue items** in `send_queue` and `email_send_queue`
4. **Archives follow-up drafts** in `follow_up_drafts`
5. **Triggers Reply Agent** to generate response draft

---

## Results

After deployment, the inbound-first pass detected **15 new replies** that were previously missed.

---

## Architecture Clarification (From Discussion)

User clarified the CRM architecture:

| Layer | Tool | Purpose |
|-------|------|---------|
| **Engine** | Supabase | Campaign execution, data storage, SAM logic |
| **Day-to-day CRM** | Airtable | Account manager views, daily operations |

**Key points:**
- ActiveCampaign is too expensive (per-contact pricing)
- Airtable has 125k records on Business plan
- Currently only positive replies sync to Airtable
- CRM sync from webhook includes ActiveCampaign; cron does NOT

---

## Data Flow

```
LinkedIn Reply Detected
        ↓
1. Supabase (campaign_prospects.status = 'replied')
2. Supabase (reply_agent_drafts created)
3. Airtable (LinkedIn Positive Leads 2025)
        ↓
Reply Agent generates AI response draft
```

---

## Future Work (Discussed, Not Implemented)

These items were discussed but NOT implemented:

1. **Expand Airtable sync** - Currently only syncs positive replies. Could sync ALL prospects with status changes.

2. **Add ActiveCampaign to cron** - CRM sync from `lib/services/crm-sync.ts` is only called from webhook, not from poll-message-replies cron.

3. **Define Airtable views** - Views for account managers:
   - By campaign status
   - By intent classification
   - By industry/company size
   - By response date

4. **Multi-channel future** - User mentioned needing WhatsApp, Facebook, Instagram, Telegram integration (ActiveCampaign has WhatsApp integration).

---

## Files Modified

| File | Change |
|------|--------|
| `app/api/cron/poll-message-replies/route.ts` | Added `processInboundMessagesFirst()` function |

---

## Deployment Status

- ✅ Code deployed to production
- ✅ 15 new replies detected on first run
- ✅ Self-healing working (updating linkedin_user_id on name matches)

---

**Last Updated:** December 20, 2025
