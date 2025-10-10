# SAM AI - Automated Backups

**Status:** ✅ **ACTIVE - Running every 6 hours**

---

## Current Backup Schedule

**Frequency:** Every 6 hours
**Times:** 12:00 AM, 6:00 AM, 12:00 PM, 6:00 PM (daily)

**What gets backed up:**
1. ✅ **Database → Airtable** (workspace_accounts, workspace_members, users)
2. ✅ **Code → Git** (full repository snapshot with commit)

---

## Backup Locations

### 1. Airtable (Database Backup)
**URL:** https://airtable.com/appOtsfn60HFeTpnn

**Tables:**
- Workspace Accounts (LinkedIn/Email connections)
- Workspace Members (Team access)
- Users (User profiles)
- Backup Metadata (Backup history)

**Retention:** Unlimited (manual cleanup)

### 2. Git (Code Backup)
**Location:** Local `.git/` repository

**View backups:**
```bash
git log --oneline --grep="Auto-backup"
```

**Restore from backup:**
```bash
# See backup history
git log --oneline --grep="Auto-backup" -10

# Restore specific backup
git checkout <commit-hash>
```

**Retention:** Unlimited (in Git history)

### 3. SQL Dumps (Optional)
**Location:** This directory (`backups/`)

**Files:** `backup_YYYYMMDD_HHMMSS.sql`
**Retention:** Last 10 files

---

## Monitoring

### View Backup Logs
```bash
# Live tail
tail -f backups/cron.log

# Last 50 lines
tail -n 50 backups/cron.log

# Check for errors
grep -i "error\|failed" backups/cron.log
```

### Check Last Backup
```bash
# View cron log
tail backups/cron.log

# Check Airtable
open https://airtable.com/appOtsfn60HFeTpnn

# Check Git commits
git log --oneline --grep="Auto-backup" -1
```

---

## Manual Backup Commands

### Standard Backup (Airtable + Git)
```bash
./scripts/auto-backup.sh
```

### With SQL Dump
```bash
./scripts/auto-backup.sh --sql-dump
```

### Database Only (skip Git)
```bash
./scripts/auto-backup.sh --skip-git
```

### Git Only (skip Airtable)
```bash
./scripts/auto-backup.sh --skip-airtable
```

---

## Cron Job Management

### View Current Schedule
```bash
crontab -l
```

### Edit Schedule
```bash
crontab -e
```

### Disable Backups
```bash
crontab -l | grep -v "auto-backup.sh" | crontab -
```

### Re-enable Backups
```bash
./scripts/setup-backup-cron.sh
```

---

## Disaster Recovery

### Restore from Airtable
1. Go to https://airtable.com/appOtsfn60HFeTpnn
2. Filter by "Backup Timestamp" or "Restore Point"
3. Export table to CSV
4. Import to Supabase via admin panel

### Restore from Git
```bash
# View backup commits
git log --oneline --grep="Auto-backup"

# Create restore branch from specific backup
git checkout -b restore-point <commit-hash>

# Or just view files from backup
git show <commit-hash>:path/to/file
```

### Restore from SQL Dump
```bash
# Find latest backup
ls -t backups/backup_*.sql | head -1

# Restore to Supabase
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.latxadqrvrrrcvkktrog \
  -d postgres \
  -f backups/backup_YYYYMMDD_HHMMSS.sql
```

---

## Backup Statistics

**Current Stats:**
- Database records backed up: ~48 records per backup
- Tables: 3 critical tables
- Backup frequency: 4 times per day
- Daily backups: 4
- Monthly backups: ~120
- Storage growth: ~5MB per month (Git)

---

## Troubleshooting

### Cron Not Running

**Check cron service (macOS):**
```bash
sudo launchctl list | grep cron
```

**Restart cron:**
```bash
sudo launchctl kickstart -k system/com.vix.cron
```

### Permission Denied

**Make script executable:**
```bash
chmod +x scripts/auto-backup.sh
```

### Airtable Sync Failing

**Check credentials:**
```bash
echo "API Key: ${AIRTABLE_API_KEY:0:10}..."
echo "Base ID: ${AIRTABLE_BASE_ID}"
```

**Test connection:**
```bash
node scripts/backup-to-airtable.cjs "test-backup"
```

### Git Commits Failing

**Check Git config:**
```bash
git config user.name
git config user.email
```

**Set if missing:**
```bash
git config user.name "SAM Backup Bot"
git config user.email "backup@meet-sam.com"
```

---

## Security

- ✅ Backup logs don't contain sensitive data
- ✅ `.env.local` never committed to Git
- ✅ Airtable API key secured
- ✅ SQL dumps contain data (keep secure)
- ⚠️ Git repository contains code only (no secrets)

---

## Support Files

- Backup script: `/scripts/auto-backup.sh`
- Setup script: `/scripts/setup-backup-cron.sh`
- Airtable script: `/scripts/backup-to-airtable.cjs`
- Documentation: `/docs/AUTOMATED_BACKUP_SETUP.md`

---

**Last Updated:** October 10, 2025
**Status:** ✅ Active and Running
**Next Backup:** Check `crontab -l` for schedule
