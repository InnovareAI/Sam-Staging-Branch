# N8N Send-Time Validation Requirements

**Status:** 🚧 SPECIFICATION - Needs Implementation

## Overview

Campaign messages (FU1-6) must respect:
1. User timezone (campaign owner, not prospect)
2. Business hours (8am-6pm user's local time)
3. No weekends
4. No public holidays (country-specific)
5. Reply detection (stop if prospect replied)
6. Randomization (avoid spam detection)

---

## 1. User Timezone

**Source:** Campaign owner's timezone setting

**Database:**
```sql
-- Get timezone from campaign
SELECT
  cs.timezone,
  cs.campaign_id
FROM campaign_schedules cs
WHERE cs.campaign_id = 'campaign_id';

-- Or from workspace settings (if per-workspace)
SELECT
  w.timezone,
  w.id
FROM workspaces w
WHERE w.id = 'workspace_id';
```

**Implementation:**
- Timezone stored in `campaign_schedules.timezone` (default: 'UTC')
- User sets timezone when creating campaign
- Examples: `'America/New_York'`, `'Europe/Paris'`, `'Asia/Tokyo'`

---

## 2. Business Hours

**Default:** 8am - 6pm in user's timezone

**Configurable?** Could be per-campaign:
```sql
ALTER TABLE campaign_schedules
ADD COLUMN business_hours_start INTEGER DEFAULT 8,  -- 8am
ADD COLUMN business_hours_end INTEGER DEFAULT 18;   -- 6pm
```

**Validation Logic:**
```javascript
const userTimezone = 'Europe/Paris';  // From campaign_schedules
const now = new Date();
const localTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
const hour = localTime.getHours();

if (hour < 8 || hour >= 18) {
  // Outside business hours - reschedule
  const nextBusinessHour = calculateNextBusinessHour(localTime);
  return { can_send: false, reschedule_to: nextBusinessHour };
}
```

---

## 3. No Weekends

**Rule:** Only send Monday-Friday

**Validation:**
```javascript
const day = localTime.getDay();  // 0=Sunday, 6=Saturday
const isWeekend = (day === 0 || day === 6);

if (isWeekend) {
  // Calculate next Monday
  const nextMonday = getNextMonday(localTime);
  return { can_send: false, reschedule_to: nextMonday };
}
```

---

## 4. Public Holidays

**Source:** Country-specific holiday calendars

**Database Approach:**
```sql
CREATE TABLE public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL,  -- 'US', 'FR', 'GB', 'DE', 'CA'
  holiday_date DATE NOT NULL,
  holiday_name VARCHAR(255),
  UNIQUE(country_code, holiday_date)
);

-- Index for fast lookups
CREATE INDEX idx_public_holidays_country_date
ON public_holidays(country_code, holiday_date);

-- Seed with 2025 holidays
INSERT INTO public_holidays (country_code, holiday_date, holiday_name) VALUES
('US', '2025-01-01', 'New Year''s Day'),
('US', '2025-01-20', 'MLK Day'),
('US', '2025-07-04', 'Independence Day'),
('FR', '2025-07-14', 'Bastille Day'),
('FR', '2025-12-25', 'Christmas'),
-- ... etc
```

**Validation:**
```javascript
const userCountry = 'FR';  // From workspace or campaign settings
const dateStr = localTime.toISOString().split('T')[0];  // 'YYYY-MM-DD'

// Check in database
const { data: holiday } = await supabase
  .from('public_holidays')
  .select('*')
  .eq('country_code', userCountry)
  .eq('holiday_date', dateStr)
  .single();

if (holiday) {
  const nextBusinessDay = getNextBusinessDay(localTime, userCountry);
  return { can_send: false, reschedule_to: nextBusinessDay, reason: holiday.holiday_name };
}
```

---

## 5. Reply Detection

**Rule:** If prospect replied, stop sending follow-ups

**Database Check:**
```sql
-- Check if prospect has replied
SELECT status
FROM campaign_prospects
WHERE id = 'prospect_id';

-- If status = 'replied', stop sequence
```

**Implementation in N8N:**

Add this node before EACH follow-up (FU1-6):

```javascript
// Node: "Check if Prospect Replied"
const prospectId = $node['Extract Message ID'].json.prospect_id;

const supabase_url = $env.NEXT_PUBLIC_SUPABASE_URL;
const supabase_key = $env.SUPABASE_SERVICE_ROLE_KEY;

const response = await fetch(
  `${supabase_url}/rest/v1/campaign_prospects?id=eq.${prospectId}&select=status`,
  {
    headers: {
      'apikey': supabase_key,
      'Authorization': `Bearer ${supabase_key}`
    }
  }
);

const data = await response.json();
const status = data[0]?.status;

if (status === 'replied') {
  console.log('⏸️ Prospect has replied - ending sequence');
  return [{
    json: {
      prospect_id: prospectId,
      action: 'end_sequence',
      reason: 'prospect_replied'
    }
  }];
}

// Continue with send
return [{
  json: {
    ...$input.item.json,
    action: 'continue',
    status: status
  }
}];
```

---

## 6. Message Randomization

**Purpose:** Avoid spam detection by randomizing send times

**Strategy:**
- Instead of sending at exactly 8:00 AM, send between 8:00-10:00 AM
- Randomize within 2-hour window
- Different random time for each prospect

**Implementation:**
```javascript
// Add random delay to base wait time
const baseWaitHours = 6;  // FU1 after 6 hours
const randomMinutes = Math.floor(Math.random() * 120);  // 0-120 minutes (0-2 hours)
const totalWaitMinutes = (baseWaitHours * 60) + randomMinutes;

// Convert to hours for N8N
const waitHours = Math.floor(totalWaitMinutes / 60);
const waitMinutes = totalWaitMinutes % 60;

return [{
  json: {
    wait_amount: waitHours,
    wait_unit: 'hours',
    extra_wait_minutes: waitMinutes,
    message: `Waiting ${waitHours}h ${waitMinutes}m (randomized)`
  }
}];
```

**OR - More sophisticated:**
```javascript
// Calculate next valid send window
const userTimezone = 'Europe/Paris';
const businessHoursStart = 8;   // 8am
const businessHoursEnd = 18;    // 6pm

// Get current time in user's timezone
const now = new Date();
const localTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
const hour = localTime.getHours();

// If before business hours, schedule for 8am-10am today
// If during business hours, schedule for random time in next 2 hours
// If after business hours, schedule for 8am-10am tomorrow

function getRandomSendTime(localTime, timezone) {
  const hour = localTime.getHours();

  if (hour < businessHoursStart) {
    // Schedule for 8am-10am today
    const randomHour = 8 + Math.floor(Math.random() * 2);
    const randomMinute = Math.floor(Math.random() * 60);
    localTime.setHours(randomHour, randomMinute, 0, 0);
    return localTime;
  }

  if (hour >= businessHoursEnd) {
    // Schedule for 8am-10am tomorrow
    localTime.setDate(localTime.getDate() + 1);
    const randomHour = 8 + Math.floor(Math.random() * 2);
    const randomMinute = Math.floor(Math.random() * 60);
    localTime.setHours(randomHour, randomMinute, 0, 0);
    return localTime;
  }

  // During business hours - send within next 1-2 hours
  const hoursToAdd = 1 + Math.random();  // 1.0 to 2.0 hours
  localTime.setTime(localTime.getTime() + (hoursToAdd * 60 * 60 * 1000));
  return localTime;
}
```

---

## Recommended Implementation Approach

### Option A: Simple (N8N Only)

**What to check:**
1. Reply status (before each FU)
2. Business hours (8am-6pm UTC as default)
3. Add random delay (±30 minutes)

**Pros:**
- Quick to implement
- All logic in N8N

**Cons:**
- No timezone support
- No holiday checking
- Hard to maintain

---

### Option B: Hybrid (N8N + API Helper)

**Create API endpoint:** `POST /api/campaigns/validate-send-time`

**Request:**
```json
{
  "prospectId": "uuid",
  "campaignId": "uuid",
  "messageType": "fu1"
}
```

**Response:**
```json
{
  "can_send": false,
  "reason": "outside_business_hours",
  "next_valid_time": "2025-11-02T08:15:00Z",
  "wait_hours": 14,
  "message": "Rescheduling to 8:15 AM Paris time"
}
```

**N8N calls this before each FU:**
```javascript
// Node: Validate Send Time
const validation = await fetch('https://app.meet-sam.com/api/campaigns/validate-send-time', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prospectId: $json.prospect_id,
    campaignId: $json.campaign_id,
    messageType: 'fu1'
  })
});

const result = await validation.json();

if (!result.can_send) {
  // Add dynamic wait
  return [{
    json: {
      should_wait: true,
      wait_hours: result.wait_hours,
      reason: result.reason
    }
  }];
}

// Proceed with send
return [{
  json: {
    ...$input.item.json,
    should_wait: false
  }
}];
```

**Pros:**
- Full timezone/holiday support
- Easy to test and maintain
- Can update logic without N8N changes

**Cons:**
- Requires API endpoint
- More API calls

---

### Option C: Database-Driven (Recommended)

**Store send rules in database:**

```sql
CREATE TABLE campaign_send_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Timezone settings
  timezone VARCHAR(100) DEFAULT 'UTC',
  business_hours_start INTEGER DEFAULT 8,
  business_hours_end INTEGER DEFAULT 18,

  -- Weekend/holiday settings
  send_on_weekends BOOLEAN DEFAULT false,
  respect_holidays BOOLEAN DEFAULT true,
  country_code VARCHAR(2) DEFAULT 'US',

  -- Randomization
  randomize_send_time BOOLEAN DEFAULT true,
  randomization_window_minutes INTEGER DEFAULT 120,  -- ±2 hours

  -- Reply handling
  stop_on_reply BOOLEAN DEFAULT true,
  stop_on_not_interested BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Then N8N reads these rules and applies them.**

---

## Implementation Checklist

### Phase 1: Basic (Now)
- [ ] Add reply-check before each FU (FU1-6)
- [ ] Stop sequence if status = 'replied'
- [ ] Add basic randomization (±30 min)

### Phase 2: Timezone Support (Next)
- [ ] Add timezone to campaigns table
- [ ] Validate business hours in user timezone
- [ ] Skip weekends

### Phase 3: Holidays (Later)
- [ ] Create public_holidays table
- [ ] Seed with 2025 holidays
- [ ] Check holidays before sending

### Phase 4: Advanced (Future)
- [ ] Per-campaign send rules
- [ ] A/B test send times
- [ ] Machine learning optimal send times

---

## Files to Update

1. **N8N Workflow:** `n8n-workflows/campaign-execute-complete.json`
   - Add reply-check nodes before each FU
   - Add send-time validation nodes
   - Add dynamic wait nodes

2. **Database Migration:** `supabase/migrations/20251101_add_send_rules.sql`
   - Add timezone to campaigns
   - Create public_holidays table
   - Create campaign_send_rules table

3. **API Endpoint:** `app/api/campaigns/validate-send-time/route.ts`
   - Validate timezone
   - Check business hours
   - Check holidays
   - Check reply status
   - Return wait time

---

## Questions to Resolve

1. **Timezone source?**
   - Per-campaign setting?
   - Per-workspace setting?
   - Per-user setting?

2. **Holiday calendar?**
   - Which countries to support initially?
   - Who maintains the calendar?

3. **Randomization window?**
   - ±30 minutes?
   - ±2 hours?
   - Configurable?

4. **Retry logic?**
   - If all prospects need rescheduling, does scheduler try again?
   - How often does scheduler check?

---

**Status:** Awaiting decision on implementation approach (A, B, or C)
**Priority:** High (affects deliverability and compliance)
**Estimate:**
- Option A: 2-4 hours
- Option B: 4-8 hours
- Option C: 8-16 hours
