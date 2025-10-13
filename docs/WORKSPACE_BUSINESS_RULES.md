# Workspace Business Rules

## Overview
This document defines the business logic for workspace creation, naming, and tagging in the SAM AI platform.

---

## 1. Workspace Creation & Naming

### Rule: Workspace Name Based on Email Domain

**For Corporate Emails (non-public domains):**
- Signup email: `user@sendingcell.com`
- Workspace name: `"Sendingcell"` (extracted from email domain)
- Tenant tag: `'sendingcell'`

**For Public Emails (gmail, icloud, yahoo, etc.):**
- Signup email: `john.doe@gmail.com`
- Workspace name: `"John Doe"` (first name + last name)
- Tenant tag: `'gmail'` or special handling

**Public Email Domains (partial list):**
- gmail.com
- yahoo.com
- icloud.com
- outlook.com
- hotmail.com
- protonmail.com
- aol.com

---

## 2. Tenant Field

**Purpose:** Identifies the email domain for the workspace

**Value:** Lowercase domain prefix

**Examples:**
| Email | Tenant Value |
|-------|--------------|
| `user@sendingcell.com` | `'sendingcell'` |
| `admin@innovareai.com` | `'innovareai'` |
| `contact@truepeopleconsulting.com` | `'truepeople'` |
| `laura@wtmatchmaker.com` | `'wtmatchmaker'` |
| `stan@signali.ai` | `'bluelabel'` |

**Database Constraint:**
```sql
CHECK (tenant IN ('innovareai', '3cubed', 'sendingcell', 'truepeople', 'wtmatchmaker', 'bluelabel', ...))
```

---

## 3. Reseller Affiliation Field

**Purpose:** Tracks how the workspace was created (signup method)

**Values:**

### `'3cubed'` - Invite-Only System
- Created by super admin via dashboard
- Manual workspace creation
- Typically for enterprise clients
- Examples: Sendingcell, True People Consulting, WT Matchmaker, 3cubed Workspace

### `'innovareai'` - Stripe Self-Service
- User signs up directly via website
- Automated Stripe payment flow
- Self-service onboarding
- Examples: InnovareAI Workspace, Blue Label Labs

### `'direct'` - Reserved
- Future use case
- TBD

**Database Constraint:**
```sql
CHECK (reseller_affiliation IN ('3cubed', 'innovareai', 'direct'))
```

---

## 4. Current Workspace Configuration

| Workspace Name | Email Domain | Tenant | Reseller Affiliation | Signup Method |
|----------------|--------------|--------|---------------------|---------------|
| 3cubed Workspace | @3cubed.ai | `'3cubed'` | `'3cubed'` | Super admin invite |
| Sendingcell Workspace | @sendingcell.com | `'sendingcell'` | `'3cubed'` | Super admin invite |
| True People Consulting | @truepeopleconsulting.com | `'truepeople'` | `'3cubed'` | Super admin invite |
| WT Matchmaker Workspace | @wtmatchmaker.com | `'wtmatchmaker'` | `'3cubed'` | Super admin invite |
| InnovareAI Workspace | @innovareai.com | `'innovareai'` | `'innovareai'` | Stripe self-service |
| Blue Label Labs | @signali.ai | `'bluelabel'` | `'innovareai'` | Stripe self-service |

---

## 5. Email Branding Impact

**The `tenant` field determines email template/branding:**
- When sending campaign emails, the system uses tenant-specific templates
- Each tenant can have custom:
  - From address
  - Email footer
  - Branding colors
  - Logo
  - Legal disclaimers

---

## 6. Implementation Notes

### Signup Flow (Stripe - InnovareAI)
```typescript
// 1. User enters email: user@company.com
// 2. Check if public email domain
const isPublicEmail = checkPublicDomain(email)

// 3. Generate workspace name
const workspaceName = isPublicEmail
  ? `${firstName} ${lastName}`  // "John Doe"
  : capitalizeCompanyName(emailDomain)  // "Company"

// 4. Set tenant tag
const tenant = extractDomain(email)  // "company"

// 5. Set reseller affiliation
const resellerAffiliation = 'innovareai'  // Stripe signup

// 6. Create workspace
await createWorkspace({
  name: workspaceName,
  tenant: tenant,
  reseller_affiliation: resellerAffiliation
})
```

### Super Admin Creation (3cubed)
```typescript
// 1. Admin enters workspace details manually
// 2. Set tenant based on primary email domain
const tenant = adminSelectedDomain  // e.g., 'sendingcell'

// 3. Set reseller affiliation
const resellerAffiliation = '3cubed'

// 4. Create workspace
await createWorkspace({
  name: workspaceName,  // Admin-provided
  tenant: tenant,
  reseller_affiliation: resellerAffiliation
})
```

---

## 7. Migration Path

To implement these rules, two migrations are required:

1. **Expand Tenant Constraints** - Allow all email domains as tenant values
2. **Add Reseller Affiliation** - Track signup method for billing/support

**Files:**
- `supabase/migrations/20251013000001_expand_tenant_constraints.sql`
- `supabase/migrations/20251013000002_add_reseller_affiliation.sql`
