# ⛔ DANGER - DO NOT RUN THESE SCRIPTS ⛔

These scripts send REAL LinkedIn connection requests!

## What Happened

Someone ran `test-charissa-account.mjs` which sent a connection request to **Jamshaid Ali** 
with the message "Hi Nolan, test from Irish account" - wrong name, real invitation!

## Why These Are Dangerous

- They send REAL invitations from production LinkedIn accounts
- They use hardcoded messages that may have wrong names
- They can damage your LinkedIn account reputation
- They cannot be undone

## If You Need To Test

Use the production campaign execution API `/api/campaigns/direct/send-connection-requests`  
with a test campaign and prospects you control.

**NEVER run these scripts again!**
