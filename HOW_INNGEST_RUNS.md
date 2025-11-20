# How Inngest Campaigns Run Automatically

## Overview

Once deployed, you **never manually run anything**. Everything happens automatically based on triggers.

---

## Automatic Triggers

### **1. User Launches Campaign (Manual Trigger)**

```
User → Campaign Hub → Clicks "Launch Campaign"
                            ↓
                    POST /api/campaigns/linkedin/execute-inngest
                            ↓
                    inngest.send("campaign/connector/execute")
                            ↓
                    Connector workflow starts
                            ↓
        Sends CR + 5 follow-ups automatically (over ~26 days)
```

**You do this once per campaign.**

---

### **2. Cron Job (Automatic Trigger)**

```
Every 2 hours (automatically)
        ↓
Inngest runs check-active-campaigns function
        ↓
Finds campaigns with pending prospects
        ↓
Triggers connector workflow for each
        ↓
Workflows run in background
```

**You do nothing - this runs automatically every 2 hours.**

---

## What Each Workflow Does

### **Connector Workflow (connector-campaign.ts)**

**Triggered by:**
- User clicking "Launch Campaign" in UI
- Cron job finding active campaigns

**What it does (automatically):**

```
Day 0:  Send CR to Prospect 1
        Wait 18 minutes (randomized)
        Send CR to Prospect 2
        Wait 23 minutes (randomized)
        Send CR to Prospect 3
        ...

Day 2:  Check if Prospect 1 accepted
        If yes → Send Follow-up 1
        If no → Skip this prospect

Day 7:  Send Follow-up 2 to Prospect 1

Day 14: Send Follow-up 3 to Prospect 1

Day 19: Send Follow-up 4 to Prospect 1

Day 26: Send Follow-up 5 (goodbye) to Prospect 1

        ✅ Mark Prospect 1 as completed
```

**You do nothing** - this all happens automatically once triggered.

---

### **Cron Job (campaign-cron.ts)**

**Triggered by:** Time (every 2 hours)

**What it does (automatically):**

```
1. Query database for active campaigns
2. For each campaign, check if it has pending prospects
3. If yes, trigger connector workflow
4. Repeat every 2 hours
```

**You do nothing** - this runs on a schedule.

---

## No Manual Running Required

### ❌ You DON'T need to:
- "Run the follow-up agent"
- "Start the connector workflow"
- "Execute the cron job"

### ✅ You ONLY need to:
1. Deploy to Netlify (one time)
2. Sync with Inngest Cloud (one time)
3. Launch campaigns from your UI (when you want to start a new campaign)

**Everything else is automatic.**

---

## How to Monitor

### **Inngest Dashboard (https://app.inngest.com)**

Shows:
- All running workflows
- Which step each workflow is on
- Any errors
- Execution history

**Example:**
```
Connector Workflow #123
├─ ✅ Send CR to John Doe
├─ ⏰ Waiting 2 days (sleeping)
└─ ⏳ Will resume on Nov 22 at 2:15 PM
```

---

## Reply Agent (Future - Not Built Yet)

**This would be a separate workflow for handling replies:**

```
Prospect replies to your message
        ↓
Webhook from Unipile → inngest.send("prospect/reply/received")
        ↓
Reply Agent workflow starts
        ↓
Generates draft response
        ↓
Notifies you for approval
        ↓
Waits for your approval
        ↓
Sends approved reply
```

**This is Phase 2 - would also run automatically once built.**

---

## Summary

| What | How It Runs | When |
|------|-------------|------|
| **Connector Workflow** | Automatically | When you launch a campaign |
| **Cron Job** | Automatically | Every 2 hours |
| **Follow-ups** | Automatically | Part of connector workflow |
| **Reply Agent** | Not built yet | Phase 2 |

**You launch campaigns. Everything else is automatic.**
