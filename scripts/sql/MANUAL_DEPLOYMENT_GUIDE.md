# Sam Funnel System - Manual Database Deployment Guide

## 🚨 REQUIRED: Deploy Sam Funnel Database Schema

The Sam Funnel system requires database tables that must be deployed manually.

### **Step 1: Access Supabase Dashboard**
1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Navigate to: **SQL Editor** (left sidebar)

### **Step 2: Execute Sam Funnel Schema**
1. Open the file: `/supabase/migrations/20250924_create_sam_funnel_system.sql`
2. Copy the ENTIRE contents of the file
3. Paste into Supabase SQL Editor
4. Click **RUN** button

### **Step 3: Verify Deployment**
After running the SQL, verify these tables were created:
- ✅ `sam_funnel_executions`
- ✅ `sam_funnel_messages`
- ✅ `sam_funnel_responses`
- ✅ `sam_funnel_analytics`
- ✅ `sam_funnel_template_performance`

### **Step 4: Test API Endpoints**
Once tables are created, test the Sam Funnel API:
```bash
curl -X POST "https://app.meet-sam.com/api/campaigns/sam-funnel/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "test_campaign_123",
    "template_id": "linkedin_sam_funnel_standard", 
    "prospects": [
      {
        "id": "prospect_1",
        "first_name": "John",
        "last_name": "Doe",
        "company_name": "TechCorp",
        "linkedin_url": "https://linkedin.com/in/johndoe"
      }
    ]
  }'
```

## 🔧 **What This Schema Creates:**

### **Core Tables:**
1. **sam_funnel_executions** - Track campaign executions
2. **sam_funnel_messages** - Individual scheduled messages
3. **sam_funnel_responses** - Prospect responses and SAM analysis
4. **sam_funnel_analytics** - Performance metrics by step
5. **sam_funnel_template_performance** - Aggregated template performance

### **Key Features:**
- ✅ **Weekday-only scheduling** system
- ✅ **A/B testing framework** for 2nd CTA variations  
- ✅ **4-option qualification** system (a/b/c/d responses)
- ✅ **HITL approval workflow** for responses
- ✅ **Automatic metrics calculation**
- ✅ **Performance analytics** and optimization
- ✅ **Row Level Security** (RLS) policies

### **Database Functions Created:**
- `update_sam_funnel_execution_metrics()` - Auto-calculate performance
- `process_qualification_response()` - Handle goodbye message responses
- Various triggers for automatic timestamp updates

## 🎯 **Next Steps After Deployment:**

### **1. Test LinkedIn Connection**
```bash
# Test LinkedIn wizard integration
curl "https://app.meet-sam.com/api/linkedin/connect" \
  -H "Authorization: Bearer <your-token>"
```

### **2. Test Sam Funnel Execution** 
```bash
# Execute Sam Funnel campaign
curl -X POST "https://app.meet-sam.com/api/campaigns/sam-funnel/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '<campaign-data>'
```

### **3. Test Webhook Integration**
```bash
# Test status update webhook
curl -X POST "https://app.meet-sam.com/api/webhooks/sam-funnel/status-update" \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "test_execution_123",
    "event_type": "message_sent",
    "message_id": "test_message_123",
    "prospect_id": "test_prospect_123"
  }'
```

## 💡 **System Architecture Overview:**

```
Sam Conversation → ICP Discovery → Prospect Approval → Funnel Execution
     ↓                ↓               ↓                 ↓
Template Selection → LinkedIn Setup → Message Scheduling → Webhooks → Analytics
```

**Critical Dependencies:**
1. ✅ **Supabase Database** - Tables deployed
2. ✅ **LinkedIn Integration** - Wizard endpoints fixed
3. ✅ **N8N Integration** - Workflow execution
4. ✅ **Webhook System** - Status updates and responses
5. ✅ **Template System** - Sam Funnel + One-off templates

**Status**: Database schema ready for deployment. Manual deployment required in Supabase Dashboard.