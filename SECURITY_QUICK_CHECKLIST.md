# SECURITY QUICK CHECKLIST
**Date**: 2025-10-08
**Use**: Print this and check off items as you implement fixes

---

## ✅ CRITICAL FIXES (This Week)

### Day 1: SAM AI Route Authentication

- [ ] Create `/lib/security/route-auth.ts`
  - [ ] `requireAuth()` function
  - [ ] `requireWorkspaceAccess()` function
  - [ ] TypeScript interfaces

- [ ] Apply auth to SAM routes:
  - [ ] `/api/sam/knowledge/route.ts`
  - [ ] `/api/sam/mcp-tools/route.ts`
  - [ ] `/api/sam/openrouter/route.ts`
  - [ ] `/api/sam/personalization/route.ts`
  - [ ] `/api/sam/process-user-template/route.ts`
  - [ ] `/api/sam/icp-configurations/route.ts`
  - [ ] `/api/sam/data-sources/route.ts`

- [ ] Test in staging:
  - [ ] Without auth returns 401
  - [ ] With auth works correctly
  - [ ] SAM conversations still functional

---

### Day 2: Webhook Signature Validation

- [ ] Add environment variables:
  - [ ] `N8N_WEBHOOK_SECRET` in .env.local
  - [ ] `N8N_WEBHOOK_SECRET` in .env.production
  - [ ] `UNIPILE_WEBHOOK_SECRET` in .env.local
  - [ ] `UNIPILE_WEBHOOK_SECRET` in .env.production

- [ ] Create `/lib/security/webhook-validation.ts`
  - [ ] `validateN8NWebhook()` function
  - [ ] `validateUnipileWebhook()` function
  - [ ] Error handling

- [ ] Apply validation to webhooks:
  - [ ] `/api/webhooks/n8n/linkedin-responses/route.ts`
  - [ ] `/api/webhooks/n8n/email-responses/route.ts`
  - [ ] `/api/webhooks/n8n/campaign-status/route.ts`
  - [ ] `/api/webhooks/sam-funnel/status-update/route.ts`

- [ ] Configure N8N to send signatures
  - [ ] Update N8N webhook nodes
  - [ ] Add signature header
  - [ ] Test webhook delivery

- [ ] Test in staging:
  - [ ] Without signature returns 401
  - [ ] With invalid signature returns 401
  - [ ] With valid signature works

---

### Day 3: Workspace Isolation

- [ ] Add workspace checks to prospect routes:
  - [ ] `/api/prospect-approval/prospects/route.ts`
  - [ ] `/api/prospect-approval/setup/route.ts`
  - [ ] `/api/prospect-approval/decisions/route.ts`
  - [ ] `/api/sam/approved-prospects/route.ts`
  - [ ] `/api/sam/prospect-intelligence/route.ts`

- [ ] Pattern for each route:
  - [ ] Get `workspace_id` from params
  - [ ] Call `requireWorkspaceAccess()`
  - [ ] Add explicit `.eq('workspace_id', workspaceId)`

- [ ] Test in staging:
  - [ ] User A can't access User B's workspace
  - [ ] Cross-tenant queries fail
  - [ ] Same-tenant queries work

---

### Day 4: Test Route Cleanup

- [ ] Move test routes to archive:
  - [ ] `/api/test-bulk-upload`
  - [ ] `/api/test-sam`
  - [ ] `/api/test/google-search`
  - [ ] `/api/test-simple`
  - [ ] `/api/test-email`
  - [ ] `/api/test-integration`
  - [ ] `/api/test-company-emails`

- [ ] OR add environment check:
  - [ ] Check `process.env.NODE_ENV`
  - [ ] Return 404 in production
  - [ ] Document decision

- [ ] Verify in production:
  - [ ] Test routes return 404
  - [ ] No references in frontend
  - [ ] No broken links

---

### Day 5: Verification + Deployment

- [ ] Run security audit again:
  - [ ] Check unprotected routes count
  - [ ] Verify webhook validation
  - [ ] Test workspace isolation

- [ ] Code review:
  - [ ] All changes reviewed
  - [ ] No hardcoded secrets
  - [ ] TypeScript types correct

- [ ] Staging deployment:
  - [ ] Deploy to staging
  - [ ] Run integration tests
  - [ ] Check audit logs

- [ ] Production deployment:
  - [ ] Backup database
  - [ ] Deploy to production
  - [ ] Monitor for 1 hour
  - [ ] Verify no errors

---

## ⚠️ HIGH PRIORITY (Week 2)

### Admin Route Protection

- [ ] Create `/lib/security/ip-validation.ts`
  - [ ] Define `ALLOWED_ADMIN_IPS`
  - [ ] `isIPAllowed()` function
  - [ ] CIDR range support

- [ ] Apply IP check to admin routes:
  - [ ] `/api/admin/list-all-workspaces`
  - [ ] `/api/admin/check-workspace-accounts`
  - [ ] `/api/admin/test-tenant-isolation`
  - [ ] `/api/admin/all-unipile-accounts`
  - [ ] All `/api/debug/*` routes

- [ ] Test:
  - [ ] Access from office IP works
  - [ ] Access from random IP fails
  - [ ] VPN access works

---

### Rate Limiting

- [ ] Install Upstash:
  - [ ] `npm install @upstash/ratelimit @upstash/redis`
  - [ ] Create Upstash account
  - [ ] Get Redis credentials

- [ ] Add environment variables:
  - [ ] `UPSTASH_REDIS_REST_URL`
  - [ ] `UPSTASH_REDIS_REST_TOKEN`

- [ ] Create rate limit middleware
- [ ] Apply to public endpoints
- [ ] Test rate limits work

---

### Security Monitoring

- [ ] Create security dashboard:
  - [ ] Query `tenant_isolation_audit`
  - [ ] Show unauthorized attempts
  - [ ] Chart over time

- [ ] Set up alerts:
  - [ ] Email on > 10 auth failures
  - [ ] Slack notification on breach
  - [ ] Log aggregation

- [ ] Document queries:
  - [ ] Daily security check
  - [ ] Weekly report
  - [ ] Monthly audit

---

## 📊 VERIFICATION QUERIES

### Check Unprotected Routes

```bash
# Run in terminal
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
for file in $(find app/api -name "route.ts"); do
  if ! grep -q "auth\|getUser" "$file"; then
    echo "UNPROTECTED: $file"
  fi
done
```

### Check Database Security

```sql
-- Run in Supabase SQL editor
SELECT * FROM verify_tenant_isolation();
SELECT * FROM check_tenant_data_leakage();

-- Check recent audit events
SELECT
  event_type,
  COUNT(*) as count,
  MAX(created_at) as last_event
FROM tenant_isolation_audit
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

### Test Authentication

```bash
# Should fail (401)
curl https://app.meet-sam.com/api/sam/knowledge

# Should work with token
curl https://app.meet-sam.com/api/sam/knowledge \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎯 SUCCESS METRICS

- [ ] Unprotected routes: 0 (was 69)
- [ ] Missing workspace checks: 0 (was 76)
- [ ] Webhook validation: 100% (was 0%)
- [ ] Test routes in prod: 0 (was 7)
- [ ] Admin IP protection: 100% (was 0%)
- [ ] Security score: >90/100 (was 65/100)

---

## 📞 EMERGENCY CONTACTS

**If security incident detected:**

1. Check audit logs: `SELECT * FROM tenant_isolation_audit ORDER BY created_at DESC LIMIT 100;`
2. Disable affected routes: Add `return new Response('Maintenance', {status: 503});`
3. Notify: tl@innovareai.com, cl@innovareai.com
4. Document: Update incident log
5. Review: Full security audit

---

**Print Date**: 2025-10-08
**Next Review**: After each fix implementation
**Keep Updated**: Mark items as you complete them
