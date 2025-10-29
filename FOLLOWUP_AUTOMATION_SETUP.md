# Follow-Up Message Automation Setup

## ✅ SYSTEM CREATED

Complete follow-up automation system for LinkedIn campaigns.

## 🎯 How It Works

```
Connection Request → Accepted → Follow-Up Sequence

Day 0:  Send connection request
Day 1:  Connection accepted (detected automatically)
Day 2:  Send Follow-Up #1
Day 5:  Send Follow-Up #2
Day 10: Send Follow-Up #3
Day 17: Send Follow-Up #4
Day 31: Send Follow-Up #5 (final)
```

## 📋 Setup Steps

### Step 1: Run Database Migration

Go to: https://app.supabase.com/project/[your-project]/sql

Run this SQL:

```sql
-- Add follow-up tracking fields
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS connection_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS follow_up_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS follow_up_sequence_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_follow_up_due
ON campaign_prospects(status, follow_up_due_at)
WHERE status = 'connected';
```

### Step 2: Add Cron Jobs

Go back to: https://cron-job.org/en/members/

**Add Job #2: Check Accepted Connections**
```
Title: SAM Check Connections
URL: https://app.meet-sam.com/api/cron/check-accepted-connections
Method: POST
Schedule: Every 1 hour (0 */1 * * *)
Headers: Content-Type: application/json
```

**Add Job #3: Send Follow-Ups**
```
Title: SAM Send Follow-Ups
URL: https://app.meet-sam.com/api/cron/send-follow-ups
Method: POST
Schedule: Every 1 hour (0 */1 * * *)
Headers: Content-Type: application/json
```

### Step 3: Wait for Deployment

Netlify deployment takes ~2-5 minutes after push.

Check: https://app.netlify.com/sites/devin-next-gen-staging/deploys

## 🔄 Automation Flow

### Detection Process

Every hour, the system:
1. Gets all prospects with status = 'connection_requested'
2. Checks their LinkedIn accounts for new chats
3. If chat exists → Connection was accepted!
4. Updates status to 'connected'
5. Schedules first follow-up for 24 hours later

### Follow-Up Process

Every hour, the system:
1. Finds prospects where follow_up_due_at <= now
2. Gets their campaign's follow-up message sequence
3. Sends the next message in the sequence
4. Updates follow_up_sequence_index
5. Schedules next follow-up with appropriate delay

### Timing Delays

```
Follow-Up #1: 24 hours after connection accepted
Follow-Up #2: 3 days after Follow-Up #1
Follow-Up #3: 5 days after Follow-Up #2
Follow-Up #4: 7 days after Follow-Up #3
Follow-Up #5: 14 days after Follow-Up #4
Complete: No more follow-ups
```

## 📊 Database Schema

### New Fields

```typescript
campaign_prospects {
  connection_accepted_at?: timestamp  // When connection accepted
  follow_up_due_at?: timestamp        // Next follow-up scheduled
  follow_up_sequence_index: number    // Current position (0-4)
  last_follow_up_at?: timestamp       // Last follow-up sent
}
```

### Status Flow

```
pending
  ↓ (cron: process-pending-prospects)
connection_requested
  ↓ (cron: check-accepted-connections)
connected
  ↓ (cron: send-follow-ups, loop 5x)
follow_up_complete
```

## 🧪 Testing

### Test Connection Detection

```bash
# Create a test prospect manually
# Set status = 'connection_requested'
# Accept their request on LinkedIn
# Wait 1 hour for cron
# Check if status changed to 'connected'
```

### Test Follow-Up Sending

```bash
# Manually set a prospect:
UPDATE campaign_prospects
SET
  status = 'connected',
  follow_up_due_at = NOW(),
  follow_up_sequence_index = 0
WHERE id = 'test-prospect-id';

# Wait for cron (runs every hour)
# Or call API manually:
curl -X POST https://app.meet-sam.com/api/cron/send-follow-ups \
  -H "Content-Type: application/json"
```

### Check Logs

**Netlify Functions → Logs**

Look for:
```
✅ Connection accepted: [username]
✅ Follow-up sent to [name]
📊 Sent: X follow-ups
```

## 🎯 Campaign Configuration

Your campaigns already have 5 follow-up messages configured:

**Follow-Up #1:**
```
Hello {first_name}, thanks for connecting! I've been following
the innovation ecosystem at {company_name}...
```

**Follow-Up #2-5:**
- Research sharing
- Case study offer
- Roundtable invitation
- Final courtesy message

These are automatically sent with proper timing!

## ⚠️ Important Notes

### LinkedIn Rate Limits

- **100 messages/week** per LinkedIn account
- Follow-ups count toward this limit
- System respects delays to avoid spam detection

### Detection Method

The system uses **chat detection** (Method 2):
- When invitation with message is accepted → New chat created
- This is detected within 1 hour (vs webhooks: up to 8 hours)
- More reliable than webhooks

### Message Personalization

Follow-ups use same variables as connection requests:
- `{first_name}` - Prospect first name
- `{company_name}` - Their company
- `{industry}` - Their industry
- `{title}` - Their job title

## 📈 Monitoring

### Check Follow-Up Status

```bash
node scripts/js/check-followup-status.mjs
```

### Check Connected Prospects

```sql
SELECT
  first_name,
  last_name,
  status,
  connection_accepted_at,
  follow_up_sequence_index,
  follow_up_due_at
FROM campaign_prospects
WHERE status = 'connected'
ORDER BY follow_up_due_at ASC
LIMIT 10;
```

### Check Follow-Up Progress

```sql
SELECT
  follow_up_sequence_index,
  COUNT(*) as count
FROM campaign_prospects
WHERE status IN ('connected', 'follow_up_complete')
GROUP BY follow_up_sequence_index
ORDER BY follow_up_sequence_index;
```

## 🔧 Troubleshooting

### "No connections detected"

**Issue:** Cron runs but finds no accepted connections

**Causes:**
1. Connections not yet accepted (be patient)
2. LinkedIn accounts disconnected
3. prospect provider_id missing

**Fix:**
- Check prospect has provider_id in personalization_data
- Verify LinkedIn account still connected
- Wait 24-48 hours for acceptances

### "Follow-ups not sending"

**Issue:** Prospects stuck at 'connected' status

**Causes:**
1. follow_up_due_at not set
2. Campaign missing follow-up messages
3. LinkedIn account rate limited

**Fix:**
```sql
-- Check if due_at is set
SELECT id, follow_up_due_at
FROM campaign_prospects
WHERE status = 'connected'
LIMIT 5;

-- Manually trigger one:
UPDATE campaign_prospects
SET follow_up_due_at = NOW()
WHERE id = 'prospect-id';
```

### "Rate limit errors"

**Expected:** LinkedIn limits 100 messages/week

**Solution:**
- System automatically skips rate-limited accounts
- Continues with next prospect
- Will retry in next hour

## ✅ Verification Checklist

After setup:

- [ ] Database migration run successfully
- [ ] Two new cron jobs created in cron-job.org
- [ ] Both crons show as "Active"
- [ ] Netlify deployment completed
- [ ] Test connection detection works
- [ ] Test follow-up sending works
- [ ] Logs showing no errors

## 🎉 Success Metrics

You'll know it's working when:

- ✅ Prospects moving: connection_requested → connected
- ✅ Follow-ups being sent automatically
- ✅ follow_up_sequence_index incrementing (0→1→2→3→4)
- ✅ Cron logs showing "Sent X follow-ups"
- ✅ LinkedIn showing sent messages to connections

---

**Current Status:**
- ✅ Code deployed
- ⏳ Waiting for database migration
- ⏳ Waiting for cron setup
- ⏳ Waiting for first connection acceptance (24-48 hours)

**Next Steps:**
1. Run database migration
2. Add 2 cron jobs
3. Wait for connections to be accepted
4. Monitor logs for first follow-up send!

**Timeline:**
- Today: Setup complete
- Day 1-2: First connections accepted
- Day 2-3: First follow-ups sent ✅
- Day 5+: Full sequence running 🚀
