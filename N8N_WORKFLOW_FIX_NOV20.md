# N8N Workflow Fix - November 20, 2025

## Problem Identified

**Error:** `getaddrinfo EAI_AGAIN https`

**Root Cause:** N8N workflow was constructing Unipile API URLs incorrectly.

### Broken URL Pattern:
```json
"url": "={{ 'https://' + $env.UNIPILE_DSN }}/api/v1/users/invite"
```

This created malformed URLs because the closing `}}` was in the wrong place, causing DNS resolution to fail on "https" instead of the full URL.

---

## The Fix

### Fixed 12 Nodes:
1. **Send CR** - Connection request sender
2. **Send Acceptance Message** - Post-connection message
3. **Check Reply FU1** - Follow-up 1 reply check
4. **Send FU1** - Follow-up 1 sender
5. **Check Reply FU2** - Follow-up 2 reply check
6. **Send FU2** - Follow-up 2 sender
7. **Check Reply FU3** - Follow-up 3 reply check
8. **Send FU3** - Follow-up 3 sender
9. **Check Reply FU4** - Follow-up 4 reply check
10. **Send FU4** - Follow-up 4 sender
11. **Check Reply GB** - Goodbye reply check
12. **Send GB (Breakup)** - Goodbye message sender

### Correct URL Pattern:
```json
"url": "={{ 'https://' + $env.UNIPILE_DSN + '/api/v1/users/invite' }}"
```

All `/api/v1/` paths are now properly concatenated inside the expression.

---

## Upload Instructions

1. **Go to N8N:** https://workflows.innovareai.com
2. **Open workflow:** "SAM Master Campaign Orchestrator" (ID: aVG6LC4ZFRMN7Bw6)
3. **Settings menu** → **Import from File**
4. **Select file:** `~/Downloads/SAM Master Campaign Orchestrator - FIXED.json`
5. **Replace** existing workflow
6. **Save and Activate**

---

## Test After Upload

Run the test prospect script:
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
node scripts/send-scheduled-prospects-cron.mjs
```

**Expected result:**
- Alexander W. should receive a connection request from Charissa's LinkedIn
- Database status changes to `connection_request_sent`
- Check Charissa's LinkedIn → My Network → Invitations → Sent

---

## Next Steps After Successful Test

1. **Update all prospects to queued:**
   ```bash
   node scripts/queue-all-charissa-prospects.mjs  # (to be created)
   ```

2. **Install cron job:**
   ```bash
   (crontab -l 2>/dev/null; echo "* * * * * cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7 && node scripts/send-scheduled-prospects-cron.mjs >> /tmp/send-cron.log 2>&1") | crontab -
   ```

3. **Monitor:**
   ```bash
   tail -f /tmp/send-cron.log
   ```

---

## Files

- **Original (broken):** `/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator.json`
- **Fixed (ready):** `/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - FIXED.json`
- **Backup in repo:** `n8n-workflow-fixed-v2.json`

---

**Status:** ✅ Ready to upload
**Date:** November 20, 2025 06:24 AM
