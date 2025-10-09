# How to Use Your Supabase Pro Backups

## ✅ You Already Have This!

Your Supabase Pro plan includes:
- ✅ Daily automatic backups (7 days retention)
- ✅ Point-in-Time Recovery (PITR) - Last 7 days
- ✅ One-click restore
- ✅ Download backups

**You've been paying for this - let's use it!**

---

## 🎯 How Today's Issue Could Have Been Prevented

### What Happened:
```
1. Used restore-point to revert code
2. Database kept running forward
3. Lost workspace_accounts associations
4. Had to manually recreate Jennifer & Irish's accounts
5. Total time: ~2 hours
```

### What Should Have Happened (with PITR):
```
1. Used restore-point to revert code
2. Used Supabase PITR to restore database
3. Both code + data back in sync
4. Total time: ~5 minutes
```

---

## 📱 How to Access Your Backups

### Step 1: Open Supabase Dashboard
```
https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
```

### Step 2: Navigate to Backups
```
Settings → Database → Backups tab
```

You should see:
- **Daily backups** list (last 7 days)
- **Point-in-Time Recovery** option
- **Download backup** buttons

---

## 🔄 How to Use Point-in-Time Recovery (PITR)

### When to Use:
- Before/after restore points
- After bad database migrations
- After accidental deletions
- After incorrect updates

### How to Restore:

**1. Identify the Time**
```
Example: "Restore to 10 minutes before I used restore-point"

Today's incident:
- Restore point used: ~2:30 PM Oct 10
- Want database state: 2:20 PM Oct 10
```

**2. In Supabase Dashboard:**
```
Settings → Database → Backups
→ Click "Point-in-Time Recovery"
→ Select date: October 10, 2025
→ Select time: 14:20:00 (2:20 PM)
→ Click "Restore"
→ Confirm
```

**3. Wait for Restoration**
```
Estimated time: 5-30 minutes
Status shown in dashboard
You'll get email notification when done
```

**4. Verify Restoration**
```
Check critical tables:
- workspace_accounts (should have 8 records)
- workspace_members (should have correct members)
- users (Jennifer & Irish should exist)
```

---

## 📥 How to Download Backups

### Use Case: Long-term Archive

**Steps:**
```
1. Settings → Database → Backups
2. Select a daily backup
3. Click "Download"
4. Saves as `.sql` file
5. Store in safe location
```

**Recommended Schedule:**
- Download monthly backup for archive
- Store in:
  - Local machine
  - Cloud storage (Dropbox, Google Drive)
  - Version control (private repo)

---

## 🎯 Best Practices with Supabase Pro

### 1. Before Using Restore Points

**Current Workflow:**
```bash
restore-point "description"
→ Only saves code
```

**Better Workflow:**
```bash
# BEFORE using restore-point:
# Note the current time for PITR reference

echo "📅 Database state timestamp: $(date -u +%Y-%m-%d\ %H:%M:%S\ UTC)"

# THEN create restore point
restore-point "description"

# If you need to restore database later:
# Use PITR to restore to the timestamp you noted
```

### 2. Before Database Migrations

**Workflow:**
```bash
# 1. Note current time
echo "Pre-migration: $(date -u +%Y-%m-%d\ %H:%M:%S\ UTC)"

# 2. Run migration
supabase db push

# 3. If migration fails:
#    → Use PITR to restore to noted time
#    → Fix migration
#    → Try again
```

### 3. Monthly Archive Downloads

**Workflow:**
```bash
# First day of each month:
# 1. Go to Supabase dashboard
# 2. Download latest backup
# 3. Store in safe location
# 4. Name: backup-YYYY-MM.sql
```

---

## 🔧 Integration with Restore Points

### Enhanced Restore Point Script

Create: `scripts/restore-point-with-timestamp.sh`

```bash
#!/bin/bash

DESCRIPTION="${1:-Restore point}"
TIMESTAMP=$(date -u +%Y-%m-%d\ %H:%M:%S\ UTC)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📸 Creating Restore Point"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Description: $DESCRIPTION"
echo "🕒 Database Timestamp: $TIMESTAMP"
echo ""
echo "✅ Code snapshot: Git commit"
echo "✅ Database snapshot: Use Supabase PITR"
echo ""

# Create git commit
git add -A
git commit -m "Restore point: $DESCRIPTION"

COMMIT_HASH=$(git rev-parse HEAD)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Restore Point Created"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 To restore this state:"
echo ""
echo "1️⃣  Restore Code:"
echo "    git checkout $COMMIT_HASH"
echo ""
echo "2️⃣  Restore Database:"
echo "    Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog"
echo "    Settings → Database → Backups → Point-in-Time Recovery"
echo "    Select time: $TIMESTAMP"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save restore instructions
mkdir -p .restore-points
cat > ".restore-points/restore-$COMMIT_HASH.txt" <<EOF
Restore Point: $DESCRIPTION
Created: $TIMESTAMP
Git Commit: $COMMIT_HASH

To Restore:

1. Code:
   git checkout $COMMIT_HASH

2. Database:
   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
   Settings → Database → Backups → Point-in-Time Recovery
   Time: $TIMESTAMP
EOF

echo "💾 Instructions saved: .restore-points/restore-$COMMIT_HASH.txt"
echo ""
```

**Usage:**
```bash
chmod +x scripts/restore-point-with-timestamp.sh
./scripts/restore-point-with-timestamp.sh "before big refactor"
```

---

## 🚨 Emergency Recovery Procedure

### If Something Goes Wrong:

**Step 1: Don't Panic**
- Supabase has your last 7 days
- Nothing is lost

**Step 2: Identify Time to Restore**
```
When was the last good state?
Example: "30 minutes ago" or "Yesterday at 2 PM"
```

**Step 3: Restore Database**
```
1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Settings → Database → Backups
3. Point-in-Time Recovery
4. Select date/time
5. Click Restore
6. Wait 5-30 minutes
```

**Step 4: Restore Code (if needed)**
```
git log --oneline  # Find commit
git checkout <commit-hash>
```

**Step 5: Verify**
```
Check critical data:
- Users exist
- Workspace accounts connected
- Campaigns intact
```

---

## 📊 Monitoring Your Backups

### Weekly Check:
```
1. Visit dashboard
2. Check "Last backup" timestamp
3. Verify it's within 24 hours
4. If not → Contact Supabase support
```

### Monthly Check:
```
1. Download backup
2. Verify file size (should be growing as data grows)
3. Store in archive
4. Test restore on local database (optional but recommended)
```

---

## 💡 Key Takeaways

### ✅ What You Have Now:
1. **Automatic daily backups** (no action needed)
2. **7-day PITR window** (restore to any second)
3. **Download capability** (for archives)
4. **One-click restore** (5-30 min recovery)

### ⚠️ What You Should Do:

**Immediate:**
1. Bookmark: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/settings/database
2. Check that backups are running (look for recent backup)
3. Save the PITR instructions

**Before Next Restore Point:**
1. Note the current timestamp
2. Create restore point
3. Save both timestamps together

**Monthly:**
1. Download a backup
2. Store in safe location
3. Verify backup integrity

---

## 🔗 Quick Links

**Your Supabase Dashboard:**
https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog

**Backups Page:**
https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/settings/database

**Supabase Backup Docs:**
https://supabase.com/docs/guides/platform/backups

---

## ❓ Common Questions

**Q: How far back can I restore?**
A: 7 days with PITR (down to the second)

**Q: Do backups affect performance?**
A: No - they run on separate infrastructure

**Q: Can I restore a single table?**
A: No - PITR restores entire database. Use pg_dump for single tables.

**Q: What if I need data from 8+ days ago?**
A: That's why monthly downloads are recommended

**Q: Does PITR affect my live database?**
A: Restoration is done to a new instance, then swapped (minimal downtime)

**Q: Can I schedule custom backup times?**
A: Daily backups are automatic (~2am UTC). Download for custom schedule.

---

## 🎯 Action Items

**Right Now:**
- [ ] Visit backups page and verify backups exist
- [ ] Bookmark the backups URL
- [ ] Note current timestamp before next restore point

**This Week:**
- [ ] Create enhanced restore point script
- [ ] Test PITR with non-critical data (optional)
- [ ] Document your backup verification process

**This Month:**
- [ ] Download first monthly archive
- [ ] Set calendar reminder for monthly downloads
- [ ] Review and update this document

---

You're already paying for the best backup solution available - now you know how to use it! 🎉
