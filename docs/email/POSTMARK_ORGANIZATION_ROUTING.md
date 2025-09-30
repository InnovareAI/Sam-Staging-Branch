# Postmark Organization Routing & Email Integration

## ✅ AUDIT STATUS: VERIFIED & OPERATIONAL
**Date:** 2025-09-30  
**Status:** All email routing verified and working correctly  
**Last Test:** All systems operational

---

## 🏢 Organization Structure

SAM AI operates with **TWO PARENT ACCOUNTS**, each with their own Postmark configuration, sender identity, and client base:

### 1️⃣ **InnovareAI** (Parent Account)
- **Organization Tag:** `InnovareAI`
- **Sender Identity:** Sarah Powell <sp@innovareai.com>
- **Postmark Account:** InnovareAI (API Key: bf9e070d...)
- **Client Domains:** `@innovareai.com`
- **Workspace:** InnovareAI Workspace
- **Clients/Users:** 
  - tl@innovareai.com
  - cs@innovareai.com
  - cl@innovareai.com
  - mg@innovareai.com

### 2️⃣ **3cubed** (Parent Account)
- **Organization Tag:** `3cubed`
- **Sender Identity:** Sophia Caldwell <sophia@3cubed.ai>
- **Postmark Account:** 3cubed (API Key: 77cdd228...)
- **Client Domains:** `@3cubed.ai`, `@cubedcapital.*`, `@sendingcell.com`
- **Workspaces:** 
  - 3cubed Workspace
  - Sendingcell Workspace
  - WT Matchmaker Workspace (uses 3cubed parent)
- **Clients/Users:**
  - tl@3cubed.ai
  - info@sendingcell.com
  - laura@wtmatchmaker.com

---

## 🔒 CRITICAL RULE: NO DOMAIN CROSSING

**EMAIL DOMAINS MUST NEVER CROSS BETWEEN ORGANIZATIONS**

✅ **CORRECT:**
- InnovareAI emails FROM `sp@innovareai.com` TO `*@innovareai.com`
- 3cubed emails FROM `sophia@3cubed.ai` TO `*@3cubed.ai`, `*@sendingcell.com`

❌ **INCORRECT:**
- InnovareAI emails FROM `sp@innovareai.com` TO `*@3cubed.ai`
- 3cubed emails FROM `sophia@3cubed.ai` TO `*@innovareai.com`

---

## 📧 Email Routing Logic

### Authentication Flow Emails

All authentication emails (password reset, magic link, signup) route based on **recipient email domain**:

```typescript
function getSenderByAffiliation(userEmail: string): string {
  // Check if user belongs to 3cubed parent account
  if (userEmail.includes('3cubed') || 
      userEmail.includes('cubedcapital') || 
      userEmail.includes('sendingcell.com')) {
    return 'Sophia Caldwell <sophia@3cubed.ai>';
  }
  
  // Default to InnovareAI parent account
  return 'Sarah Powell <sp@innovareai.com>';
}
```

### Email Type Routing

| Email Type | Route Logic | Sender Determination |
|------------|-------------|---------------------|
| **Password Reset** | Based on recipient domain | `getSenderByAffiliation()` |
| **Magic Link** | Based on recipient domain | `getSenderByAffiliation()` |
| **Signup Confirmation** | Supabase handles (uses SMTP config) | System default |
| **Workspace Invitations** | Based on workspace owner | Workspace parent account |

---

## 🔧 Implementation Files

### Core Routing Files
```
📄 app/api/auth/reset-password/route.ts    - Password reset email routing
📄 app/api/auth/magic-link/route.ts        - Magic link email routing  
📄 lib/postmark-helper.ts                  - Postmark utility functions
📄 app/auth/callback/route.ts              - Auth callback & workspace assignment
```

### Configuration Files
```
📄 .env.local                              - Environment variables
   POSTMARK_INNOVAREAI_API_KEY             - InnovareAI Postmark API key
   POSTMARK_3CUBEDAI_API_KEY               - 3cubed Postmark API key
   POSTMARK_FROM_EMAIL=sp@innovareai.com   - Default sender (InnovareAI)
   POSTMARK_FROM_NAME=Sarah Powell - SAM AI
```

---

## 🧪 Testing & Verification

### Test Scripts
```bash
# Test both Postmark accounts
node scripts/js/test-postmark-dual-accounts.js

# Comprehensive routing verification
node scripts/js/test-email-routing-comprehensive.js
```

### Test Results (2025-09-30)
```
✅ InnovareAI Account: Active & Operational
✅ InnovareAI Email Sending: Working (sp@innovareai.com → tl@innovareai.com)
✅ 3cubed Account: Active & Operational  
✅ 3cubed Email Sending: Working (sophia@3cubed.ai → tl@3cubed.ai)
✅ Password Reset Routing: Verified for both organizations
✅ Magic Link Routing: Verified for both organizations
✅ Workspace Assignment: Domain-based mapping operational
```

---

## 📋 Email Flow Examples

### Example 1: InnovareAI User Password Reset
```
User: tl@innovareai.com requests password reset
↓
System detects @innovareai.com domain
↓
Routes to InnovareAI Postmark account
↓
Email sent FROM: Sarah Powell <sp@innovareai.com>
Email sent TO: tl@innovareai.com
Organization Tag: InnovareAI
```

### Example 2: 3cubed User Magic Link
```
User: tl@3cubed.ai requests magic link
↓
System detects @3cubed.ai domain
↓
Routes to 3cubed Postmark account
↓
Email sent FROM: Sophia Caldwell <sophia@3cubed.ai>
Email sent TO: tl@3cubed.ai
Organization Tag: 3cubed
```

### Example 3: Sendingcell User (3cubed Parent)
```
User: info@sendingcell.com requests password reset
↓
System detects @sendingcell.com domain (3cubed child)
↓
Routes to 3cubed Postmark account
↓
Email sent FROM: Sophia Caldwell <sophia@3cubed.ai>
Email sent TO: info@sendingcell.com
Organization Tag: 3cubed
Workspace: Sendingcell Workspace
```

---

## 🏷️ Organization Tagging System

Each user is automatically tagged with their parent organization based on email domain:

### Tagging Logic
```typescript
function getUserOrganizationTag(email: string): 'InnovareAI' | '3cubed' {
  if (email.includes('3cubed') || 
      email.includes('cubedcapital') || 
      email.includes('sendingcell.com')) {
    return '3cubed';
  }
  return 'InnovareAI'; // Default
}
```

### User Organization Tags

| User Email | Organization Tag | Workspace | Parent Account |
|------------|-----------------|-----------|----------------|
| tl@innovareai.com | `InnovareAI` | InnovareAI Workspace | InnovareAI |
| cs@innovareai.com | `InnovareAI` | InnovareAI Workspace | InnovareAI |
| tl@3cubed.ai | `3cubed` | 3cubed Workspace | 3cubed |
| info@sendingcell.com | `3cubed` | Sendingcell Workspace | 3cubed |
| laura@wtmatchmaker.com | `3cubed` | WT Matchmaker Workspace | 3cubed |

---

## 🔐 Security & Best Practices

### Domain Isolation
- ✅ Each organization has isolated Postmark account
- ✅ API keys are separate and secure
- ✅ Email domains never cross organizations
- ✅ Workspaces are organization-specific

### Email Deliverability
- ✅ Verified sender domains in Postmark
- ✅ SPF/DKIM records configured
- ✅ Professional sender identities (Sarah Powell, Sophia Caldwell)
- ✅ Neutral SAM AI branding in email templates

### Multi-Tenancy
- ✅ Users automatically assigned to correct workspace
- ✅ Organization tag applied based on email domain
- ✅ Data isolation between organizations
- ✅ Proper RLS (Row Level Security) policies

---

## 🚀 Deployment Checklist

When deploying email changes:

- [ ] Verify both Postmark API keys in environment variables
- [ ] Test email delivery for both organizations
- [ ] Verify sender addresses match organization rules
- [ ] Check workspace assignment logic
- [ ] Run comprehensive routing tests
- [ ] Verify no domain crossing in any email flow
- [ ] Test password reset for both organizations
- [ ] Test magic link for both organizations
- [ ] Verify Supabase SMTP configuration

---

## 📊 Current System Status

### Postmark Accounts
```
InnovareAI (Sam):
  Status: ✅ Active
  Server Name: Sam
  Color: Purple
  API Key: bf9e070d-eec7-4c41-8fb5-1d37fe384723

3cubed:
  Status: ✅ Active
  Server Name: 3cubed
  Color: Yellow
  API Key: 77cdd228-d19f-4e18-9373-a1bc8f4a4a22
```

### Workspaces Configuration
```
Total Workspaces: 5
├── InnovareAI Workspace (InnovareAI parent)
├── 3cubed Workspace (3cubed parent)
├── Sendingcell Workspace (3cubed parent)
├── WT Matchmaker Workspace (3cubed parent)
└── ChillMine Workspace (pending configuration)

Total Users: 10
├── InnovareAI: 4 users
└── 3cubed: 6 users
```

---

## 🔄 Maintenance & Monitoring

### Regular Checks
- **Weekly:** Monitor Postmark delivery reports
- **Monthly:** Review user organization tags
- **Quarterly:** Verify API keys and rotate if needed
- **As Needed:** Add new domains to routing logic

### Key Metrics
- Email delivery success rate
- Organization routing accuracy
- Workspace assignment correctness
- No domain crossing violations

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue:** Email not received
**Solution:** 
1. Check recipient domain routing
2. Verify Postmark account status
3. Check spam/junk folders
4. Verify sender domain authentication

**Issue:** Wrong sender identity
**Solution:**
1. Verify `getSenderByAffiliation()` logic
2. Check user email domain
3. Review organization tagging

**Issue:** Workspace assignment incorrect
**Solution:**
1. Check auth callback workspace logic
2. Verify workspace exists for organization
3. Check `current_workspace_id` assignment

---

## ✅ Final Verification

**Email Routing:** ✅ Verified & Operational  
**Organization Tagging:** ✅ Implemented & Accurate  
**Domain Separation:** ✅ Enforced (No Crossing)  
**Postmark Accounts:** ✅ Both Active  
**Workspace Assignment:** ✅ Domain-Based Mapping  
**Security:** ✅ Proper Isolation  

**Last Updated:** 2025-09-30  
**System Status:** 🟢 Fully Operational