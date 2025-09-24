# 🚀 SAM FUNNEL DATABASE DEPLOYMENT

## REQUIRED: Manual Deployment in Supabase Dashboard

Both database schemas need to be deployed manually. The automated scripts fail due to authentication issues.

### 📍 **Access Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Navigate to: **SQL Editor** (left sidebar)

---

## 🔧 **STEP 1: Deploy workspace_accounts Table**

**File to copy:** `/sql/workspace_accounts_clean.sql`

### What this creates:
- ✅ **workspace_accounts** table - LinkedIn account management
- ✅ **Indexes** for performance
- ✅ **RLS policies** for workspace isolation  
- ✅ **Triggers** for automatic timestamp updates
- ✅ **Functions** for account uniqueness validation

**Action:** Copy entire contents of `workspace_accounts_clean.sql` into SQL Editor and click **RUN**.

---

## 🎯 **STEP 2: Deploy Sam Funnel System Tables**

**File to copy:** `/sql/sam_funnel_system_clean.sql`

### What this creates:
- ✅ **5 Core Tables:**
  - `sam_funnel_executions` - Campaign execution tracking
  - `sam_funnel_messages` - Individual message scheduling
  - `sam_funnel_responses` - Prospect responses & HITL
  - `sam_funnel_analytics` - Step-by-step performance
  - `sam_funnel_template_performance` - Aggregated metrics

- ✅ **Performance Features:**
  - 20+ indexes for fast queries
  - RLS policies for workspace isolation
  - Auto-updating performance metrics
  - Qualification response processing

- ✅ **Business Logic Functions:**
  - `update_sam_funnel_execution_metrics()` - Real-time performance calculation
  - `process_qualification_response()` - Handle goodbye message responses
  - Auto-timestamp triggers

**Action:** Copy entire contents of `sam_funnel_system_clean.sql` into SQL Editor and click **RUN**.

---

## ✅ **VERIFICATION COMMANDS**

After deploying, verify with these queries in SQL Editor:

### Check workspace_accounts table:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'workspace_accounts';
```

### Check Sam Funnel tables:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'sam_funnel%' 
ORDER BY table_name;
```

### Expected Results:
- `workspace_accounts` ✓
- `sam_funnel_analytics` ✓
- `sam_funnel_executions` ✓  
- `sam_funnel_messages` ✓
- `sam_funnel_responses` ✓
- `sam_funnel_template_performance` ✓

---

## 🎉 **AFTER DEPLOYMENT:**

Once tables are deployed, the system supports:

### ✅ LinkedIn Integration:
- Account connection via existing wizard endpoints
- Multi-account management and selection
- Rate limiting and proxy routing

### ✅ Sam Funnel Execution:
- 6 LinkedIn templates (1 CR + 4 FU + 1 GB)
- 5 Email templates (4 messages + 1 GB)
- Weekday-only scheduling system
- A/B testing for 2nd CTA variations

### ✅ Analytics & Performance:
- Real-time campaign performance tracking
- Step-by-step conversion metrics
- Template optimization insights
- Response qualification processing

### ✅ HITL Integration:
- Human-in-the-loop approval for responses
- SAM AI suggested reply generation
- Learning from approval patterns

---

## 📞 **TEST ENDPOINTS AFTER DEPLOYMENT:**

```bash
# Test LinkedIn integration
curl "https://app.meet-sam.com/api/linkedin/hosted-auth" \
  -H "Authorization: Bearer <token>"

# Test Sam Funnel execution
curl -X POST "https://app.meet-sam.com/api/campaigns/sam-funnel/execute" \
  -H "Content-Type: application/json" \
  -d '{"campaign_id": "test_campaign", "template_id": "linkedin_sam_funnel_standard"}'
```

**Status:** Database schemas ready - deploy manually in Supabase Dashboard to activate the complete system.