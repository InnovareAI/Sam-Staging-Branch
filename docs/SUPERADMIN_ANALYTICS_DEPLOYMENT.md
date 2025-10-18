# SuperAdmin Analytics Deployment Guide

This guide explains how to deploy the real data tracking infrastructure for the SuperAdmin dashboard.

## Overview

The SuperAdmin dashboard requires real data tracking for:
- User subscription lifecycle (trial, active, cancelled)
- Conversation analytics (persona usage, completion rates)
- System health monitoring (component status, response times)
- QA Agent auto-fix logs
- Deployment tracking
- System alerts

## 🚀 Deployment Steps

### 1. Run the Database Migration

The migration file is located at:
```
supabase/migrations/20251018_create_superadmin_analytics.sql
```

**Option A: Via Supabase Dashboard**
1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copy the contents of `20251018_create_superadmin_analytics.sql`
3. Paste into the SQL editor
4. Click "Run"

**Option B: Via Supabase CLI**
```bash
supabase db push
```

### 2. Verify Tables Created

Run this query in Supabase SQL Editor:
```sql
SELECT tablename 
FROM pg_tables 
WHERE tablename IN (
  'conversation_analytics',
  'system_health_logs',
  'system_alerts',
  'qa_autofix_logs',
  'deployment_logs',
  'user_sessions'
)
ORDER BY tablename;
```

You should see 6 tables.

### 3. Verify User Subscription Columns

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN (
    'subscription_status',
    'trial_ends_at',
    'cancelled_at',
    'cancellation_reason'
  );
```

You should see 4 new columns.

### 4. Check Initial Data Backfill

The migration automatically backfills existing users:
- Users created < 30 days ago → `subscription_status = 'trial'`
- Users created >= 30 days ago → `subscription_status = 'active'`

Verify:
```sql
SELECT 
  subscription_status,
  COUNT(*) as count
FROM users
GROUP BY subscription_status;
```

## 📊 New Database Tables

### 1. `conversation_analytics`
Tracks SAM AI conversation metrics:
- Session duration
- Message count
- Completion status
- Persona used (discovery, ICP research, script position)
- Industry/company size
- Engagement scores

### 2. `system_health_logs`
Records system component health:
- Component status (database, API, storage, memory)
- Response times
- CPU/memory/storage usage
- Error tracking

### 3. `system_alerts`
Manages system alerts:
- Alert type (critical, warning, info)
- Component affected
- Resolution tracking
- Alert history

### 4. `qa_autofix_logs`
Tracks QA Agent auto-fixes:
- Issue type and description
- Fix status (success, failed, manual required)
- Affected components/files
- Fix metadata

### 5. `deployment_logs`
Records deployment history:
- Deployment type and target
- Success/failure tracking
- Duration and timing
- Deployed by (user tracking)

### 6. `user_sessions`
Tracks user session metrics:
- Session start/end times
- Duration
- Pages visited
- Actions performed

## 🔧 Helper Functions

The migration includes these SQL functions:

### `log_system_health()`
```sql
SELECT log_system_health(
  'database',
  'healthy',
  45,  -- response time in ms
  NULL -- error message
);
```

### `create_system_alert()`
```sql
SELECT create_system_alert(
  'warning',
  'memory',
  'High Memory Usage',
  'Memory usage at 85%',
  '{"threshold": 85}'::jsonb
);
```

### `track_conversation_analytics()`
```sql
SELECT track_conversation_analytics(
  'thread-uuid',
  'discovery',
  'technology'
);
```

## 📈 API Endpoints

New API route: `/api/admin/superadmin-analytics`

### Usage Examples

**Overview Stats:**
```bash
GET /api/admin/superadmin-analytics?type=overview
```

**Conversation Analytics:**
```bash
GET /api/admin/superadmin-analytics?type=conversations
```

**System Health:**
```bash
GET /api/admin/superadmin-analytics?type=health
```

**Deployment Stats:**
```bash
GET /api/admin/superadmin-analytics?type=deployments
```

**System Alerts:**
```bash
GET /api/admin/superadmin-analytics?type=alerts
```

## 🔐 Security

- All tables have Row Level Security (RLS) enabled
- Only super admins (tl@innovareai.com, cl@innovareai.com) can access analytics
- Users can view their own conversation analytics and sessions

## 🔄 Ongoing Data Collection

### Automatic Tracking

To start collecting real data, integrate these calls into your application:

**1. Track Conversations (in SAM AI API):**
```typescript
// After creating a conversation thread
await supabase.rpc('track_conversation_analytics', {
  p_thread_id: threadId,
  p_persona_used: 'discovery', // or 'icp_research', 'script_position'
  p_industry: 'technology'
});
```

**2. Log System Health (in health check cron):**
```typescript
// Every 5 minutes
await supabase.rpc('log_system_health', {
  p_component: 'api',
  p_status: 'healthy',
  p_response_time_ms: 120
});
```

**3. Create Alerts (when issues detected):**
```typescript
await supabase.rpc('create_system_alert', {
  p_alert_type: 'warning',
  p_component: 'storage',
  p_title: 'High Storage Usage',
  p_message: 'Storage at 75% capacity'
});
```

**4. Log Deployments:**
```typescript
// In deployment scripts
await supabase.from('deployment_logs').insert({
  deployment_name: 'Unipile Auth Integration',
  deployment_type: 'integration',
  target_workspaces: workspaceIds,
  target_count: workspaceIds.length,
  deployment_mode: 'production',
  status: 'success',
  success_count: successCount,
  deployed_by: userId
});
```

## 📝 Updating User Subscription Status

### When user starts trial:
```sql
UPDATE users SET
  subscription_status = 'trial',
  trial_ends_at = NOW() + INTERVAL '30 days'
WHERE id = 'user-uuid';
```

### When user subscribes:
```sql
UPDATE users SET
  subscription_status = 'active',
  subscription_plan = 'pro',
  billing_cycle = 'monthly'
WHERE id = 'user-uuid';
```

### When user cancels:
```sql
UPDATE users SET
  subscription_status = 'cancelled',
  cancelled_at = NOW(),
  cancellation_reason = 'Too expensive'
WHERE id = 'user-uuid';
```

## ✅ Verification Checklist

- [ ] Migration ran successfully
- [ ] All 6 new tables exist
- [ ] Users table has subscription columns
- [ ] Existing users backfilled with subscription status
- [ ] API route `/api/admin/superadmin-analytics` returns data
- [ ] SuperAdmin dashboard displays real stats
- [ ] RLS policies working (only superadmins can access)

## 🐛 Troubleshooting

**Issue: Migration fails with "column already exists"**
- Solution: Some columns may already exist. The migration uses `IF NOT EXISTS` so it should be safe to re-run.

**Issue: API returns empty data**
- Solution: Data collection needs to be integrated. Tables start empty until you add tracking calls to your application.

**Issue: Unauthorized error**
- Solution: Ensure you're logged in as tl@innovareai.com or cl@innovareai.com

**Issue: RLS policies blocking queries**
- Solution: Use the service role key for admin operations in your API routes.

## 📚 Next Steps

1. **Deploy the migration** to create all tables
2. **Integrate tracking calls** in your SAM AI and system monitoring code
3. **Set up cron jobs** for periodic health logging
4. **Configure deployment hooks** to log all deployments
5. **Monitor the dashboard** to ensure data is flowing correctly

## 🎯 Success Metrics

Once deployed and integrated, you should see:
- Real user lifecycle counts (signups, trials, active, cancelled)
- Actual conversation analytics with persona breakdown
- Live system health metrics
- QA auto-fix history
- Deployment success rates
- Active system alerts

The dashboard will transition from mock data to **100% real production data**. 🚀
