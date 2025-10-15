# ⚠️ CRITICAL: TENANT ISOLATION - IMMUTABLE REQUIREMENT

**LAST UPDATED:** October 15, 2025

## 🚨 ABSOLUTE RULE - NEVER VIOLATE

**Users can ONLY access their OWN LinkedIn accounts. NEVER share accounts between users.**

### Why This Cannot Be Changed:

1. **LinkedIn TOS Violation** - Account sharing violates LinkedIn Terms of Service
2. **Legal Risk** - Could result in criminal liability
3. **Security Breach** - Cross-tenant data access is a critical security vulnerability
4. **Client Trust** - Each client has their own code/accounts - mixing them destroys trust

## 🔒 Enforcement Rules

### Code Level - MANDATORY Filter

**EVERY query to `workspace_accounts` MUST include user_id filter:**

```typescript
// ✅ CORRECT - ALWAYS use this pattern
const { data } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('user_id', user.id) // ⚠️ CRITICAL: NEVER REMOVE THIS LINE
  .eq('account_type', 'linkedin')

// ❌ WRONG - NEVER do this
const { data } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', workspaceId) // Missing user_id filter
  .eq('account_type', 'linkedin')
```

### Affected Endpoints (All Protected):

- ✅ `/api/linkedin/search/simple/route.ts`
- ✅ `/api/linkedin/search/route.ts`
- ✅ `/api/linkedin/search/direct/route.ts`
- ✅ `/api/linkedin/search/create-job/route.ts`
- ✅ All other LinkedIn endpoints

### Verification Command:

```bash
# Run this to verify ALL endpoints have user_id filter
grep -r "from('workspace_accounts')" app/api/linkedin --include="*.ts" -A 5 | grep -v "user_id"
# Should return NO results
```

## 🧪 Test Requirements

**Before any deployment that touches LinkedIn account access:**

1. Run tenant isolation test
2. Verify no cross-user account access possible
3. Confirm user can only see their own accounts

## 📋 Code Review Checklist

When reviewing ANY code that accesses `workspace_accounts`:

- [ ] Does the query include `.eq('user_id', user.id)`?
- [ ] Is there NO way to bypass the user_id filter?
- [ ] Are there NO shared account scenarios?
- [ ] Does the error message tell users to connect THEIR OWN account?

## ⛔ VIOLATIONS

**If you see code that violates this:**

1. **STOP immediately**
2. **DO NOT deploy**
3. **Flag as critical security issue**
4. **Fix before ANY other work**

## 🔐 Database Safeguards

The `workspace_accounts` table enforces:
- Each account linked to specific user_id
- RLS policies check auth.uid()
- No shared account columns exist

## 📞 Emergency Protocol

If tenant isolation is breached:

1. **Immediately rollback deployment**
2. **Audit all affected accounts**
3. **Notify affected clients**
4. **Fix and verify before re-deploy**

---

**THIS REQUIREMENT IS PERMANENT AND CANNOT BE CHANGED UNDER ANY CIRCUMSTANCES.**
