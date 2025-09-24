# 🚀 SIMPLE SAM FUNNEL DEPLOYMENT GUIDE

## Copy & Paste These 4 Files in Order

**Go to:** https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog → **SQL Editor**

---

### **STEP 1: Deploy workspace_accounts table**
**File:** `/sql/workspace_accounts_fixed.sql`
**Action:** Copy entire file contents → Paste in SQL Editor → Click **RUN**

---

### **STEP 2: Deploy Sam Funnel core tables**  
**File:** `/sql/sam_funnel_core_tables.sql`
**Action:** Copy entire file contents → Paste in SQL Editor → Click **RUN**

---

### **STEP 3: Deploy indexes and security**
**File:** `/sql/sam_funnel_indexes_and_rls.sql` 
**Action:** Copy entire file contents → Paste in SQL Editor → Click **RUN**

---

### **STEP 4: Deploy functions and triggers**
**File:** `/sql/sam_funnel_functions.sql`
**Action:** Copy entire file contents → Paste in SQL Editor → Click **RUN**

---

## ✅ **Verification**

After all 4 steps, verify with this query:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('workspace_accounts', 'sam_funnel_executions', 'sam_funnel_messages', 'sam_funnel_responses', 'sam_funnel_analytics', 'sam_funnel_template_performance')
ORDER BY table_name;
```

**Expected results:** 6 tables listed

---

## 🎉 **System Ready**

Once deployed, the Sam Funnel system supports:
- ✅ LinkedIn account management
- ✅ Complete funnel execution tracking  
- ✅ Message scheduling and responses
- ✅ Performance analytics
- ✅ HITL approval workflow

**Test endpoints:** 
- `https://app.meet-sam.com/api/linkedin/hosted-auth`
- `https://app.meet-sam.com/api/campaigns/sam-funnel/execute`