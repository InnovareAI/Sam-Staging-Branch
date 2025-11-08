# URGENT: Debug Campaign Not Showing

## Open Browser Console (F12) and send me:

1. Look for log message starting with: `🔍 CampaignHub Debug:`
2. Send me that entire log output

3. Also run this in the console and send me the result:

```javascript
fetch('/api/campaigns?workspace_id=014509ba-226e-43ee-ba58-ab5f20d2ed08')
  .then(r => r.json())
  .then(console.log)
```

This will tell me exactly what the API is returning.
