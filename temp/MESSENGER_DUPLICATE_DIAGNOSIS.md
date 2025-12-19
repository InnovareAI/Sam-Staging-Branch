# Messenger Campaign Duplicate Message Investigation

**Date:** December 19, 2025
**User Report:** Gilad Mor-Hayim received duplicate TechStars message on Friday
**Campaign:** c243c82d-12fc-4b49-b5b2-c52a77708bf1 ("IA/ Techstars/ 1st Degree")

## Database Evidence

### send_queue Table
- **Total entries for Gilad:** 1
- **Entry ID:** 8dec8186-58c9-46f4-a8c6-d09821352654
- **Status:** sent
- **Created:** 2025-12-18T13:35:26.150221
- **Sent:** 2025-12-18T19:16:10.174 (Wednesday, NOT Friday)
- **Message Type:** direct_message_1

### campaign_messages Table
- **Total entries for Gilad:** 1
- **Entry ID:** 42413372-d810-4ec3-9869-c347a3577fe7
- **Sent:** 2025-12-18T19:16:00.957 (Wednesday)
- **Platform Message ID:** linkedin_direct_message_1_8dec8186-58c9-46f4-a8c6-d09821352654

### campaign_prospects Table
- **Gilad appears in 2 messenger campaigns:**
  1. `8b6fb109-6ab7-4f42-aa94-5eefa6fd96b8` - "Techstars !st Degree" (status: draft, NO queue entries)
  2. `c243c82d-12fc-4b49-b5b2-c52a77708bf1` - "IA/ Techstars/ 1st Degree" (status: paused, 1 queue entry)

### Campaign c243c82d-12fc-4b49-b5b2-c52a77708bf1
- **Type:** messenger
- **Status:** paused
- **Total prospects:** 50
- **Total send_queue entries:** 49
- **Duplicates in send_queue:** 0 (NONE)

## Constraint Verification

**Unique Constraint:** `send_queue_campaign_prospect_message_unique`
- **Columns:** (campaign_id, prospect_id, message_type)
- **Test Result:** ✅ Constraint PREVENTS duplicate inserts

## Atomic Locking Test

**Test:** Two simultaneous attempts to lock same queue entry
- **Lock 1:** FAILED
- **Lock 2:** SUCCESS
- **Result:** ✅ Only ONE lock succeeded - race conditions PREVENTED

## Code Analysis

### 1. Queue Creation (`/api/campaigns/direct/send-messages-queued`)
- **Lines 587-615:** ONE-BY-ONE insertion prevents batch failures
- **Constraint:** Database constraint prevents duplicate (campaign_id, prospect_id, message_type)
- **Result:** ✅ Cannot create duplicates in send_queue

### 2. Auto-Queuing (`/api/cron/queue-pending-prospects`)
- **Lines 92-113:** Cross-campaign deduplication
- **Lines 465-479:** ONE-BY-ONE insertion
- **Result:** ✅ Cannot create duplicates from cron

### 3. Queue Processing (`/api/cron/process-send-queue`)
- **Lines 488-509:** Atomic locking with optimistic concurrency control
- **Lines 842-862:** Single Unipile API call per queue entry
- **Lines 865-871:** Mark as sent AFTER successful send
- **Result:** ✅ Cannot send duplicates from same queue entry

## Findings

### What CANNOT Happen
1. ❌ Database duplicates (prevented by unique constraint)
2. ❌ Race condition duplicates (prevented by atomic locking)
3. ❌ Auto-queue duplicates (prevented by cross-campaign deduplication)
4. ❌ Multiple sends from same queue entry (single API call per entry)

### What COULD Happen
1. ✅ **User clicked "Start Campaign" twice rapidly** before queue creation finished
   - **Mitigation:** Database constraint would prevent second insert
   - **Evidence:** Only 1 queue entry exists

2. ✅ **Two different campaigns with same prospects**
   - **Evidence:** Gilad IS in 2 campaigns, but draft campaign has NO queue entries

3. ✅ **Unipile API sent message twice from single request**
   - **Evidence:** Cannot verify - would need Unipile logs
   - **Likelihood:** LOW (Unipile API is reliable)

4. ✅ **User misremembered the day** (Wednesday vs Friday)
   - **Evidence:** Message sent on Wednesday Dec 18, user says Friday
   - **Likelihood:** HIGH

5. ✅ **Historical duplicate before Dec 18 fix, already cleaned up**
   - **Evidence:** No evidence in current database
   - **Likelihood:** MEDIUM

## Recommended Actions

### Immediate
1. ✅ **CONFIRM WITH USER:** Was it actually Friday or Wednesday?
2. ✅ **CHECK LINKEDIN INBOX:** How many messages does Gilad actually show?
3. ✅ **CHECK UNIPILE LOGS:** Did Unipile receive 1 or 2 send requests?

### Additional Safeguards (Optional)
1. **Add idempotency key to Unipile requests**
   - Hash of (campaign_id, prospect_id, message_type, timestamp)
   - Store in send_queue.unipile_idempotency_key
   - Include in Unipile API headers (if supported)

2. **Add send_attempt_count to send_queue**
   - Increment on each send attempt
   - Alert if > 1 for same entry

3. **Add message fingerprint to campaign_messages**
   - Hash of (recipient_linkedin_profile, message_content, sent_at_date)
   - Detect duplicates even if queue entry is deleted

## Conclusion

**Current Status:** ✅ **NO DUPLICATES DETECTED IN DATABASE**

**Evidence suggests:**
- Only 1 message in send_queue
- Only 1 message in campaign_messages
- Message sent on Wednesday Dec 18, NOT Friday
- All duplicate-prevention mechanisms working correctly

**Most Likely Explanation:**
- User misremembered the day OR
- User seeing historical duplicate from before Dec 18 fix OR
- User confused with different prospect/campaign

**Recommended Next Step:**
- Ask user to check LinkedIn inbox for Gilad conversation
- Verify how many identical TechStars messages appear
- Check timestamps of messages in LinkedIn UI
