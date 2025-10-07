# SECURITY FIXES - IMPLEMENTATION GUIDE
**Date**: 2025-10-08
**Priority**: 🔴 CRITICAL - Implement This Week

---

## QUICK FIX TEMPLATES

### 1. Add Authentication to Unprotected Routes

**File**: `/lib/security/route-auth.ts` (CREATE THIS)

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export interface AuthenticatedUser {
  id: string;
  email: string;
  current_workspace_id: string;
}

export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedUser | Response> {
  const supabase = createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get user's current workspace
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single();

  if (userError || !userData?.current_workspace_id) {
    return new Response(
      JSON.stringify({ error: 'No workspace access' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return {
    id: user.id,
    email: user.email!,
    current_workspace_id: userData.current_workspace_id,
  };
}

export async function requireWorkspaceAccess(
  request: NextRequest,
  workspaceId: string
): Promise<AuthenticatedUser | Response> {
  const authResult = await requireAuth(request);

  if (authResult instanceof Response) {
    return authResult; // Return error response
  }

  const supabase = createClient();

  // Verify workspace membership
  const { data: member, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', authResult.id)
    .single();

  if (error || !member) {
    return new Response(
      JSON.stringify({ error: 'Forbidden - No workspace access' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return authResult;
}
```

### 2. Apply to SAM AI Routes

**Example: `/app/api/sam/knowledge/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/security/route-auth';

export async function GET(request: NextRequest) {
  // ✅ ADD THIS - Authentication check
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult; // Return 401/403 error
  }

  const user = authResult; // Typed AuthenticatedUser

  // Now safe to access knowledge base
  // Filter by user's workspace
  const knowledgeItems = await getKnowledgeForWorkspace(
    user.current_workspace_id
  );

  return NextResponse.json(knowledgeItems);
}
```

**Apply to these files**:
- `/app/api/sam/knowledge/route.ts`
- `/app/api/sam/mcp-tools/route.ts`
- `/app/api/sam/openrouter/route.ts`
- `/app/api/sam/personalization/route.ts`
- `/app/api/sam/process-user-template/route.ts`
- `/app/api/sam/icp-configurations/route.ts`
- `/app/api/sam/data-sources/route.ts`

---

### 3. Webhook Signature Validation

**File**: `/lib/security/webhook-validation.ts` (CREATE THIS)

```typescript
import crypto from 'crypto';

export interface WebhookValidationResult {
  valid: boolean;
  payload?: any;
  error?: string;
}

/**
 * Validates N8N webhook signature
 * Prevents webhook spoofing attacks
 */
export async function validateN8NWebhook(
  request: Request
): Promise<WebhookValidationResult> {
  const signature = request.headers.get('x-n8n-signature');

  if (!signature) {
    return {
      valid: false,
      error: 'Missing webhook signature',
    };
  }

  const rawBody = await request.text();
  const secret = process.env.N8N_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('N8N_WEBHOOK_SECRET not configured');
  }

  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const signatureValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );

  if (!signatureValid) {
    return {
      valid: false,
      error: 'Invalid webhook signature',
    };
  }

  return {
    valid: true,
    payload: JSON.parse(rawBody),
  };
}

/**
 * Validates Unipile webhook signature
 */
export async function validateUnipileWebhook(
  request: Request
): Promise<WebhookValidationResult> {
  // Unipile uses similar HMAC-SHA256 approach
  const signature = request.headers.get('x-unipile-signature');

  if (!signature) {
    return {
      valid: false,
      error: 'Missing Unipile webhook signature',
    };
  }

  const rawBody = await request.text();
  const secret = process.env.UNIPILE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('UNIPILE_WEBHOOK_SECRET not configured');
  }

  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const signatureValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );

  if (!signatureValid) {
    return {
      valid: false,
      error: 'Invalid Unipile webhook signature',
    };
  }

  return {
    valid: true,
    payload: JSON.parse(rawBody),
  };
}
```

**Apply to webhook routes**:

```typescript
// /app/api/webhooks/n8n/linkedin-responses/route.ts

import { validateN8NWebhook } from '@/lib/security/webhook-validation';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  // ✅ VALIDATE SIGNATURE FIRST
  const validation = await validateN8NWebhook(request);

  if (!validation.valid) {
    console.error('❌ Invalid webhook signature:', validation.error);
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const payload = validation.payload;

  // Now safe to use service_role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Process webhook...
}
```

**Apply to these files**:
- `/app/api/webhooks/n8n/linkedin-responses/route.ts`
- `/app/api/webhooks/n8n/email-responses/route.ts`
- `/app/api/webhooks/n8n/campaign-status/route.ts`
- `/app/api/webhooks/sam-funnel/status-update/route.ts`

**Update `.env.local` and `.env.example`**:
```bash
# Add these secrets:
N8N_WEBHOOK_SECRET=your-random-secret-here
UNIPILE_WEBHOOK_SECRET=your-random-secret-here
```

---

### 4. Add Workspace Checks to Prospect Routes

**Example: `/app/api/prospect-approval/prospects/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceAccess } from '@/lib/security/route-auth';

export async function GET(request: NextRequest) {
  // Get workspaceId from query params
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspace_id');

  if (!workspaceId) {
    return new Response(
      JSON.stringify({ error: 'workspace_id required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ✅ VALIDATE WORKSPACE ACCESS
  const authResult = await requireWorkspaceAccess(request, workspaceId);
  if (authResult instanceof Response) {
    return authResult; // Return 401/403 error
  }

  const user = authResult;

  // Now safe to query prospects
  const supabase = createClient();
  const { data: prospects, error } = await supabase
    .from('workspace_prospects')
    .select('*')
    .eq('workspace_id', workspaceId); // ✅ Explicit filter

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prospects });
}
```

**Apply to these files**:
- `/app/api/prospect-approval/prospects/route.ts`
- `/app/api/prospect-approval/setup/route.ts`
- `/app/api/prospect-approval/decisions/route.ts`
- `/app/api/sam/approved-prospects/route.ts`
- `/app/api/sam/prospect-intelligence/route.ts`

---

### 5. Remove Test Routes from Production

**Option A: Delete files completely**

```bash
# Run this in terminal (AFTER BACKING UP):
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

# Move to archive
mkdir -p archive/test-routes-removed-2025-10-08
mv app/api/test-bulk-upload archive/test-routes-removed-2025-10-08/
mv app/api/test-sam archive/test-routes-removed-2025-10-08/
mv app/api/test archive/test-routes-removed-2025-10-08/
mv app/api/test-simple archive/test-routes-removed-2025-10-08/
mv app/api/test-email archive/test-routes-removed-2025-10-08/
mv app/api/test-integration archive/test-routes-removed-2025-10-08/
mv app/api/test-company-emails archive/test-routes-removed-2025-10-08/
```

**Option B: Add environment check**

```typescript
// Add to beginning of each test route:
export async function GET(request: NextRequest) {
  // ✅ DISABLE IN PRODUCTION
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  // Test logic only runs in development
  // ...
}
```

---

### 6. Add IP Whitelist to Admin Routes

**File**: `/lib/security/ip-validation.ts` (CREATE THIS)

```typescript
import { NextRequest } from 'next/server';

// Add your office/VPN IPs here
const ALLOWED_ADMIN_IPS = [
  '127.0.0.1',           // Localhost
  '::1',                 // IPv6 localhost
  // Add your real IPs:
  // '203.0.113.0/24',   // Office network CIDR
  // '198.51.100.5',     // VPN endpoint
];

export function isIPAllowed(request: NextRequest): boolean {
  // In development, allow all IPs
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const clientIP =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.ip ||
    '127.0.0.1';

  console.log('🔍 Admin access attempt from IP:', clientIP);

  // Check if IP is in whitelist
  const allowed = ALLOWED_ADMIN_IPS.some(allowedIP => {
    // Simple IP match
    if (allowedIP === clientIP) return true;

    // CIDR range check (basic implementation)
    if (allowedIP.includes('/')) {
      // For production, use a library like 'ipaddr.js' or 'ip-range-check'
      console.warn('⚠️ CIDR matching not implemented, use ipaddr.js');
      return false;
    }

    return false;
  });

  if (!allowed) {
    console.error('🚫 Admin access denied for IP:', clientIP);
  }

  return allowed;
}
```

**Apply to admin routes**:

```typescript
// /app/api/admin/list-all-workspaces/route.ts

import { isIPAllowed } from '@/lib/security/ip-validation';

export async function GET(request: NextRequest) {
  // ✅ CHECK IP WHITELIST
  if (!isIPAllowed(request)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden - IP not whitelisted' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Admin logic...
}
```

**Apply to these files**:
- `/app/api/admin/list-all-workspaces/route.ts`
- `/app/api/admin/check-workspace-accounts/route.ts`
- `/app/api/admin/test-tenant-isolation/route.ts`
- `/app/api/admin/all-unipile-accounts/route.ts`
- `/app/api/debug/*` (all debug routes)

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] Review security audit report
- [ ] Create security fix branch: `git checkout -b security/critical-fixes-2025-10-08`
- [ ] Back up current production database
- [ ] Test all changes in staging environment

### Implementation Order

**Day 1: Authentication**
- [ ] Create `/lib/security/route-auth.ts`
- [ ] Apply `requireAuth()` to SAM AI routes
- [ ] Test SAM conversations still work

**Day 2: Webhooks**
- [ ] Add webhook secrets to environment variables
- [ ] Create `/lib/security/webhook-validation.ts`
- [ ] Apply signature validation to webhook routes
- [ ] Configure N8N to send signatures

**Day 3: Workspace Isolation**
- [ ] Apply `requireWorkspaceAccess()` to prospect routes
- [ ] Test multi-tenant isolation
- [ ] Verify RLS still enforces policies

**Day 4: Cleanup**
- [ ] Remove or protect test routes
- [ ] Create `/lib/security/ip-validation.ts`
- [ ] Apply IP whitelist to admin routes
- [ ] Test admin access from allowed IPs

**Day 5: Verification**
- [ ] Run security audit script again
- [ ] Verify all critical routes protected
- [ ] Load test with security scenarios
- [ ] Deploy to production

### Post-Deployment

- [ ] Monitor audit logs for 24 hours
- [ ] Check for unauthorized access attempts
- [ ] Verify no legitimate users blocked
- [ ] Document changes in CHANGELOG.md

---

## TESTING COMMANDS

### Test Authentication

```bash
# Should return 401 without auth
curl https://app.meet-sam.com/api/sam/knowledge

# Should work with auth token
curl https://app.meet-sam.com/api/sam/knowledge \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN"
```

### Test Webhook Validation

```bash
# Should return 401 without signature
curl -X POST https://app.meet-sam.com/api/webhooks/n8n/linkedin-responses \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Should work with valid signature
curl -X POST https://app.meet-sam.com/api/webhooks/n8n/linkedin-responses \
  -H "Content-Type: application/json" \
  -H "X-N8N-Signature: valid-signature" \
  -d '{"test": "data"}'
```

### Test IP Whitelist

```bash
# Should return 403 from non-whitelisted IP
curl https://app.meet-sam.com/api/admin/list-all-workspaces

# Should work from whitelisted IP (via VPN)
# Connect to VPN first, then:
curl https://app.meet-sam.com/api/admin/list-all-workspaces
```

---

## ROLLBACK PLAN

If issues occur after deployment:

```bash
# 1. Revert to previous deployment
git revert HEAD
git push origin main

# 2. Or disable security checks temporarily
# Add to .env.production:
DISABLE_SECURITY_CHECKS=true

# 3. In route-auth.ts:
export async function requireAuth(request: NextRequest) {
  if (process.env.DISABLE_SECURITY_CHECKS === 'true') {
    console.warn('⚠️ SECURITY CHECKS DISABLED');
    return { id: 'bypass', email: 'bypass', current_workspace_id: 'bypass' };
  }
  // Normal auth logic...
}
```

**NEVER leave `DISABLE_SECURITY_CHECKS=true` in production!**

---

## MONITORING QUERIES

### After deployment, run these to verify security:

```sql
-- Check for unauthorized access attempts
SELECT
  event_type,
  COUNT(*) as attempts,
  COUNT(DISTINCT ip_address) as unique_ips,
  MAX(created_at) as last_attempt
FROM tenant_isolation_audit
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND event_type = 'unauthorized_access'
GROUP BY event_type;

-- Check webhook validation failures
SELECT
  details->>'route' as webhook_route,
  COUNT(*) as failures,
  ARRAY_AGG(DISTINCT ip_address) as source_ips
FROM tenant_isolation_audit
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND event_type = 'invalid_webhook'
GROUP BY webhook_route;

-- Verify no data leakage
SELECT * FROM check_tenant_data_leakage();
```

---

## ENVIRONMENT VARIABLES NEEDED

Add to `.env.local`, `.env.production`:

```bash
# Webhook Security
N8N_WEBHOOK_SECRET=your-random-secret-min-32-chars
UNIPILE_WEBHOOK_SECRET=your-random-secret-min-32-chars

# Admin IP Whitelist (production only)
ADMIN_ALLOWED_IPS=203.0.113.5,198.51.100.10

# Security Toggle (NEVER use in production)
# DISABLE_SECURITY_CHECKS=false
```

Generate secrets:
```bash
# macOS/Linux
openssl rand -hex 32

# Or Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## SUCCESS METRICS

After implementing fixes:

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Unprotected Routes | 69 (24.6%) | ? | 0 (0%) |
| Routes Missing Workspace Check | 76 | ? | 0 |
| Webhook Validation | 0% | ? | 100% |
| Admin IP Protection | 0% | ? | 100% |
| Test Routes in Prod | 7 | ? | 0 |

---

**Implementation Guide Generated**: 2025-10-08
**Estimated Time**: 4-5 days (1 developer)
**Priority**: 🔴 CRITICAL
