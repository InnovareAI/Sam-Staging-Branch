# SAM AI Intelligent Email Notification System

**Date**: October 6, 2025
**Status**: Implemented & Ready for Testing

---

## 🎯 System Overview

SAM AI uses **intelligent, context-aware email notifications** that only send when users are truly inactive. This prevents notification fatigue while ensuring users never miss important actions.

### Core Principle
**"Don't interrupt active users, but don't let inactive users forget"**

---

## 📧 Notification Types

### 1. **Prospect Approval Notifications** (Intelligent Delay)

**Trigger**: Prospects ready for review after CSV upload/scraping

**Timing Strategy** (Randomized to avoid spam filters):
- ⏰ **First Reminder**: 2-3 hours after inactivity (randomized per session)
- 🌅 **Morning Follow-up**: Next day 9-11 AM (randomized within window)
- 🌆 **Evening Follow-up**: Same day 6-8 PM (randomized within window)
- 🔁 **Continued Reminders**: Every 12 hours (randomized within 9-11 AM / 6-8 PM windows) until user acts

**Why Randomization?**
- Prevents all emails from sending at exactly the same time
- Avoids spam filter triggers (looks more natural)
- Distributes email load evenly over time windows
- Each session gets a consistent random time (same session = same time every day)

**Direct Action Link**:
```
https://app.meet-sam.com/approve?session={sessionId}
```
Takes user directly to Data Approval Hub with prospects loaded.

**Cancellation Logic**:
- If user chats with SAM → Activity tracked, notification cancelled
- If user views approval page → Activity tracked, notification cancelled
- If user approves prospects → Session closed, no more reminders

---

### 2. **Campaign Launch Notifications** (Immediate)

**Trigger**: Campaign successfully launched

**Timing**: Immediate (no delay)

**Rationale**: Users want instant confirmation that their campaign is running.

**Direct Action Link**:
```
https://app.meet-sam.com/campaigns/{campaignId}
```
Takes user to Campaign Dashboard for live monitoring.

---

### 3. **Reply Notifications** (Immediate)

**Trigger**: Prospect replies to outreach

**Timing**: Immediate (no delay)

**Rationale**: Time-sensitive - user needs to respond quickly to hot leads.

**Direct Action Link**:
```
https://app.meet-sam.com/replies/{campaignId}/{prospectId}
```
Takes user directly to the reply thread for immediate response.

---

## 🧠 Activity Tracking System

### How It Works

SAM tracks user activity across multiple touchpoints:

1. **SAM Chat Messages** → Updates `user_last_active_at`
2. **Page Views in Approval Hub** → Updates `user_last_active_at`
3. **Prospect Approval Actions** → Closes session, stops reminders

### Database Schema

**Table**: `prospect_approval_sessions`

| Column | Type | Purpose |
|--------|------|---------|
| `notification_scheduled_at` | TIMESTAMPTZ | When the first notification should be sent (2 hours from creation) |
| `notification_sent_at` | TIMESTAMPTZ | When the first notification was actually sent |
| `user_last_active_at` | TIMESTAMPTZ | Last time user was active (chat, page view, etc.) |
| `reminder_count` | INTEGER | Number of reminders sent (0, 1, 2, 3...) |
| `last_reminder_sent_at` | TIMESTAMPTZ | Timestamp of most recent reminder |

---

## 🤖 Automated Reminder Schedule

### Cron Job Configuration

**Endpoint**: `/api/cron/check-pending-notifications`

**Schedule**: Every 15 minutes

**Authorization**: Bearer token (`CRON_SECRET_TOKEN` env variable)

### Reminder Logic Flow

```
User uploads CSV → Prospects scraped → Session created
│
├─ notification_scheduled_at = now + 2 hours
├─ user_last_active_at = now
└─ reminder_count = 0

⏱️  After 2 hours (User still inactive):
│
├─ Cron job checks: Is user still inactive?
│  ├─ YES → Send first reminder email
│  │       ├─ reminder_count = 1
│  │       ├─ notification_sent_at = now
│  │       └─ last_reminder_sent_at = now
│  │
│  └─ NO → Skip (user chatted with SAM or viewed page)

🌅 Next Day at 9 AM (User still hasn't acted):
│
├─ Cron job checks:
│  ├─ reminder_count = 1
│  ├─ last_reminder_sent_at > 6 hours ago?
│  ├─ current_hour = 9-12?
│  │
│  └─ Send morning reminder
│      ├─ reminder_count = 2
│      └─ last_reminder_sent_at = now

🌆 Same Day at 6 PM (User still hasn't acted):
│
├─ Cron job checks:
│  ├─ reminder_count = 2
│  ├─ last_reminder_sent_at > 6 hours ago?
│  ├─ current_hour = 18-21?
│  │
│  └─ Send evening reminder
│      ├─ reminder_count = 3
│      └─ last_reminder_sent_at = now

🔁 Continue pattern (randomized 9-11 AM / 6-8 PM) until:
   ├─ User approves prospects → Session closed
   ├─ User rejects all → Session closed
   └─ Session expires → Reminders stop
```

---

## 🎲 Randomization Algorithm

### How It Works

Each session gets a **consistent random send time** based on its session ID:

```typescript
// Session abc123 → Always sends at 9:47 AM
// Session def456 → Always sends at 10:23 AM
// Session ghi789 → Always sends at 11:05 AM
```

**Benefits**:
1. ✅ Same session = same time (predictable for user)
2. ✅ Different sessions = different times (distributed load)
3. ✅ Looks natural to spam filters (not all at 9:00:00 AM)

### Technical Implementation

**Seeded Random Function**:
```typescript
function hashSessionId(sessionId: string): number {
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash) + sessionId.charCodeAt(i)
  }
  return Math.abs(hash)
}

// First reminder: 2-3 hours (120-180 minutes)
const randomDelay = (hash % 60) + 120 // Deterministic random between 120-180 min

// Morning reminder: 9-11 AM
const morningHour = (hash % 3) + 9 // Deterministic random between 9-11

// Evening reminder: 6-8 PM
const eveningHour = (hash % 3) + 18 // Deterministic random between 18-20
```

### Example Distribution

If 100 sessions are created:
- **First Reminders**: Spread evenly over 2-3 hour window
- **Morning Reminders**: ~33 at 9 AM, ~33 at 10 AM, ~33 at 11 AM
- **Evening Reminders**: ~33 at 6 PM, ~33 at 7 PM, ~33 at 8 PM

---

## 📊 Email Send Distribution

### Without Randomization (❌ BAD)
```
9:00 AM |█████████████████████████| 100 emails
6:00 PM |█████████████████████████| 100 emails
```
⚠️ Spam filter risk: HIGH

### With Randomization (✅ GOOD)
```
9:00 AM |████████| 33 emails
10:00 AM|████████| 33 emails
11:00 AM|████████| 34 emails

6:00 PM |████████| 33 emails
7:00 PM |████████| 33 emails
8:00 PM |████████| 34 emails
```
✅ Spam filter risk: LOW

---

## 🎛️ Configuration

### Environment Variables

```bash
# Postmark Email API
POSTMARK_INNOVAREAI_API_KEY=<key>

# Cron Job Security
CRON_SECRET_TOKEN=<secure_random_token>

# App URLs
NEXT_PUBLIC_APP_URL=https://app.meet-sam.com
```

### Netlify Scheduled Function Setup

1. **Create scheduled function** in `netlify.toml`:

```toml
[[plugins]]
  package = "@netlify/plugin-functions-cron"

[[plugins.inputs.cron]]
  expression = "*/15 * * * *"  # Every 15 minutes
  function = "check-pending-notifications"
```

2. **Add CRON_SECRET_TOKEN** to Netlify environment variables

3. **Deploy** → Scheduled function runs automatically

---

## 📊 Monitoring & Logging

### Cron Job Logs

Each run outputs:

```json
{
  "timestamp": "2025-10-06T14:30:00Z",
  "results": {
    "sent": 5,
    "cancelled": 12,
    "failed": 0,
    "errors": []
  }
}
```

### Activity Tracking Logs

```
⏰ User activity tracked for user_abc123
⏭️  Session def456: User recently active (1.2h ago), skipping
✅ morning reminder (#2) sent to user@example.com for session ghi789
```

---

## 🧪 Testing

### Manual Test: Approval Notification Flow

1. **Upload CSV** with prospects in Data Collection Hub
2. **Wait 2 hours** (or modify `notification_scheduled_at` in database for faster testing)
3. **Check email** for approval notification
4. **Click link** in email → Should go directly to approval screen
5. **Chat with SAM** → Activity tracked, next reminder delayed

### Manual Test: Campaign Launch Notification

1. **Launch campaign** from Campaign Hub
2. **Check email immediately** for launch confirmation
3. **Click link** → Should go to campaign dashboard

### Test Cron Job Locally

```bash
# Set environment variable
export CRON_SECRET_TOKEN="test-secret-123"

# Call cron endpoint
curl -X GET http://localhost:3000/api/cron/check-pending-notifications \
  -H "Authorization: Bearer test-secret-123"
```

---

## 🚦 Production Deployment Checklist

- [ ] **Apply database migration** (`20251006000003_add_activity_tracking_to_approval_sessions.sql`)
- [ ] **Set CRON_SECRET_TOKEN** in Netlify environment variables
- [ ] **Configure Postmark domain** (innovareai.com DNS records)
- [ ] **Set up Netlify scheduled function** (every 15 minutes)
- [ ] **Test cron job** in staging environment
- [ ] **Monitor logs** for first 24 hours after launch

---

## 📈 Success Metrics

**Good Health Indicators:**
- 📧 Reminders sent only to inactive users (>2 hours)
- ✅ Approval rate increases with morning/evening reminders
- 🚫 Zero complaints about notification spam
- ⚡ Users clicking direct links and taking action

**Red Flags:**
- ❌ Users receiving emails while actively using app
- ❌ Reminders sent outside 9 AM / 6 PM windows
- ❌ Multiple reminders sent within 6-hour window

---

## 🔮 Future Enhancements

1. **Time Zone Awareness**: Send morning/evening reminders based on user's local timezone
2. **User Preferences**: Allow users to customize reminder frequency
3. **Smart Timing**: Use ML to predict best time to send reminders per user
4. **Batch Notifications**: Combine multiple pending actions into one daily digest

---

**Implementation Date**: October 6, 2025
**Last Updated**: October 6, 2025
**Status**: ✅ Production Ready
