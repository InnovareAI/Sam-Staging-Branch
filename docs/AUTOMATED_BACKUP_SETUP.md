# Automated Backup System

**Date:** October 10, 2025
**Status:** ✅ Ready to Deploy

---

## Overview

Automated backup system for SAM AI platform with triple-layer protection:
1. **Airtable** - Visual backup of critical tables
2. **Git** - Code and configuration snapshots
3. **SQL Dump** - Full database exports (optional)

---

## Quick Setup

### 1. Install the Cron Job

```bash
./scripts/setup-backup-cron.sh
```

**Choose frequency:**
- **Daily at 2:00 AM** ← Recommended for production
- **Every 6 hours** ← High-frequency for critical operations
- **Daily (Git only)** ← Lightweight, tracks changes only
- **Weekly** ← Minimal overhead
- **Custom** ← Define your own schedule

### 2. Manual Backup Anytime

```bash
# Standard backup (Airtable + Git)
./scripts/auto-backup.sh

# With SQL dump
./scripts/auto-backup.sh --sql-dump

# Git only (skip Airtable)
./scripts/auto-backup.sh --skip-airtable

# Airtable only (skip Git)
./scripts/auto-backup.sh --skip-git
```

---

## What Gets Backed Up

### 📦 Airtable Backup
**Tables:**
- `workspace_accounts` - LinkedIn/Email account connections
- `workspace_members` - Team access control
- `users` - User profiles

**Location:** Your Airtable base (visual, searchable)

### 📝 Git Backup
**Snapshots:**
- Application code state
- Configuration files
- Migration history

**Location:** Local Git repository (`.git/`)

### 💾 SQL Dump (Optional)
**Full database export:**
- All tables
- All data
- Point-in-time recovery

**Location:** `/backups/backup_YYYYMMDD_HHMMSS.sql`
**Retention:** Last 10 dumps kept

---

## Backup Schedule Examples

### Production (Recommended)
```bash
# Daily at 2:00 AM
0 2 * * * /path/to/auto-backup.sh
```

**Pros:**
- ✅ Minimal overhead
- ✅ Captures end-of-day state
- ✅ Low server load

### High-Frequency
```bash
# Every 6 hours
0 */6 * * * /path/to/auto-backup.sh
```

**Pros:**
- ✅ Better recovery granularity
- ✅ Captures intra-day changes

**Cons:**
- ⚠️ Higher API usage (Airtable)

### Lightweight
```bash
# Daily Git commits only
0 2 * * * /path/to/auto-backup.sh --skip-airtable
```

**Pros:**
- ✅ No external dependencies
- ✅ Fast execution

---

## Monitoring Backups

### View Logs
```bash
# Live log tail
tail -f backups/cron.log

# Last 50 lines
tail -n 50 backups/cron.log

# Search for errors
grep -i "error\|failed" backups/cron.log
```

### Check Backup Files
```bash
# List SQL backups
ls -lh backups/backup_*.sql

# Show latest backup
ls -t backups/backup_*.sql | head -1
```

### View Airtable Backups
Open: `https://airtable.com/[YOUR_BASE_ID]`

---

## Managing Cron Jobs

### View Current Jobs
```bash
crontab -l
```

### Edit Cron Jobs
```bash
crontab -e
```

### Remove SAM Backup Jobs
```bash
crontab -l | grep -v 'SAM AI Auto Backup' | grep -v 'auto-backup.sh' | crontab -
```

### Remove ALL Cron Jobs (⚠️ Use with caution)
```bash
crontab -r
```

---

## Environment Variables Required

Make sure `.env.local` contains:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_PASSWORD=your-db-password  # Only for SQL dumps

# Airtable (optional but recommended)
AIRTABLE_API_KEY=keyXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

---

## Backup Storage Locations

| Type | Location | Retention |
|------|----------|-----------|
| Airtable | External cloud | Unlimited (until manually deleted) |
| Git commits | `.git/` | Unlimited (local repository) |
| SQL dumps | `backups/*.sql` | Last 10 files |
| Logs | `backups/cron.log` | Unlimited (rotate manually) |

---

## Disaster Recovery

### Restore from Airtable
1. Access Airtable backup base
2. Filter by "Restore Point" or "Backup Timestamp"
3. Export to CSV
4. Import to Supabase using migration script

### Restore from SQL Dump
```bash
# Find backup file
ls -t backups/backup_*.sql | head -1

# Restore to Supabase
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.latxadqrvrrrcvkktrog \
  -d postgres \
  -f backups/backup_YYYYMMDD_HHMMSS.sql
```

### Restore from Git
```bash
# List restore points
git log --oneline | grep "Auto-backup"

# Restore specific commit
git checkout <commit-hash>

# Or create new branch from backup
git checkout -b restore-from-backup <commit-hash>
```

---

## Troubleshooting

### Cron Job Not Running

**Check if cron is enabled (macOS):**
```bash
sudo launchctl list | grep cron
```

**If not running:**
```bash
sudo launchctl load -w /System/Library/LaunchDaemons/com.vix.cron.plist
```

### Permission Errors

**Make scripts executable:**
```bash
chmod +x scripts/auto-backup.sh
chmod +x scripts/setup-backup-cron.sh
```

### Airtable Connection Failed

**Check credentials:**
```bash
# Test Airtable connection
node -e "
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
base('Backup Metadata').select({ maxRecords: 1 }).all().then(() => console.log('✅ Connected')).catch(err => console.log('❌', err.message));
"
```

### SQL Dump Failed

**Install PostgreSQL client:**
```bash
brew install postgresql
```

**Verify connection:**
```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.latxadqrvrrrcvkktrog \
  -d postgres \
  -c "SELECT version();"
```

---

## macOS-Specific Notes

### Full Disk Access (if needed)

If cron can't access files:
1. Open **System Preferences** → **Security & Privacy**
2. Go to **Privacy** tab
3. Select **Full Disk Access**
4. Click **+** and add `/usr/sbin/cron`

### Notification on Failure

Add to cron for email alerts (requires mailutils):
```bash
0 2 * * * /path/to/auto-backup.sh || echo "Backup failed!" | mail -s "SAM Backup Alert" you@example.com
```

---

## Advanced Configuration

### Backup to Multiple Locations

**S3 Backup (AWS):**
```bash
# In auto-backup.sh, add:
aws s3 cp backups/backup_$TIMESTAMP.sql s3://your-bucket/sam-backups/
```

**Remote Server:**
```bash
# In auto-backup.sh, add:
scp backups/backup_$TIMESTAMP.sql user@remote:/backups/
```

### Encrypted Backups

```bash
# Encrypt SQL dump
gpg --encrypt --recipient your@email.com backups/backup_$TIMESTAMP.sql

# Decrypt
gpg --decrypt backups/backup_$TIMESTAMP.sql.gpg > restored.sql
```

---

## Security Best Practices

- ✅ Never commit `.env.local` to Git (already in `.gitignore`)
- ✅ Rotate Airtable API keys quarterly
- ✅ Use read-only Supabase keys for backups (when possible)
- ✅ Encrypt backups if storing remotely
- ✅ Test restore process monthly
- ✅ Keep backup logs for audit trail

---

## Backup Checklist

**Weekly:**
- [ ] Check cron logs for errors
- [ ] Verify latest Airtable backup timestamp
- [ ] Confirm SQL dumps are being created

**Monthly:**
- [ ] Test restore from Airtable
- [ ] Test restore from SQL dump
- [ ] Review backup storage size
- [ ] Rotate old backups

**Quarterly:**
- [ ] Update backup documentation
- [ ] Review and update retention policies
- [ ] Audit backup security

---

## Support

**Files:**
- Backup script: `/scripts/auto-backup.sh`
- Setup script: `/scripts/setup-backup-cron.sh`
- Airtable script: `/scripts/backup-to-airtable.cjs`

**Logs:**
- Cron log: `/backups/cron.log`
- Backup log: `/backups/backup.log`

**Documentation:**
- This file: `/docs/AUTOMATED_BACKUP_SETUP.md`
- Airtable setup: `/docs/ACTIVECAMPAIGN_ONBOARDING_SETUP.md`

---

**Last Updated:** October 10, 2025
**Status:** ✅ Production Ready
