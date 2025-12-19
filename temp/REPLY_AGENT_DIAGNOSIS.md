# LinkedIn Reply Agent Diagnostic Report
**Date:** December 19, 2025
**Status:** 🟡 PARTIALLY WORKING - Drafts Generated, Notifications Failing

---

## ✅ What's Working

1. **Reply Detection:** Poll-message-replies cron is detecting LinkedIn replies correctly
2. **Draft Generation:** AI is generating reply drafts using Claude Opus 4.5
3. **Draft Storage:** Drafts are being saved to `reply_agent_drafts` table with status `pending_approval`

**Evidence:**
- 3 pending approval drafts found in database
- Rudy Walgraef (replied Dec 17, 2025) - has draft with intent=INTERESTED
- Sara Ritchie (replied Dec 16, 2025) - has draft with intent=VAGUE_POSITIVE
- Dan James (replied Dec 16, 2025) - has draft with intent=TIMING

---

## ❌ What's Broken

**NOTIFICATIONS ARE NOT BEING SENT**

Users are not receiving:
- Email notifications with approval links
- Google Chat notifications
- Slack notifications

**Root Cause:** Code is querying the wrong table for workspace owners.

### The Bug

**File:** `/app/api/cron/reply-agent-process/route.ts`
**Lines:** 893-898 (in `sendHITLEmail` function)

**Current Code (BROKEN):**
```typescript
const { data: members } = await supabase
  .from('workspace_members')
  .select('user_id, users(email), workspaces(name)')
  .eq('workspace_id', draft.workspace_id)
  .eq('role', 'owner')
  .limit(1);

const ownerEmail = members?.[0]?.users?.email;
```

**Problem:**
- The `workspace_members` table is EMPTY
- There are no rows with `role='owner'`
- This causes `members` to be null/empty
- No email address is found
- Notification fails silently

**Correct Approach:**
- Owner data is stored in `workspaces.owner_id`
- Need to query `workspaces` table first
- Then join to `users` table to get email

---

## 🔧 Fix Required

### File to Edit
`/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/cron/reply-agent-process/route.ts`

### Function: `sendHITLEmail`
Lines 893-898

### Change From:
```typescript
const { data: members } = await supabase
  .from('workspace_members')
  .select('user_id, users(email), workspaces(name)')
  .eq('workspace_id', draft.workspace_id)
  .eq('role', 'owner')
  .limit(1);

const ownerEmail = members?.[0]?.users?.email;
const clientName = workspaceName || members?.[0]?.workspaces?.name;
```

### Change To:
```typescript
// Get workspace and owner info
const { data: workspace } = await supabase
  .from('workspaces')
  .select('owner_id, name')
  .eq('id', draft.workspace_id)
  .single();

if (!workspace) {
  console.error('Workspace not found');
  return;
}

// Get owner email
const { data: owner } = await supabase
  .from('users')
  .select('email')
  .eq('id', workspace.owner_id)
  .single();

const ownerEmail = owner?.email;
const clientName = workspaceName || workspace.name;
```

---

## 📬 Pending Drafts (Need Immediate Attention)

### 1. Rudy Walgraef
- **Company:** SBFO SERVICE GLOBAL
- **Campaign:** Jennifer Email Campaign
- **Workspace:** Jennifer Fleming
- **Owner Email:** (needs to be looked up from owner_id: a4c3ff4d-ac9c-4e84-9b35-967ce6ff8189)
- **Intent:** INTERESTED
- **Created:** Dec 17, 2025
- **Inbound:** "Hi Jennifer, Sorry for the late reply. Is this still in place – SAM? Please send me a video how it works."
- **Draft Reply:** "Hi Rudy, No worries on the timing. Yes, SAM is still running — here's a quick walkthrough..."
- **Approve:** https://app.meet-sam.com/api/reply-agent/approve?token=ba10fea0-7e83-4bc0-bd71-8d006e6ceec7&action=approve

### 2. Sara Ritchie
- **Company:** (none)
- **Campaign:** Unknown
- **Workspace:** Charissa Saniel
- **Owner Email:** (needs to be looked up from owner_id: 744649a8-d015-4ff7-9e41-983cc9ca7b79)
- **Intent:** VAGUE_POSITIVE
- **Created:** Dec 16, 2025
- **Inbound:** "I am very interested in AI, and I teach it as well."
- **Draft Reply:** "That's cool — what do you teach? Curious if it's more technical..."
- **Approve:** https://app.meet-sam.com/api/reply-agent/approve?token=ac547981-35a4-4abb-ad1b-a10e5f812eea&action=approve

### 3. Dan James
- **Company:** Quantised
- **Campaign:** Unknown
- **Workspace:** Irish Maguad
- **Owner Email:** (needs to be looked up from owner_id: 1949f7fc-f354-47ba-98f1-ae0a7d3b1d5d)
- **Intent:** TIMING
- **Created:** Dec 16, 2025
- **Inbound:** "Hi Irish, thanks for reaching out! I'm very very early-stage..."
- **Draft Reply:** "Congrats on getting started — building anything with a newborn is no joke..."
- **Approve:** https://app.meet-sam.com/api/reply-agent/approve?token=64318227-2b57-4cc4-8952-8f6be2569cc5&action=approve

---

## 🔍 System Health

**Cron Schedules:**
- ✅ `poll-message-replies`: Every 15 minutes (detecting replies)
- ✅ `reply-agent-process`: Every 5 minutes (generating drafts)

**Database Tables:**
- ✅ `reply_agent_drafts`: Working correctly
- ✅ `workspace_reply_agent_config`: Enabled for all 3 workspaces
- ⚠️ `workspace_members`: Empty (not being used)
- ✅ `workspaces`: Has correct `owner_id` field

**Workspace Config:**
- Jennifer Fleming: enabled=true, approval_mode=manual, notification_channels=["email","chat"]
- Charissa Saniel: enabled=true, approval_mode=manual, notification_channels=["email","chat"]
- Irish Maguad: enabled=true, approval_mode=manual, notification_channels=["email","chat"]

---

## 🎯 Action Items

1. **URGENT:** Fix notification code in `reply-agent-process/route.ts` (line 893)
2. **TEST:** Deploy fix and trigger reply-agent-process cron manually
3. **VERIFY:** Check that owner emails are found correctly
4. **MONITOR:** Ensure notifications are sent for next reply
5. **BACKFILL:** Manually notify users about the 3 pending drafts above

---

## 📊 Summary

**The reply agent is fundamentally working:**
- Detects replies ✅
- Generates AI drafts ✅
- Stores drafts correctly ✅

**But notifications are broken due to:**
- Wrong database query (workspace_members instead of workspaces)
- No error logging when owner email not found
- Silent failure in notification sending

**Impact:**
- Users don't know they have replies
- Replies are going unanswered
- Prospects are waiting for responses

**Fix Time:** 5 minutes (simple database query change)
