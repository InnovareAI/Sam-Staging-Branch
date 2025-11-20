# Inngest Setup - Quick Start Guide

## ✅ What We Built

Your complete Inngest connector campaign system is ready:

1. **Connector Campaign Workflow** (`inngest/functions/connector-campaign.ts`)
   - Sends 1 CR + 5 follow-up messages
   - Human-like randomization (working hours, weekends, daily limits)
   - Automatic retries on failures
   - Type-safe Unipile SDK integration

2. **Cron Job** (`inngest/functions/campaign-cron.ts`)
   - Runs every 2 hours
   - Checks for active campaigns
   - Triggers connector workflows automatically

3. **Manual Trigger API** (`app/api/campaigns/linkedin/execute-inngest/route.ts`)
   - Launch campaigns from UI immediately
   - Replaces old N8N webhook

4. **Human-like Randomization** (`lib/campaign-randomizer.ts`)
   - All your existing logic migrated
   - Working hours enforcement (5 AM - 6 PM PT)
   - Weekend skipping (M-F only)
   - 5 different day patterns (slow, medium, busy, burst, random)

---

## 🚀 Next Steps to Get Running

### Step 1: Get Inngest Keys (5 minutes)

1. Go to https://app.inngest.com
2. Sign in with your account
3. Create a new app (or use existing)
4. Go to **Settings** → **Keys**
5. Copy:
   - **Signing Key** (starts with `signkey-`)
   - **Event Key** (starts with `inngest_`)

### Step 2: Add Environment Variables

Add to `.env.local`:

```bash
# Inngest
INNGEST_SIGNING_KEY=signkey-prod-xxxxxxxxxxxxx
INNGEST_EVENT_KEY=inngest_xxxxxxxxxxxxxxxxx

# Already configured (verify these exist)
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=your-key
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
```

### Step 3: Test Locally (10 minutes)

```bash
# Terminal 1: Start Inngest dev server
npx inngest-cli dev

# You'll see: ✓ Inngest dev server running at http://localhost:8288

# Terminal 2: Start Next.js
npm run dev

# You'll see: ✓ Ready on http://localhost:3000
```

### Step 4: View Inngest Dashboard

Open http://localhost:8288 in your browser. You should see:
- **Functions**: 2 functions registered
  - `connector-campaign`
  - `check-active-campaigns`

### Step 5: Test a Campaign

Option A: From your UI
1. Go to Campaign Hub
2. Select a campaign
3. Click "Launch Campaign"

Option B: Via curl
```bash
curl -X POST http://localhost:3000/api/campaigns/linkedin/execute-inngest \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "your-campaign-id",
    "workspaceId": "your-workspace-id"
  }'
```

You'll see the execution in http://localhost:8288!

---

## 📊 Monitoring Your Campaigns

### Inngest Dashboard (http://localhost:8288)

You can:
- **View all executions** - See which campaigns are running
- **Check status** - Running, completed, failed
- **See logs** - Step-by-step execution logs
- **Replay failures** - Retry from failed step (without resending CR)
- **Search executions** - Filter by campaign ID, prospect name, etc.

---

## 🌐 Deploy to Production

### Option 1: Deploy to Netlify (Recommended)

1. Add environment variables in Netlify:
   ```
   Site Settings → Environment Variables → Add
   - INNGEST_SIGNING_KEY
   - INNGEST_EVENT_KEY
   ```

2. Deploy:
   ```bash
   git add .
   git commit -m "Add Inngest campaign automation"
   git push
   ```

3. Register with Inngest Cloud:
   - Go to https://app.inngest.com
   - Go to **Apps** → Your App → **Sync**
   - Add URL: `https://app.meet-sam.com/api/inngest`
   - Click **Sync**

Inngest will discover your functions automatically!

### Option 2: Netlify Dev (Test Production Mode Locally)

```bash
netlify dev
```

This runs your app with production environment variables locally.

---

## 🔄 Migration from N8N

Your N8N setup will keep working. Here's the migration path:

### Week 1: Test Inngest
- Create a **new test campaign**
- Launch via Inngest
- Compare results with N8N

### Week 2: Parallel Running
- Keep N8N for existing campaigns
- Use Inngest for new campaigns
- Monitor for issues

### Week 3: Full Migration
- Update all campaigns to use Inngest
- Stop calling N8N webhook

### Week 4: Decommission N8N
- Turn off N8N Docker container
- Archive N8N workflows
- Celebrate! 🎉

---

## 🐛 Troubleshooting

### Error: "Inngest signing key not found"
**Solution**: Add `INNGEST_SIGNING_KEY` to `.env.local`

### Error: "Cannot find module '@/lib/inngest/client'"
**Solution**: Restart Next.js dev server (`npm run dev`)

### Error: "Unipile rate limit"
**Solution**: Inngest will automatically retry after 1 hour (built-in)

### Campaign stuck on "Waiting"
**Solution**: Check Inngest dashboard → see which step is waiting

### No functions showing in Inngest dashboard
**Solution**:
1. Check http://localhost:3000/api/inngest - should return function list
2. Restart Inngest dev server
3. Check console for errors

---

## 📁 File Structure

```
inngest/
├── functions/
│   ├── connector-campaign.ts    # Main workflow (CR + 5 FUs)
│   └── campaign-cron.ts          # Cron job (every 2 hours)
└── README.md                     # Detailed docs

lib/
├── inngest/
│   └── client.ts                 # Inngest client config
└── campaign-randomizer.ts        # Human-like delays

app/api/
├── inngest/
│   └── route.ts                  # Inngest endpoint
└── campaigns/linkedin/
    ├── execute-via-n8n/          # Old N8N route (keep for now)
    └── execute-inngest/          # New Inngest route
```

---

## 🎯 Key Benefits Over N8N

| Feature | N8N | Inngest |
|---------|-----|---------|
| **Type safety** | ❌ | ✅ Full TypeScript |
| **Testing** | ❌ Can't test locally | ✅ `inngest-cli dev` |
| **Debugging** | ❌ "undefined error" | ✅ Full stack traces |
| **Version control** | ❌ JSON in Downloads | ✅ Git-tracked |
| **Replay failures** | ❌ Re-run entire workflow | ✅ Replay from failed step |
| **Field name bugs** | ❌ Silent failures | ✅ TypeScript catches |

---

## 📞 Need Help?

- **Inngest Docs**: https://www.inngest.com/docs
- **Unipile SDK**: https://developer.unipile.com/docs/nodejs-sdk
- **Inngest Discord**: https://www.inngest.com/discord

---

## ✅ Checklist

- [ ] Got Inngest keys from https://app.inngest.com
- [ ] Added `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` to `.env.local`
- [ ] Started Inngest dev server (`inngest-cli dev`)
- [ ] Started Next.js (`npm run dev`)
- [ ] Opened http://localhost:8288 (see 2 functions)
- [ ] Tested a campaign
- [ ] Saw execution in Inngest dashboard
- [ ] Ready to deploy to Netlify!

---

**You're all set!** 🚀

Your connector campaign workflow is now running on Inngest with:
- ✅ 1 CR + 5 FU messages
- ✅ Human-like randomization
- ✅ Type-safe Unipile integration
- ✅ Automatic retries
- ✅ Full observability

Start with `inngest-cli dev` and `npm run dev` to see it in action!
