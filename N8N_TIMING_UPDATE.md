# N8N Workflow - Dynamic Timing Update Required

## Issue Discovered

The current workflow has **hardcoded wait times** but should use **user-configured timing** from the campaign settings.

## Current (Wrong)
```javascript
// Hardcoded in workflow
"amount": "={{Math.floor(Math.random() * 24) + 24}}"  // 24-48 hours
```

## Should Be (Correct)
```javascript
// From payload timing object
"amount": "={{$node['Split Prospects'].json.timing.fu1_delay_days * 24}}"  // User-configured days → hours
```

---

## Payload Structure

```javascript
{
  "prospects": [...],
  "campaign": {...},
  "messages": {
    "cr": "...",
    "fu1": "...",
    ...
  },
  "timing": {
    "fu1_delay_days": 2,   // Configurable by user
    "fu2_delay_days": 5,   // Configurable by user
    "fu3_delay_days": 7,   // Configurable by user
    "fu4_delay_days": 5,   // Configurable by user
    "gb_delay_days": 7     // Configurable by user
  }
}
```

## Standard Funnel Defaults

From `flow_settings`:
- **`connection_wait_hours`**: 36 hours (wait after CR before checking connection)
- **`followup_wait_days`**: 5 days (default for all follow-ups)

## Required Changes

### 1. Update Split Prospects Node
```javascript
// OLD:
return prospects.map(prospect => ({
  json: { prospect, campaign, messages }
}));

// NEW:
const timing = $input.item.json.timing || {
  fu1_delay_days: 2,
  fu2_delay_days: 5,
  fu3_delay_days: 7,
  fu4_delay_days: 5,
  gb_delay_days: 7
};

return prospects.map(prospect => ({
  json: { prospect, campaign, messages, timing }
}));
```

### 2. Update All Wait Nodes

**Wait 24-48 Hours** → **Wait for Connection Check**
```javascript
// Convert connection_wait_hours to hours (or use 36 default)
"amount": "={{$node['Split Prospects'].json.timing.connection_wait_hours || 36}}"
"unit": "hours"
```

**Wait 48-72 Hours** → **Wait for FU2**
```javascript
// Convert fu2_delay_days to hours
"amount": "={{($node['Split Prospects'].json.timing.fu2_delay_days || 5) * 24}}"
"unit": "hours"
```

**Wait 72-96 Hours** → **Wait for FU3**
```javascript
"amount": "={{($node['Split Prospects'].json.timing.fu3_delay_days || 7) * 24}}"
"unit": "hours"
```

**Wait 96-120 Hours** → **Wait for FU4**
```javascript
"amount": "={{($node['Split Prospects'].json.timing.fu4_delay_days || 5) * 24}}"
"unit": "hours"
```

**Wait 120-144 Hours** → **Wait for FU5**
```javascript
"amount": "={{($node['Split Prospects'].json.timing.fu5_delay_days || 5) * 24}}"
"unit": "hours"
```

**Wait 168-192 Hours** → **Wait for Goodbye**
```javascript
"amount": "={{($node['Split Prospects'].json.timing.gb_delay_days || 7) * 24}}"
"unit": "hours"
```

---

## Example Timeline with Standard Funnel (5 days)

```
Day 0:   CR sent
Day 1.5: Wait 36 hours (connection check)
         [Check if connection accepted]
Day 1.5: FU1 sent (if accepted)
Day 6.5: Wait 5 days (120 hours)
Day 6.5: FU2 sent
Day 11.5: Wait 5 days
Day 11.5: FU3 sent
Day 16.5: Wait 5 days
Day 16.5: FU4 sent
Day 21.5: Wait 5 days
Day 21.5: FU5 sent
Day 26.5: Wait 5 days
Day 26.5: Goodbye sent
```

**Total:** ~27 days (vs 30 days with hardcoded timing)

---

## Why This Matters

1. **User Control**: Users select funnel timing when creating campaign
2. **A/B Testing**: Can test different timing strategies
3. **Industry Variation**: B2C vs B2B may need different cadences
4. **Compliance**: Some industries require longer wait times

---

## Implementation Status

- ❌ Current workflow: Hardcoded timing
- ✅ API payload: Includes timing object
- ⏳ Workflow update: In progress

---

## Next Steps

1. Update `campaign-execute-complete.json`:
   - Modify Split Prospects to include timing
   - Update all 6 Wait nodes to use dynamic timing
   - Keep defaults for backwards compatibility

2. Test with standard funnel (5 days)

3. Test with custom timing (2, 3, 7 day variations)

