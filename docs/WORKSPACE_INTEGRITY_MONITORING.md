# Workspace Integrity Monitoring

## Overview
Automated monitoring system to detect and alert on workspace data integrity issues every 12 hours.

---

## What It Checks

The monitoring system performs 5 critical checks:

1. **Orphaned Workspace Memberships** 🔴 CRITICAL
   - Detects workspace_members records pointing to non-existent workspaces
   - Could cause users to be unable to access the system

2. **Invalid User References** 🔴 CRITICAL
   - Detects workspace memberships for users that don't exist in auth.users
   - Prevents ghost members in workspaces

3. **Users Without Workspace Memberships** 🟡 WARNING
   - Finds users who have no workspace associations
   - Could indicate incomplete signup process

4. **Users Without Profiles** 🟡 WARNING
   - Detects auth.users without corresponding users table records
   - May cause profile-related features to fail

5. **Invalid Current Workspace References** 🟡 WARNING
   - Finds users with current_workspace_id set to workspaces they're not members of
   - Could cause workspace switching issues

---

## Installation

### 1. Test the Script Manually

```bash
# Run the monitoring script once to test
npm run monitor:workspace-integrity

# Or run directly
npx tsx scripts/monitor-workspace-integrity.ts
```

### 2. Set Up Cron Job (Automated)

**Option A: Using crontab (macOS/Linux)**

```bash
# Open crontab editor
crontab -e

# Add this line to run every 12 hours (at 6 AM and 6 PM)
0 6,18 * * * cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7 && ./scripts/monitor-workspace-integrity.sh >> /tmp/workspace-monitor.log 2>&1
```

**Option B: Using launchd (macOS - Recommended)**

Create: `~/Library/LaunchAgents/com.innovareai.workspace-monitor.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.innovareai.workspace-monitor</string>

    <key>ProgramArguments</key>
    <array>
        <string>/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/monitor-workspace-integrity.sh</string>
    </array>

    <key>StartCalendarInterval</key>
    <array>
        <dict>
            <key>Hour</key>
            <integer>6</integer>
            <key>Minute</key>
            <integer>0</integer>
        </dict>
        <dict>
            <key>Hour</key>
            <integer>18</integer>
            <key>Minute</key>
            <integer>0</integer>
        </dict>
    </array>

    <key>StandardOutPath</key>
    <string>/tmp/workspace-monitor.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/workspace-monitor-error.log</string>

    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
```

Then load it:
```bash
launchctl load ~/Library/LaunchAgents/com.innovareai.workspace-monitor.plist
```

**Option C: Using systemd (Linux Production)**

Create: `/etc/systemd/system/workspace-monitor.service`

```ini
[Unit]
Description=SAM AI Workspace Integrity Monitor
After=network.target

[Service]
Type=oneshot
User=your-user
WorkingDirectory=/path/to/Sam-New-Sep-7
ExecStart=/path/to/Sam-New-Sep-7/scripts/monitor-workspace-integrity.sh
StandardOutput=journal
StandardError=journal
```

Create timer: `/etc/systemd/system/workspace-monitor.timer`

```ini
[Unit]
Description=Run workspace integrity check every 12 hours

[Timer]
OnCalendar=*-*-* 06,18:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo systemctl enable workspace-monitor.timer
sudo systemctl start workspace-monitor.timer
```

---

## Logs

Logs are saved to: `logs/workspace-integrity/check-YYYYMMDD-HHMMSS.log`

**Automatic log rotation:** Logs older than 30 days are automatically deleted.

**View recent logs:**
```bash
# View latest log
ls -t logs/workspace-integrity/*.log | head -1 | xargs cat

# View last 5 checks
ls -t logs/workspace-integrity/*.log | head -5
```

---

## Email Alerts (Optional)

To receive email alerts when issues are detected, edit `scripts/monitor-workspace-integrity.sh`:

Uncomment and configure the email line:
```bash
if [ $EXIT_CODE -ne 0 ]; then
  # Send email alert
  mail -s "SAM AI: Workspace Integrity Issues Detected" admin@innovareai.com < "$LOG_FILE"
fi
```

**Requirements:**
- Install `mailutils` or configure `sendmail`
- Or use a service like SendGrid, Postmark, etc.

**Example using Postmark API:**
```bash
if [ $EXIT_CODE -ne 0 ]; then
  curl "https://api.postmarkapp.com/email" \
    -X POST \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-Postmark-Server-Token: YOUR_TOKEN" \
    -d "{
      \"From\": \"monitor@innovareai.com\",
      \"To\": \"admin@innovareai.com\",
      \"Subject\": \"SAM AI: Workspace Integrity Issues\",
      \"TextBody\": \"$(cat $LOG_FILE)\"
    }"
fi
```

---

## Manual Checks

Run the integrity check anytime:

```bash
# Quick check
npm run monitor:workspace-integrity

# With full output
npx tsx scripts/monitor-workspace-integrity.ts

# Save to specific log file
npm run monitor:workspace-integrity > my-check.log 2>&1
```

---

## Exit Codes

- `0` - All checks passed, no issues found
- `1` - Issues detected (critical or warnings)

---

## Interpreting Results

### ✅ Success Output
```
🔍 Workspace Integrity Check
📅 2025-10-13T15:30:00.000Z
────────────────────────────────────────────────────────────────────────────────

📊 Data Summary:
   Workspace Memberships: 23
   Workspaces: 6
   Auth Users: 15
   User Profiles: 15

🔎 Check 1: Orphaned Workspace Memberships
   ✅ No orphaned memberships found
🔎 Check 2: Invalid User References
   ✅ No invalid user references found
🔎 Check 3: Users Without Workspace Memberships
   ✅ All users have workspace memberships
🔎 Check 4: Users Without Profiles
   ✅ All users have profiles
🔎 Check 5: Invalid Current Workspace References
   ✅ All current workspace references are valid

────────────────────────────────────────────────────────────────────────────────
✅ ALL CHECKS PASSED - No integrity issues found!
```

### ⚠️ Issues Detected
```
⚠️  INTEGRITY ISSUES DETECTED

🔴 Critical Issues: 2
🟡 Warnings: 1

🔴 CRITICAL ISSUES:

1. ORPHANED_MEMBERSHIP
   User user@example.com has membership to non-existent workspace abc-123
   Email: user@example.com
   User ID: def-456
   Workspace ID: abc-123

2. INVALID_USER
   Workspace "Example Corp" has membership for non-existent user ghi-789
   Workspace: Example Corp
   Workspace ID: jkl-012

🟡 WARNINGS:

1. NO_MEMBERSHIP
   User newuser@example.com has no workspace memberships
   Email: newuser@example.com
```

---

## Troubleshooting

### Script won't run
```bash
# Check permissions
ls -la scripts/monitor-workspace-integrity.sh

# Make executable if needed
chmod +x scripts/monitor-workspace-integrity.sh
```

### Environment variables not loaded
```bash
# Ensure .env.local exists
ls -la .env.local

# Test environment variables
source .env.local && echo $NEXT_PUBLIC_SUPABASE_URL
```

### Cron job not running
```bash
# Check cron service (Linux)
sudo systemctl status cron

# View cron logs (macOS)
tail -f /var/log/system.log | grep cron

# Test the script manually
./scripts/monitor-workspace-integrity.sh
```

---

## Maintenance

### Disable Monitoring
```bash
# Crontab
crontab -e
# Comment out or remove the line

# launchd (macOS)
launchctl unload ~/Library/LaunchAgents/com.innovareai.workspace-monitor.plist

# systemd (Linux)
sudo systemctl stop workspace-monitor.timer
sudo systemctl disable workspace-monitor.timer
```

### Change Schedule

Edit the cron expression or timer configuration:
- **Every 6 hours:** `0 */6 * * *` (cron) or `OnCalendar=*-*-* 00/6:00:00` (systemd)
- **Every 24 hours:** `0 0 * * *` (cron) or `OnCalendar=daily` (systemd)
- **Weekly:** `0 0 * * 0` (cron) or `OnCalendar=weekly` (systemd)

---

## Package.json Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "monitor:workspace-integrity": "tsx scripts/monitor-workspace-integrity.ts",
    "monitor:workspace-integrity:shell": "./scripts/monitor-workspace-integrity.sh"
  }
}
```

---

## Production Deployment

For production servers, use systemd timers (Linux) or equivalent:

1. Copy scripts to production server
2. Set up systemd timer (see Option C above)
3. Configure email alerts
4. Monitor logs via centralized logging (e.g., CloudWatch, Datadog)

**Integration with monitoring services:**
- Send metrics to Datadog/NewRelic on each run
- Create alerts based on exit codes
- Dashboard for integrity check history
