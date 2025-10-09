# Airtable Backup Setup Guide

## ✅ SETUP COMPLETE (October 10, 2025)

**All 4 backup tables successfully created in Airtable!**

**Base ID:** `appOtsfn60HFeTpnn`
**Base URL:** https://airtable.com/appOtsfn60HFeTpnn

## 🎯 What You're Setting Up

**Hybrid Backup System (Maximum Safety):**
- **Layer 1**: Supabase Pro (automatic daily + PITR) ✅ Already have
- **Layer 2**: Airtable (visual backup + verification) ✅ COMPLETE
- **Layer 3**: Monthly downloads (long-term archive)

---

## 🚀 Quick Setup (ALREADY DONE)

An automated setup script has been created at `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/setup-airtable-backup-tables.js`.

**To set up tables automatically:**
```bash
node scripts/setup-airtable-backup-tables.js
```

This script:
- Creates all 4 backup tables with proper field types
- Skips tables that already exist
- Configures ISO date formats and UTC timezone
- Provides detailed progress feedback

**Tables Created:**
1. ✅ Workspace Accounts (tbl8xUzZEFjZR1P5S) - 10 fields
2. ✅ Workspace Members (tblVRCqwfTsZDEiTp) - 8 fields
3. ✅ Users (tbl8GyXC4TWyzKfdT) - 9 fields
4. ✅ Backup Metadata (tbl2cJHZqiIKcFnrH) - 6 fields

---

## 📋 Manual Setup Steps (15 minutes)

**Note:** These steps are for reference only. The automated script has already completed the setup.

### Step 1: Create Airtable Account (2 min)

1. Go to: https://airtable.com/signup
2. Sign up with your email (free plan is fine)
3. Verify your email

---

### Step 2: Create Backup Base (3 min)

1. Click **"Add a base"**
2. Choose **"Start from scratch"**
3. Name it: `SAM-Backups-2025`

4. Create **4 tables** in the base:

#### Table 1: Workspace Accounts
Fields to create:
- Supabase ID (Single line text)
- Workspace ID (Single line text)
- User ID (Single line text)
- Account Type (Single select: linkedin, email)
- Account Name (Single line text)
- Unipile Account ID (Single line text)
- Connection Status (Single select: connected, disconnected)
- Is Active (Single select: Yes, No)
- Backup Timestamp (Date & time)
- Restore Point (Single line text)

#### Table 2: Workspace Members
Fields to create:
- Supabase ID (Single line text)
- Workspace ID (Single line text)
- User ID (Single line text)
- Role (Single select: owner, admin, member)
- Status (Single select: active, inactive, pending)
- Joined At (Date & time)
- Backup Timestamp (Date & time)
- Restore Point (Single line text)

#### Table 3: Users
Fields to create:
- Supabase ID (Single line text)
- Email (Email)
- First Name (Single line text)
- Last Name (Single line text)
- Current Workspace (Single line text)
- Email Verified (Single select: Yes, No)
- Created At (Date & time)
- Backup Timestamp (Date & time)
- Restore Point (Single line text)

#### Table 4: Backup Metadata
Fields to create:
- Timestamp (Date & time)
- Restore Point Name (Single line text)
- Tables Backed Up (Long text)
- Record Count (Number)
- Status (Single select: Complete, Failed, Partial)
- Backup Type (Single select: Manual, Automatic with restore-point, Scheduled)

---

### Step 3: Get API Credentials (2 min)

1. Click your **profile icon** (top right)
2. Go to **"Developer hub"**
3. Click **"Create token"** or **"Personal access tokens"**
4. Create token with:
   - Name: `SAM Backup Script`
   - Scopes: `data.records:read` and `data.records:write`
   - Access: Your `SAM-Backups-2025` base
5. Click **"Create token"**
6. **Copy the token** (starts with `pat...`)

7. Get Base ID:
   - Go back to your base
   - Look at URL: `https://airtable.com/appXXXXXXXXXXXXXX/...`
   - Copy the `appXXXXXXXXXXXXXX` part

---

### Step 4: Add to Environment Variables (1 min)

Open `.env.local` and add:

```bash
# Airtable Backup Configuration
AIRTABLE_API_KEY=pat...  # Your token from step 3
AIRTABLE_BASE_ID=app...  # Your base ID from step 3
```

Save the file.

---

### Step 5: Install Airtable SDK (1 min)

```bash
npm install airtable
```

---

### Step 6: Test Backup (2 min)

```bash
# Test manual backup
node scripts/backup-to-airtable.cjs "Test backup"
```

**Expected Output:**
```
🔄 Backing up to Airtable...
============================================================

📁 Backing up workspace_accounts...
   ✅ Backed up 8 workspace accounts
👥 Backing up workspace_members...
   ✅ Backed up 6 workspace members
👤 Backing up users...
   ✅ Backed up X users

============================================================
✅ Airtable Backup Complete!
============================================================

Total records backed up: XX
Restore point: Test backup

View in Airtable:
https://airtable.com/appXXXXXXXXXXXXXX
```

---

### Step 7: Verify in Airtable (1 min)

1. Go to your Airtable base
2. Click on each table
3. Verify you see your data:
   - Workspace Accounts: 8 records
   - Workspace Members: 6 records
   - Users: Several records
   - Backup Metadata: 1 record

**You should be able to visually browse all your critical data!**

---

### Step 8: Test Hybrid Restore Point (2 min)

```bash
# Create a hybrid restore point
./scripts/restore-point-hybrid "Test hybrid backup"
```

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 Creating Hybrid Restore Point (Maximum Safety)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  Creating Git snapshot...
   ✅ Code: abc123

2️⃣  Backing up to Airtable...
   ✅ Success

3️⃣  Supabase Pro PITR (automatic)...
   ✅ Point-in-time recovery available

✅ Hybrid Restore Point Created
```

---

## 🚀 Usage

### Creating Restore Points

**Option A: Simple (Supabase PITR only)**
```bash
./scripts/restore-point "description"
```

**Option B: Hybrid (Supabase + Airtable)** ⭐ **RECOMMENDED**
```bash
./scripts/restore-point-hybrid "description"
```

### Restoring from Backups

**Option A: Full Restore (Supabase Pro PITR)**
1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Settings → Database → Backups → Point-in-Time Recovery
3. Select timestamp from restore point
4. Click Restore

**Option B: Selective Restore (Airtable)**
```bash
node scripts/restore-from-airtable.cjs "restore point name"
```

**Option C: Manual Restore (Browse Airtable)**
1. Open Airtable base
2. Find restore point by name
3. Manually copy data as needed

---

## 💰 Cost

**Free Plan (Recommended for now):**
- 1,200 records per base
- Unlimited bases
- Your usage: ~20-50 records per backup
- Can store ~24-60 backups per base
- **Cost: FREE**

**Plus Plan ($20/month) - Optional:**
- 5,000 records per base
- 3-year history
- Can store ~100-250 backups
- **Only upgrade if you need more storage**

---

## 📊 What Gets Backed Up

### Critical Tables (Always):
- ✅ workspace_accounts (Unipile connections)
- ✅ workspace_members (Team access)
- ✅ users (User profiles)

### Optional Tables (Can add later):
- campaigns (Active campaigns)
- prospects (CRM data)
- knowledge_base (RAG content)

---

## 🔍 Viewing Your Backups

### In Airtable:
1. Open base: https://airtable.com/[your-base-id]
2. Click any table
3. Filter by "Restore Point" to find specific backup
4. Browse data visually
5. Export as CSV if needed

### List All Restore Points:
```bash
ls -lt .restore-points/
```

---

## 🎯 Best Practices

### Daily Workflow:
```bash
# Before major changes
./scripts/restore-point-hybrid "before refactor"

# Make your changes
# Test

# If successful, continue
# If issues, restore from backup
```

### Weekly:
- Verify backups exist in Airtable
- Check Supabase dashboard for daily backups

### Monthly:
- Download Supabase backup for archive
- Clean up old Airtable records if approaching limit
- Review and update backup strategy

---

## ⚠️ Troubleshooting

### "Airtable not configured" error:
- Check `.env.local` has correct credentials
- Ensure `AIRTABLE_API_KEY` starts with `pat...`
- Ensure `AIRTABLE_BASE_ID` starts with `app...`

### "Permission denied" error:
- Make scripts executable: `chmod +x scripts/restore-point-hybrid`

### "Cannot find module 'airtable'" error:
- Install: `npm install airtable`

### Backups not appearing in Airtable:
- Check table names match exactly
- Verify field names match exactly
- Check API token has write permissions

---

## 🎉 Success Checklist

Setup is complete when:

- [ ] Airtable account created
- [ ] Base created with 4 tables
- [ ] API credentials added to `.env.local`
- [ ] Airtable SDK installed
- [ ] Test backup successful
- [ ] Data visible in Airtable
- [ ] Hybrid restore point script works

---

## 📚 Additional Resources

- **Airtable API Docs**: https://airtable.com/developers/web/api/introduction
- **Your Base**: https://airtable.com/[your-base-id]
- **Supabase Dashboard**: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog

---

## 💡 Next Steps After Setup

1. Create your first production restore point:
   ```bash
   ./scripts/restore-point-hybrid "Initial production backup"
   ```

2. Verify all 3 layers work:
   - Git: Check commit exists
   - Airtable: Browse data in tables
   - Supabase: Check backups page

3. Document your restore process for team

4. Consider setting up automated daily Airtable backups (optional):
   - Add cron job or scheduled task
   - Runs `backup-to-airtable.cjs` daily

---

**You now have triple-layer protection! 🎉**

- Layer 1: Supabase Pro (automatic)
- Layer 2: Airtable (visual + selective)
- Layer 3: Git (code)

---

## 🛠️ Setup Scripts

### Table Creation Script
**Location:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/setup-airtable-backup-tables.js`

Creates all 4 backup tables in the Airtable base with proper schema.

**Usage:**
```bash
node scripts/setup-airtable-backup-tables.js
```

**Features:**
- Automatically creates tables with correct field types
- Skips tables that already exist
- Configures proper date/time formats (ISO, UTC)
- Adds all required single-select options
- Provides detailed progress feedback
- Includes 1-second delays to respect rate limits

### Authentication Test Script
**Location:** `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/test-airtable-auth.js`

Tests Airtable API authentication and lists all tables in the base.

**Usage:**
```bash
node scripts/test-airtable-auth.js
```

**Output:**
- API key validation
- Base ID verification
- List of all tables with IDs
- Complete field schemas for each table

---

## ⚠️ Important Notes

### Environment Variable Loading

Both scripts use `override: true` when loading `.env.local` to ensure the correct Airtable credentials are used:

```javascript
config({ path: join(__dirname, '..', '.env.local'), override: true });
```

This is necessary because the project has multiple `.env` files (`.env`, `.env.local`, `.env.production`, etc.), and we need to ensure the Airtable credentials from `.env.local` take precedence.

### API Rate Limits

Airtable API has rate limits:
- 5 requests per second per base
- Scripts include 1-second delays between table creation requests
- For large operations, consider batching requests

### Table IDs

The created tables have the following IDs:
- **Workspace Accounts:** tbl8xUzZEFjZR1P5S
- **Workspace Members:** tblVRCqwfTsZDEiTp
- **Users:** tbl8GyXC4TWyzKfdT
- **Backup Metadata:** tbl2cJHZqiIKcFnrH

These IDs can be used for direct API access or MCP integration.
