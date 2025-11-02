# Testing Campaign Execution with mg@innovareai.com Account

## ✅ Campaign Found
- **Name**: 20251101-IAI-test 10
- **Prospects**: 3 approved
- **Status**: Ready for message creation
- **Date**: 11/1/2025

## 🧪 Test Steps

### Method 1: Test from Sam UI (Recommended)

1. **Navigate to Campaigns** in the Sam app
2. **Find campaign**: "20251101-IAI-test 10"
3. **Click "Activate" or "Start Campaign"** button
4. **Watch for**:
   - Success message in UI
   - Check browser console (F12) for API calls
   - Look for POST to `/api/campaigns/linkedin/execute-via-n8n`

### Method 2: Test with Browser Console

Open browser console (F12) and run:

```javascript
// Get campaign details first
const campaignName = "20251101-IAI-test 10";

// Find the campaign ID from the UI or run this if you have access to Supabase client
// Then execute the campaign
fetch('/api/campaigns/linkedin/execute-via-n8n', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    campaignId: 'YOUR_CAMPAIGN_ID_HERE', // Replace with actual ID
    workspaceId: 'YOUR_WORKSPACE_ID_HERE', // Replace with actual workspace ID
    executionType: 'direct_linkedin'
  })
})
.then(res => res.json())
.then(data => {
  console.log('✅ Campaign execution response:', data);
})
.catch(err => {
  console.error('❌ Campaign execution failed:', err);
});
```

### Method 3: Test from Campaign Hub Component

1. In the Sam UI, go to your campaigns page
2. Open browser DevTools (F12)
3. Go to Network tab
4. Filter by "execute"
5. Click the "Play" or "Activate" button on your campaign
6. Watch for the API call to `/api/campaigns/linkedin/execute-via-n8n`
7. Click on the request to see:
   - **Request Payload**: What data is being sent
   - **Response**: The result from n8n

## 🔍 What to Look For

### In Browser Console/Network Tab:
```json
{
  "success": true,
  "message": "V1 Campaign Orchestration launched - HITL approval required",
  "execution_id": "...",
  "n8n_execution_id": "...",
  "hitl_session_id": "...",
  "workspace_tier": "startup",
  "prospects_processing": 3,
  "channels_enabled": {
    "linkedin": true,
    "email": false,
    "primary_channel": "linkedin"
  }
}
```

### In N8N Dashboard (https://workflows.innovareai.com):

1. Go to **Executions** tab
2. Look for workflow: **SAM Campaign Execution v2 - Clean**
3. Check for new execution (will show timestamp matching when you clicked)
4. Click on execution to see:
   - Input data (your campaign payload)
   - Execution status
   - Any errors

### Expected N8N Webhook Payload:

The workflow should receive data like:
```json
{
  "campaign_id": "...",
  "workspace_id": "...",
  "workspace_tier": "startup",
  "campaign_type": "direct_linkedin",
  "campaign_data": {
    "prospects": [
      {
        "id": "...",
        "first_name": "...",
        "last_name": "...",
        "company": "...",
        "linkedin_url": "..."
      }
      // ... 2 more prospects
    ]
  },
  "execution_preferences": {
    "immediate_execution": false,
    "hitl_approval_required": true,
    "batch_size": 3
  }
}
```

## ✅ Success Indicators

- [ ] Browser shows success message
- [ ] Network tab shows 200 OK response
- [ ] Response includes `n8n_execution_id`
- [ ] N8N shows new execution in dashboard
- [ ] Workflow status is "Running" or "Success"
- [ ] No errors in browser console

## ❌ Troubleshooting

### If you get "Unauthorized":
- Make sure you're logged in as mg@innovareai.com
- Refresh the page and try again

### If you get "Campaign not found":
- Double-check the campaign ID and workspace ID match
- Ensure the campaign status is "active" or "draft"

### If n8n shows no execution:
1. Check if `N8N_CAMPAIGN_WEBHOOK_URL` is set in `.env`
2. Verify the webhook URL: `https://workflows.innovareai.com/webhook/campaign-execute-v2`
3. Check if the workflow is **Active** in n8n

### If you see "fallback" URL in logs:
- The env variable isn't loaded yet
- Restart your dev server: `npm run dev`

## 🎯 Quick Test Command

If you have the campaign ID and workspace ID, you can test directly:

```bash
# Replace with actual IDs
curl -X POST http://localhost:3000/api/campaigns/linkedin/execute-via-n8n \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "campaignId": "CAMPAIGN_ID_HERE",
    "workspaceId": "WORKSPACE_ID_HERE",
    "executionType": "direct_linkedin"
  }'
```

## 📊 Next Steps After Successful Test

1. ✅ Verify campaign execution appears in n8n
2. ✅ Check HITL approval email was sent
3. ✅ Review campaign prospects status updated to "hitl_approval"
4. ✅ Test the full flow with actual LinkedIn messaging
5. ✅ Monitor webhook callbacks from n8n

---

**Ready to test?** Start with Method 1 (UI) - it's the easiest and most realistic test!
