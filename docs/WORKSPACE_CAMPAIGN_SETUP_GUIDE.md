# Workspace Campaign Setup Guide

**Date:** October 7, 2025
**Status:** Production Ready

---

## 🏢 Overview

SAM AI uses a **workspace-based multi-tenant architecture** where campaigns are managed at the workspace level. This means:

- ✅ **Admins create campaigns** for the entire workspace
- ✅ **All workspace members** can use the same LinkedIn/email accounts
- ✅ **Campaigns are shared** across the team
- ✅ **Domain-based auto-joining** ensures teammates with the same email domain automatically join the same workspace

---

## 📋 Workspace Roles & Permissions

### **Admin Role** (Workspace Administrators)
- ✅ Create and manage campaigns
- ✅ Add/remove team members
- ✅ Connect LinkedIn and email accounts
- ✅ Configure workspace settings
- ✅ View all campaign analytics
- ✅ Execute campaigns for all prospects

### **Member Role** (Team Members)
- ✅ View campaigns
- ✅ View prospects
- ✅ View campaign analytics
- ❌ Cannot create new campaigns (admin only)
- ❌ Cannot connect new accounts (admin only)

---

## 🚀 How Admins Set Up Campaigns

### Step 1: Connect LinkedIn & Email Accounts

Admins should connect the company's LinkedIn and email accounts that will be used for **all workspace campaigns**:

1. **Navigate to Settings → Integrations**
2. **Connect LinkedIn Account** (via Unipile OAuth):
   - Click "Connect LinkedIn Account"
   - Authenticate with LinkedIn
   - Grant permissions to SAM AI
   - Account is now available for all workspace campaigns

3. **Connect Email Account** (Google/Microsoft OAuth):
   - Click "Connect Email Account"
   - Choose Google Workspace or Microsoft 365
   - Authenticate and grant permissions
   - Account is now available for all workspace campaigns

**Result:** All connected accounts are **workspace-scoped** and can be used by any workspace member in campaigns.

### Step 2: Create Prospects List

Admins can import prospects for the entire team:

1. **Navigate to Prospects**
2. **Import Prospects** via:
   - CSV upload
   - Manual entry
   - LinkedIn profile URLs
   - Sales Navigator lists

3. **Prospects are workspace-scoped** - all members can see them

### Step 3: Create Campaign

Admins create campaigns that use shared workspace accounts:

1. **Navigate to Campaigns → Create Campaign**
2. **Select Campaign Type**:
   - LinkedIn Connection Request + 4 Follow-ups
   - Email 5-Touch Sequence
   - Multi-Channel (LinkedIn + Email)

3. **Configure Campaign**:
   - **Campaign Name:** e.g., "Q4 2025 Outbound"
   - **Select LinkedIn Account:** Choose from workspace accounts
   - **Select Email Account:** Choose from workspace accounts
   - **Add Prospects:** Select from workspace prospects

4. **Write Messages**:
   - Connection Request message
   - Follow-up messages (FU1-4)
   - Goodbye message

5. **Set Timing**:
   - FU1: 2 days after connection
   - FU2: 5 days after FU1
   - FU3: 7 days after FU2
   - FU4: 5 days after FU3
   - GB: 7 days after FU4

6. **Launch Campaign** → Triggers N8N workflow

**Result:** Campaign runs automatically using workspace LinkedIn/email accounts.

---

## 👥 Domain-Based Workspace Joining

As of October 7, 2025, **automatic domain matching** is enabled:

### How It Works

1. **User signs up** with email: `john@acme.com`
2. **System checks** for existing workspaces with members using `@acme.com` domain
3. **If match found** → User automatically joins that workspace as a **member**
4. **If no match** → New workspace is created

### Excluded Domains

Free email providers are **excluded** from auto-matching:
- ❌ gmail.com
- ❌ yahoo.com
- ❌ hotmail.com
- ❌ outlook.com
- ❌ icloud.com
- ❌ aol.com
- ❌ protonmail.com

### Example Scenario

**Acme Corp Workspace:**
- Admin: `sarah@acme.com` (creates workspace)
- Team member 1: `john@acme.com` (signs up → auto-joins)
- Team member 2: `jane@acme.com` (signs up → auto-joins)
- All members see the same campaigns and prospects

---

## 🔧 Admin Configuration Tasks

### 1. Connect Company LinkedIn Accounts

```
Settings → Integrations → LinkedIn
→ Connect LinkedIn Account (via Unipile OAuth)
```

**Best Practices:**
- Use **company LinkedIn accounts** (not personal)
- Connect **multiple accounts** for higher volume (LinkedIn limits: 100 connections/week per account)
- Rotate accounts to avoid rate limits

### 2. Connect Company Email Accounts

```
Settings → Integrations → Email
→ Connect Google Workspace or Microsoft 365
```

**Best Practices:**
- Use **company email accounts** (e.g., `sales@company.com`)
- Connect **multiple sender accounts** for higher volume
- Configure **email domain authentication** (SPF, DKIM, DMARC)

### 3. Import Prospects

```
Prospects → Import Prospects
→ Upload CSV or add manually
```

**CSV Format:**
```csv
first_name,last_name,email,company_name,linkedin_url,title
John,Doe,john@example.com,Acme Corp,https://linkedin.com/in/johndoe,CEO
```

### 4. Create Campaign Templates

Admins can create **reusable message templates**:

```
Campaigns → Templates → Create Template
→ Save CR + 4FU + 1GB message sequences
```

---

## 📊 Campaign Execution Flow

```
1. Admin creates campaign
   ↓
2. Admin selects workspace LinkedIn/email account
   ↓
3. Admin adds prospects from workspace list
   ↓
4. Admin writes messages (or uses template)
   ↓
5. Admin launches campaign
   ↓
6. SAM AI triggers N8N Master Workflow
   ↓
7. N8N sends messages via Unipile API
   ↓
8. All workspace members can view campaign status
   ↓
9. SAM AI tracks responses and generates replies (HITL approval)
```

---

## 🔐 Security & Permissions

### Account Access

- **Connected accounts** (LinkedIn/email) are **workspace-scoped**
- **All workspace members** can view account status
- **Only admins** can connect/disconnect accounts
- **Credentials are encrypted** and stored securely via Unipile

### Campaign Access

- **All workspace members** can view campaigns
- **Only admins** can create/edit/launch campaigns
- **Campaign analytics** are visible to all members
- **Message history** is shared across workspace

### Data Isolation

- **Prospects are workspace-isolated** (RLS enforced)
- **Campaigns cannot access** prospects from other workspaces
- **Analytics are aggregated** per workspace
- **Billing is per workspace** (not per user)

---

## 📈 Scaling Campaigns

### Multiple LinkedIn Accounts

Connect **multiple LinkedIn accounts** to scale outreach:

- **Account 1:** 100 connections/week
- **Account 2:** 100 connections/week
- **Account 3:** 100 connections/week
- **Total:** 300 connections/week across workspace

### Campaign Rotation

Use **account rotation** to distribute load:

```typescript
Campaign 1: Use Account A (Days 1-7)
Campaign 2: Use Account B (Days 1-7)
Campaign 3: Use Account C (Days 1-7)
```

### Rate Limiting

SAM AI enforces LinkedIn limits automatically:
- **100 connection requests/week** per account
- **200 messages/day** per account
- **Weekends skipped** by default
- **Active hours only** (9am-5pm workspace timezone)

---

## 🎯 Admin Checklist

### Initial Setup

- [ ] **Connect LinkedIn accounts** (minimum 1, recommended 3+)
- [ ] **Connect email accounts** (minimum 1, recommended 2+)
- [ ] **Import initial prospect list** (100-1000 prospects)
- [ ] **Create message templates** (CR + 4FU + 1GB)
- [ ] **Test campaign** with 5-10 prospects

### Ongoing Management

- [ ] **Monitor campaign performance** (weekly)
- [ ] **Add new prospects** (weekly/monthly)
- [ ] **Review message effectiveness** (A/B test messages)
- [ ] **Manage team members** (add/remove as needed)
- [ ] **Check account health** (LinkedIn/email account status)

---

## 🆘 Troubleshooting

### Issue: New team member can't see campaigns

**Solution:** Verify:
1. User signed up with **company email domain**
2. User was added to correct workspace
3. User has **member or admin role**

### Issue: LinkedIn account disconnected

**Solution:**
1. Navigate to **Settings → Integrations**
2. Click **Reconnect LinkedIn**
3. Re-authenticate with LinkedIn
4. Account status should show **"Connected"**

### Issue: Campaign not sending messages

**Solution:** Check:
1. **Workflow is activated** in N8N UI
2. **LinkedIn account is connected** and active
3. **Unipile API credentials** are configured
4. **Prospects have valid LinkedIn URLs**

---

## 📚 Related Documentation

- **Architecture:** `/docs/N8N_MULTI_TENANT_WORKFLOW_ARCHITECTURE.md`
- **Integration Guide:** `/docs/N8N_WORKFLOW_INTEGRATION_GUIDE.md`
- **API Reference:** `/app/api/campaign/execute-n8n/route.ts`

---

**Last Updated:** October 7, 2025
**Status:** Production Ready
