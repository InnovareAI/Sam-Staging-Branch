# LinkedIn Account & Error Audit Report
**Date**: December 18, 2025
**Time**: ~17:55 UTC
**Audit Period**: Last 2 hours

---

## 1. LINKEDIN ACCOUNT STATUS SUMMARY

### ✅ All LinkedIn Accounts - HEALTHY

| Account Name | Database ID | Unipile ID | Status |
|-------------|------------|------------|--------|
| Thorsten Linz | `6dc49c30-0c8c-4b37-8805-4f6d7ba35b4b` | `09Uv5wIaSFOiN2gru_svbA` | ✅ OK / active |
| 𝗖𝗵𝗮𝗿𝗶𝘀𝘀𝗮 𝗦𝗮𝗻𝗶𝗲𝗹 | `c53d51a2-0727-4ad0-b746-ed7889d8eb97` | `4nt1J-blSnGUPBjH2Nfjpg` | ✅ OK / active |
| Rony Chatterjee, PhD | `9f53f2e4-93a5-4dd3-a968-c35df791cca0` | `I0XZxvzfSRuCL8nuFoUEuw` | ✅ OK / active |
| ChonaM Lamberte | `5b103dd8-fa2c-42ea-ab52-86a81718d584` | `Ll1T0gRVTYmLM6kqN1cJcg` | ✅ OK / active |
| Brian Neirby | `2162a64f-a45a-4de5-8b5e-0ea581a949f2` | `RFrEaJZOSGieognCTW0V6w` | ✅ OK / active |
| Michelle Angelica Gestuveo | `1e52138a-7f3e-4e97-9e56-40a4c3d08d7a` | `aroiwOeQQo2S8_-FqLjzNw` | ✅ OK / active |
| Samantha Truman | `f9c8a97a-d0ca-4b5c-98a8-8965a5c8475c` | `fntPg3vJTZ2Z1MP4rISntg` | ✅ OK / active |
| Sebastian Henkel | `386feaac-21ca-45c9-b098-126bf49baa86` | `gW6mCsj7RK-vp89UcDUC2w` | ✅ OK / active |
| Stan Bounev | `5645f3b6-0845-43e7-a615-18f8865b9b92` | `nGqBWgDmTkqnoMGA3Hbc9w` | ✅ OK / active |
| Irish Maguad | `102ec481-d08a-4b84-967e-fa8c92d453d8` | `ymtTx4xVQ6OVUFk83ctwtA` | ✅ OK / active |

**Total LinkedIn Accounts**: 10
**Status**: All accounts show `OK` status in Unipile API and `active` in database
**Connection Issues**: NONE

---

## 2. DISCREPANCY FOUND

### ⚠️ Martin Schechtner Account Missing from Database

**Unipile Status**: Account exists and is OK
- **Unipile ID**: `KeHOhroOTSut7IQr5DU4Ag`
- **Name**: Martin Schechtner
- **Type**: LINKEDIN
- **Status**: OK

**Database Status**: NOT FOUND
- No entry exists in `user_unipile_accounts` table

**Action Required**: This account exists in Unipile but is not synced to the database. It may need to be re-connected or the database record was deleted.

---

## 3. ERROR ANALYSIS (Last 2 Hours)

### Error Type Breakdown

| Error Type | Count | Percentage |
|-----------|-------|------------|
| **Invalid User ID Format** | 53 | 53.5% |
| **Profile Not Found** | 30 | 30.3% |
| **API Endpoint 404** | 10 | 10.1% |
| **Rate Limiting (429)** | 2 | 2.0% |
| **Recipient Unreachable** | 2 | 2.0% |
| **Feature Not Subscribed (403)** | 1 | 1.0% |
| **Invalid Account (422)** | 1 | 1.0% |
| **Total** | 99 | 100% |

---

## 4. ROOT CAUSE ANALYSIS

### 🔴 CRITICAL ISSUE #1: Invalid User ID Format (53 errors)

**Error Message**:
```json
{
  "status": 400,
  "type": "errors/invalid_parameters",
  "title": "Invalid parameters",
  "detail": "User ID does not match provider's expected format."
}
```

**Root Cause**: The `linkedin_user_id` field in `send_queue` contains:
- LinkedIn public identifiers (e.g., `micreid`, `lyubagolberg`, `jbafaty`)
- Full URLs (e.g., `http://www.linkedin.com/in/muneeb-siddique-11897021`)
- Username slugs instead of entity URNs

**Expected Format**: LinkedIn entity URNs like `ACoAAACYv0MB...`

**Affected Campaigns**:
1. **Consulting- Sequence B** (Campaign ID: `9904dfec-03dd-4ea7-be70-8db55cb3c261`) - 33 errors
   - Account: Samantha Truman (`fntPg3vJTZ2Z1MP4rISntg`)

2. **Consulting- Sequence A** (Campaign ID: `22d6c138-98a4-4e0c-8c85-fbc4e2d76bdd`) - 19 errors
   - Account: Samantha Truman (`fntPg3vJTZ2Z1MP4rISntg`)

**Examples of Invalid IDs**:
- `micreid` ❌ (should be `ACoAAA...`)
- `lyubagolberg` ❌
- `http://www.linkedin.com/in/susannawilliams` ❌
- `natashafranck` ❌

**Data Quality Issue**: The prospect import/enrichment process is saving LinkedIn public identifiers or URLs instead of LinkedIn entity URNs.

---

### 🟡 ISSUE #2: LinkedIn Profile Not Found (30 errors)

**Error Message**: `"LinkedIn profile not found or inaccessible"`

**Possible Causes**:
- Prospect deleted their LinkedIn profile
- Prospect blocked the sending account
- Profile privacy settings prevent access
- Invalid prospect data in campaign

---

### 🟠 ISSUE #3: API Endpoint 404 (10 errors)

**Error Message**:
```json
{
  "message": "Cannot POST /api/v1/messages/send",
  "error": "Not Found",
  "statusCode": 404
}
```

**Root Cause**: Incorrect API endpoint being called. The system is trying to POST to `/api/v1/messages/send` which doesn't exist on Unipile API.

**Affected Campaign**:
- **IA/ Techstars/ 1st Degree** (Campaign ID: `c243c82d-12fc-4b49-b5b2-c52a77708bf1`)
- **1st Degree Connection Messenger** (Campaign ID: `281feb3b-9d07-4844-9fe0-221665f0bb92`)

**Note**: These are messenger campaigns (direct messages to 1st degree connections). The endpoint `/api/v1/messages/send` is incorrect - should likely be `/api/v1/hosted/messaging/messages`.

---

### 🟢 ISSUE #4: Rate Limiting (2 errors)

**Error Message**:
```json
{
  "status": 429,
  "type": "errors/too_many_requests",
  "title": "Too many requests",
  "detail": "The provider cannot accept any more requests at the moment."
}
```

**Account Affected**: Sebastian Henkel (`gW6mCsj7RK-vp89UcDUC2w`)
**Campaign**: Sebastian Henkel - Connect

**Status**: Normal behavior - this is LinkedIn rate limiting protection. Only 2 occurrences indicates anti-detection system is working correctly.

---

### 🟢 ISSUE #5: Recipient Cannot Be Reached (2 errors)

**Error Message**: `"Recipient cannot be reached"`

**Cause**: Prospect has restricted messaging settings or has blocked the sender.

**Example**: User `khalidwak` (message_type: `direct_message_1`)

---

### 🔴 ISSUE #6: Feature Not Subscribed (1 error)

**Error Message**:
```json
{
  "status": 403,
  "type": "errors/feature_not_subscribed",
  "title": "Feature not subscribed",
  "detail": "The requested feature has either not been subscribed or not been authenticated properly."
}
```

**Campaign**: Consulting- Sequence A (Account: Samantha Truman)

**Likely Cause**: Samantha Truman's LinkedIn account does not have the necessary premium features (LinkedIn Premium or Sales Navigator) to send connection requests with messages, or the account authentication needs to be refreshed.

---

## 5. CAMPAIGN ERROR RANKINGS

| Rank | Campaign Name | Campaign ID | Errors | Account |
|------|--------------|-------------|--------|---------|
| 1 | Consulting- Sequence B | `9904dfec-03dd-4ea7-be70-8db55cb3c261` | 33 | Samantha Truman |
| 2 | Consulting- Sequence A | `22d6c138-98a4-4e0c-8c85-fbc4e2d76bdd` | 19 | Samantha Truman |
| 3 | IA- Canada- Startup 5 | `987dec20-b23d-465f-a8c7-0b9e8bac4f24` | 10 | Irish Maguad |
| 4 | Tursio.ai Credit Union | `d0e5c1ec-46d2-49f4-96a7-cfc0c558c8e2` | 8 | Rony Chatterjee |
| 5 | (Unknown) | `c590a2b3-cb39-4fb0-a90c-4447aac3e150` | 8 | (Unknown) |
| 6 | IA/ Techstars/ 1st Degree | `c243c82d-12fc-4b49-b5b2-c52a77708bf1` | 7 | Thorsten Linz |
| 7 | IA- Techstars- Founders | `64663df2-3f12-47eb-aaa9-6287a5a07777` | 5 | Thorsten Linz |

---

## 6. RECOMMENDATIONS

### 🔥 CRITICAL - Fix Data Quality Issue

**Problem**: 53% of all errors are caused by invalid LinkedIn user ID format.

**Action Items**:
1. **Investigate prospect import process** - Where is `linkedin_user_id` being populated?
2. **Fix data transformation** - Ensure LinkedIn entity URNs (not public identifiers) are extracted
3. **Add validation** - Reject or fix `linkedin_user_id` values that don't match pattern `^ACoA[A-Za-z0-9_-]+$`
4. **Clean existing data** - Run a script to identify and fix invalid `linkedin_user_id` values in `campaign_prospects` and `send_queue` tables

### 🟠 HIGH PRIORITY - Fix Messenger API Endpoint

**Problem**: 10 errors due to wrong API endpoint for messenger campaigns.

**Action Items**:
1. Review the code that sends direct messages to 1st degree connections
2. Correct the API endpoint from `/api/v1/messages/send` to the proper Unipile messaging endpoint
3. Likely should be: `/api/v1/hosted/messaging/messages`

### 🟡 MEDIUM PRIORITY - Check Samantha Truman Account

**Problem**: 52 errors (52% of all errors) coming from Samantha Truman's account.

**Action Items**:
1. Check if Samantha Truman has LinkedIn Premium or Sales Navigator
2. Verify account authentication is current
3. Consider re-authenticating the account in Unipile
4. Check if the account has been flagged or restricted by LinkedIn

### 🟢 LOW PRIORITY - Sync Martin Schechtner Account

**Problem**: Account exists in Unipile but not in database.

**Action Items**:
1. Check if this account was deleted or disconnected
2. Re-sync from Unipile or reconnect via UI
3. Add database record for this account if it should be active

---

## 7. ACCOUNT HEALTH SUMMARY

### ✅ No Accounts Need Reconnection

All 10 LinkedIn accounts in the database are:
- Connected to Unipile
- Showing `OK` status
- Marked as `active` in database
- No authentication issues

**Conclusion**: The errors are NOT caused by disconnected or unhealthy LinkedIn accounts. All account connections are working properly.

---

## 8. IMMEDIATE ACTIONS REQUIRED

1. ✅ **Verify all accounts are healthy** - COMPLETE (all accounts OK)
2. 🔴 **Fix prospect data import** - LinkedIn user IDs must be entity URNs, not public identifiers
3. 🟠 **Fix messenger campaign API endpoint** - Correct `/api/v1/messages/send` to proper Unipile endpoint
4. 🟡 **Review Samantha Truman account** - 52% of errors from this single account
5. 🟢 **Sync Martin Schechtner** - Add missing database record

---

**Report Generated**: 2025-12-18 17:55 UTC
**System**: Production (app.meet-sam.com)
**Database**: latxadqrvrrrcvkktrog.supabase.co
