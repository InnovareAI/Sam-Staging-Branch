# SuperAdmin Analytics Production Deployment

## Pre-Deployment Checklist

### 1. Database Migration (CRITICAL - Do First)

**Run the analytics migration on production Supabase:**

```bash
# Open Supabase SQL Editor for your production project
# https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
```

**Copy and execute the migration:**
- File: `supabase/migrations/20251018_create_superadmin_analytics.sql`
- This creates:
  - `conversation_analytics` table
  - `system_health_logs` table
  - `system_alerts` table
  - `qa_autofix_logs` table
  - `deployment_logs` table
  - `user_sessions` table
  - Adds subscription columns to `users` table
  - Creates RLS policies
  - Creates helper functions

**Verification Query:**
```sql
-- Run this to verify all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'conversation_analytics',
  'system_health_logs',
  'system_alerts',
  'qa_autofix_logs',
  'deployment_logs',
  'user_sessions'
)
ORDER BY table_name;

-- Should return 6 rows
```

### 2. Environment Variables

**Ensure these are set in your production environment:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Add these if not present
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

### 3. Code Deployment

**Files to deploy:**

```bash
# Core files
app/admin/superadmin/page.tsx                      # Main dashboard
app/api/admin/superadmin-analytics/route.ts        # Analytics API
supabase/migrations/20251018_create_superadmin_analytics.sql  # Migration
middleware.ts                                      # Updated with bypass

# Supporting files (already exist)
app/admin/superadmin/layout.tsx
components/enhanced/index.tsx
components/ui/*
```

### 4. Git Commit and Push

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: Add SuperAdmin analytics dashboard with real data tracking

- Create comprehensive analytics tables for conversation, health, deployments
- Add user subscription lifecycle tracking
- Implement SuperAdmin dashboard with 7 tabs
- Add real-time health monitoring
- Include RLS policies for security
- Create helper functions for logging"

# Push to main branch (or your production branch)
git push origin main
```

### 5. Deploy to Vercel/Netlify

**If using Vercel:**
```bash
vercel --prod
```

**If using GitHub integration:**
- Push will auto-deploy via GitHub Actions
- Monitor deployment at your hosting dashboard

### 6. Post-Deployment Verification

**Test the following in production:**

1. **Access SuperAdmin Dashboard:**
   ```
   https://your-domain.com/admin/superadmin
   ```

2. **Verify API Endpoint:**
   ```bash
   curl https://your-domain.com/api/admin/superadmin-analytics?type=overview
   ```

3. **Check Database Tables:**
   ```sql
   -- Verify RLS policies are active
   SELECT tablename, policyname, permissive, roles, cmd 
   FROM pg_policies 
   WHERE tablename IN (
     'conversation_analytics',
     'system_health_logs',
     'system_alerts'
   );
   ```

4. **Test User Subscription Columns:**
   ```sql
   SELECT subscription_status, COUNT(*) 
   FROM users 
   GROUP BY subscription_status;
   ```

### 7. Data Population (Optional but Recommended)

**Backfill existing user data:**

```sql
-- Already done in migration, but verify:
SELECT 
  subscription_status,
  COUNT(*) as user_count
FROM users
GROUP BY subscription_status;
```

**Add sample health logs (optional):**
```sql
-- Log initial system health
SELECT log_system_health('database', 'healthy', 45, NULL);
SELECT log_system_health('api', 'healthy', 120, NULL);
SELECT log_system_health('storage', 'healthy', NULL, NULL);
SELECT log_system_health('memory', 'healthy', NULL, NULL);
```

### 8. Security Verification

**Verify access control:**

1. Try accessing `/admin/superadmin` without auth - should redirect
2. Try accessing as non-InnovareAI member - should show 403
3. Try accessing as InnovareAI member - should work
4. Verify API returns 403 for unauthorized users

**Check RLS policies:**
```sql
-- Ensure RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN (
  'conversation_analytics',
  'system_health_logs',
  'system_alerts',
  'qa_autofix_logs',
  'deployment_logs',
  'user_sessions'
)
AND schemaname = 'public';
-- All should have rowsecurity = true
```

### 9. Monitoring Setup

**Set up alerts for:**
- System health degradation
- Failed deployments
- High error rates on analytics API
- Database table growth (monitor storage)

### 10. Documentation

**Update team documentation:**
- [ ] Add SuperAdmin dashboard to internal docs
- [ ] Document analytics API endpoints
- [ ] Share deployment logs helper functions
- [ ] Add data collection integration guide

## Integration Tasks (Post-Deployment)

### Track Conversations
Add to your SAM AI conversation creation:
```typescript
// After creating a thread
await supabase.rpc('track_conversation_analytics', {
  p_thread_id: threadId,
  p_persona_used: 'discovery',
  p_industry: 'technology'
});
```

### Log System Health
Create a cron job or edge function:
```typescript
// Every 5 minutes
await supabase.rpc('log_system_health', {
  p_component: 'api',
  p_status: 'healthy',
  p_response_time_ms: 120
});
```

### Track Deployments
Add to deployment scripts:
```typescript
await supabase.from('deployment_logs').insert({
  deployment_name: 'Feature X',
  deployment_type: 'feature',
  target_workspaces: ['workspace-id'],
  target_count: 1,
  deployment_mode: 'production',
  status: 'success'
});
```

### Update Subscription Status
In your subscription webhook handlers:
```typescript
// On trial start
await supabase
  .from('users')
  .update({
    subscription_status: 'trial',
    trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  })
  .eq('id', userId);

// On subscription
await supabase
  .from('users')
  .update({
    subscription_status: 'active',
    subscription_plan: 'pro'
  })
  .eq('id', userId);
```

## Rollback Plan

If issues occur:

1. **Revert code deployment:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Drop new tables (if needed):**
   ```sql
   DROP TABLE IF EXISTS conversation_analytics CASCADE;
   DROP TABLE IF EXISTS system_health_logs CASCADE;
   DROP TABLE IF EXISTS system_alerts CASCADE;
   DROP TABLE IF EXISTS qa_autofix_logs CASCADE;
   DROP TABLE IF EXISTS deployment_logs CASCADE;
   DROP TABLE IF EXISTS user_sessions CASCADE;
   
   -- Remove user columns
   ALTER TABLE users 
     DROP COLUMN IF EXISTS subscription_status,
     DROP COLUMN IF EXISTS subscription_plan,
     DROP COLUMN IF EXISTS billing_cycle,
     DROP COLUMN IF EXISTS trial_ends_at,
     DROP COLUMN IF EXISTS cancelled_at,
     DROP COLUMN IF EXISTS cancellation_reason;
   ```

## Success Criteria

- ✅ All 6 analytics tables created
- ✅ RLS policies active and tested
- ✅ SuperAdmin dashboard accessible
- ✅ Analytics API returning real data
- ✅ No console errors
- ✅ Performance metrics normal
- ✅ Security verification passed

## Support

If issues arise:
1. Check Vercel/Netlify deployment logs
2. Check Supabase logs
3. Review browser console errors
4. Check API endpoint responses
5. Verify environment variables

## Next Steps

After successful deployment:
1. Train team on new dashboard features
2. Set up data collection integrations
3. Monitor analytics for insights
4. Plan dashboard enhancements based on usage
