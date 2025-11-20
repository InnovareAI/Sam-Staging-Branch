# Inngest Campaign Automation Setup

## Overview

This directory contains Inngest workflow functions for SAM AI campaign automation, replacing the previous N8N integration with type-safe, testable, version-controlled workflows.

## Features

✅ **Connector Campaigns**: 1 CR + 5 follow-up messages
✅ **Human-like Randomization**: Variable delays, working hours, weekend skipping
✅ **Cron Jobs**: Automatic campaign checking every 2 hours
✅ **Type Safety**: Full TypeScript support with Unipile SDK
✅ **Retry Logic**: Automatic retries on failures
✅ **Observability**: Full execution logs in Inngest dashboard

---

## Architecture

```
User clicks "Launch Campaign" in UI
          ↓
  POST /api/campaigns/linkedin/execute-inngest
          ↓
  inngest.send("campaign/connector/execute")
          ↓
  Inngest Cloud receives event
          ↓
  POST /api/inngest (our Next.js endpoint)
          ↓
  executeConnectorCampaign() function runs
          ↓
  1. Send CR via Unipile SDK
  2. Wait 2 days (step.sleep)
  3. Send FU1
  4. Wait 5 days
  5. Send FU2
  ... continues for all 5 FUs
```

---

## Environment Variables

Add these to your `.env.local`:

```bash
# Inngest (Get from https://app.inngest.com)
INNGEST_SIGNING_KEY=your-signing-key-here
INNGEST_EVENT_KEY=your-event-key-here

# Unipile (Already configured)
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=your-unipile-key

# Supabase (Already configured)
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to get Inngest keys:**
1. Go to https://app.inngest.com
2. Create a new app (or use existing)
3. Go to "Settings" → "Keys"
4. Copy `Signing Key` and `Event Key`

---

## Local Development

### 1. Install Inngest Dev Server

```bash
npm install -g inngest-cli
```

### 2. Start Inngest Dev Server

```bash
# Terminal 1: Start Inngest dev server
inngest-cli dev

# You should see:
# ✓ Inngest dev server running at http://localhost:8288
```

### 3. Start Next.js

```bash
# Terminal 2: Start your Next.js app
npm run dev

# You should see:
# ✓ Ready on http://localhost:3000
```

### 4. Test Campaign Execution

```bash
# Terminal 3: Trigger a test campaign
curl -X POST http://localhost:3000/api/campaigns/linkedin/execute-inngest \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "your-campaign-id",
    "workspaceId": "your-workspace-id"
  }'

# You should see:
# {"success":true,"message":"LinkedIn connector campaign launched via Inngest",...}
```

### 5. View Execution in Inngest Dev UI

1. Open http://localhost:8288 in your browser
2. You'll see:
   - All triggered functions
   - Execution status (running, completed, failed)
   - Step-by-step logs
   - Ability to replay failed steps

---

## Testing

### Test Human-like Randomization

```bash
# Test the randomization logic
node -e "
const { calculateSmartDelay } = require('./lib/campaign-randomizer');

calculateSmartDelay({
  accountId: 'test-account',
  prospectIndex: 0,
  totalProspects: 10,
  settings: {
    timezone: 'America/Los_Angeles',
    working_hours_start: 5,
    working_hours_end: 18,
    skip_weekends: true
  }
}).then(delay => {
  console.log('Delay for first prospect:', delay, 'minutes');
});
"
```

### Test Unipile SDK

```bash
# Test Unipile connection
node -e "
const { Unipile } = require('unipile-node-sdk');

const unipile = new Unipile({
  dsn: process.env.UNIPILE_DSN,
  apiKey: process.env.UNIPILE_API_KEY
});

// Test getting accounts
unipile.accounts.list()
  .then(accounts => console.log('Unipile accounts:', accounts))
  .catch(err => console.error('Unipile error:', err));
"
```

---

## Deployment to Netlify

### 1. Add Inngest Environment Variables

In Netlify dashboard:
1. Go to Site Settings → Environment Variables
2. Add:
   - `INNGEST_SIGNING_KEY`
   - `INNGEST_EVENT_KEY`

### 2. Deploy

```bash
git add .
git commit -m "Add Inngest campaign automation"
git push

# Netlify will auto-deploy
```

### 3. Register Inngest Endpoint with Inngest Cloud

1. Go to https://app.inngest.com
2. Go to "Apps" → Your App → "Sync"
3. Add URL: `https://app.meet-sam.com/api/inngest`
4. Click "Sync"

Inngest will discover your functions and start executing them.

---

## Monitoring & Debugging

### View Campaign Execution

1. Go to https://app.inngest.com
2. Click "Functions" → "connector-campaign"
3. You'll see:
   - All executions
   - Success/failure rate
   - Execution time
   - Step-by-step logs

### Replay Failed Steps

If a campaign fails at step 3 (e.g., FU1):
1. Click on the failed execution
2. Click "Replay from step 3"
3. Inngest will re-run from FU1 without resending CR

### Search Executions

```
# Search by campaign ID
campaignId:abc-123

# Search by prospect name
"John Smith"

# Filter by status
status:failed
```

---

## Migration from N8N

### Side-by-Side Comparison

| Task | N8N | Inngest |
|------|-----|---------|
| **Trigger campaign** | `fetch(N8N_WEBHOOK_URL)` | `inngest.send()` |
| **View execution** | N8N UI (manual search) | Inngest dashboard (searchable) |
| **Retry failed step** | ❌ Re-run entire workflow | ✅ Replay from failed step |
| **Test locally** | ❌ Run Docker container | ✅ `inngest-cli dev` |
| **Version control** | ❌ JSON in Downloads | ✅ Git-tracked TS files |
| **Debug errors** | ❌ "undefined error" | ✅ Full stack traces |

### Migration Steps

1. **Week 1**: Test Inngest with new campaigns
2. **Week 2**: Run Inngest in parallel with N8N
3. **Week 3**: Migrate existing campaigns to Inngest
4. **Week 4**: Decommission N8N

---

## Troubleshooting

### Error: "Inngest signing key not found"

**Solution**: Add `INNGEST_SIGNING_KEY` to `.env.local`

### Error: "Unipile rate limit"

**Solution**: Inngest will automatically retry after 1 hour (built-in)

### Error: "Campaign not found"

**Solution**: Check `campaignId` and `workspaceId` are correct

### Execution stuck on "Waiting"

**Solution**: Check Inngest dashboard → execution → see which step is waiting

---

## Files

```
inngest/
├── functions/
│   ├── connector-campaign.ts    # Main connector workflow (CR + 5 FUs)
│   └── campaign-cron.ts          # Cron job (runs every 2 hours)
├── README.md                     # This file

lib/
└── inngest/
    └── client.ts                 # Inngest client configuration

lib/
└── campaign-randomizer.ts        # Human-like delay calculation

app/api/
├── inngest/
│   └── route.ts                  # Inngest endpoint (receives events)
└── campaigns/linkedin/
    └── execute-inngest/
        └── route.ts              # Manual campaign trigger API
```

---

## Next Steps

1. ✅ Install Inngest CLI: `npm install -g inngest-cli`
2. ✅ Start dev server: `inngest-cli dev`
3. ✅ Start Next.js: `npm run dev`
4. ✅ Trigger test campaign
5. ✅ View execution in http://localhost:8288
6. ✅ Deploy to Netlify
7. ✅ Sync with Inngest Cloud

---

## Support

- **Inngest Docs**: https://www.inngest.com/docs
- **Unipile SDK**: https://developer.unipile.com/docs/nodejs-sdk
- **Inngest Discord**: https://www.inngest.com/discord
