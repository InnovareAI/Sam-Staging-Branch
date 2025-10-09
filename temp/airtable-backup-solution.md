# Airtable Backup Solution

## Why Airtable is Perfect for Backups

### ✅ Advantages:
1. **Cloud-based** - Safe from local machine issues
2. **Visual interface** - Easy to browse and verify data
3. **Version history** - Airtable keeps change history
4. **Easy restore** - Can pull data back when needed
5. **Accessible** - View from anywhere, any device
6. **Structured** - Better than flat SQL dumps
7. **Free tier** - 1,200 records per base (good for backups)

### 📊 What to Backup to Airtable:

**Critical Tables (Must Have):**
- workspace_accounts (Unipile connections)
- workspace_members (Team access)
- users (User profiles)

**Important Tables (Should Have):**
- campaigns (Active campaigns)
- prospects (CRM data)
- knowledge_base (RAG content)

**Nice to Have:**
- sam_conversation_threads
- Analytics data

## Implementation Options

### Option 1: Automatic Backup on Restore Point
```bash
restore-point "my backup"
→ 1. Git snapshot
→ 2. Push critical tables to Airtable
→ 3. Tag with timestamp
```

### Option 2: Scheduled Airtable Sync
```bash
# Cron job runs every 6 hours
→ Syncs critical tables to Airtable
→ Keeps Airtable in sync with Supabase
```

### Option 3: Hybrid (Recommended)
```bash
# Manual restore points
restore-point "description"
→ Git + Airtable snapshot

# Plus daily auto-sync
Daily at 2am → Sync to Airtable
```

## Airtable Base Structure

### Base: "SAM-Backups"

**Table 1: Workspace Accounts**
- Record ID (Airtable auto)
- Supabase ID
- Workspace ID
- User ID
- Account Type
- Account Name
- Unipile Account ID
- Connection Status
- Backup Timestamp
- Restore Point Tag

**Table 2: Workspace Members**
- Record ID
- Supabase ID
- Workspace ID
- User ID
- Role
- Status
- Joined At
- Backup Timestamp

**Table 3: Users**
- Record ID
- Supabase ID
- Email
- First Name
- Last Name
- Current Workspace
- Email Verified
- Backup Timestamp

**Table 4: Backup Metadata**
- Timestamp
- Restore Point Name
- Tables Backed Up
- Record Counts
- Git Commit Hash
- Status

## Implementation Script

```javascript
// backup-to-airtable.cjs

const Airtable = require('airtable');
const { createClient } = require('@supabase/supabase-js');

async function backupToAirtable(restorePointName) {
  const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
  const base = airtable.base(process.env.AIRTABLE_BASE_ID);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const timestamp = new Date().toISOString();

  // Backup workspace_accounts
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*');

  for (const account of accounts) {
    await base('Workspace Accounts').create({
      'Supabase ID': account.id,
      'Workspace ID': account.workspace_id,
      'User ID': account.user_id,
      'Account Type': account.account_type,
      'Account Name': account.account_name,
      'Unipile Account ID': account.unipile_account_id,
      'Connection Status': account.connection_status,
      'Backup Timestamp': timestamp,
      'Restore Point': restorePointName
    });
  }

  // Backup workspace_members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('*');

  for (const member of members) {
    await base('Workspace Members').create({
      'Supabase ID': member.id,
      'Workspace ID': member.workspace_id,
      'User ID': member.user_id,
      'Role': member.role,
      'Status': member.status,
      'Joined At': member.joined_at,
      'Backup Timestamp': timestamp,
      'Restore Point': restorePointName
    });
  }

  // Record backup metadata
  await base('Backup Metadata').create({
    'Timestamp': timestamp,
    'Restore Point Name': restorePointName,
    'Tables Backed Up': 'workspace_accounts, workspace_members, users',
    'Record Count': accounts.length + members.length,
    'Status': 'Complete'
  });

  console.log(`✅ Backed up to Airtable: ${restorePointName}`);
}
```

## Restore from Airtable

```javascript
// restore-from-airtable.cjs

async function restoreFromAirtable(restorePointName) {
  const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
  const base = airtable.base(process.env.AIRTABLE_BASE_ID);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get all records from this restore point
  const records = await base('Workspace Accounts')
    .select({
      filterByFormula: `{Restore Point} = "${restorePointName}"`
    })
    .all();

  // Restore to Supabase
  for (const record of records) {
    await supabase
      .from('workspace_accounts')
      .upsert({
        id: record.get('Supabase ID'),
        workspace_id: record.get('Workspace ID'),
        user_id: record.get('User ID'),
        account_type: record.get('Account Type'),
        account_name: record.get('Account Name'),
        unipile_account_id: record.get('Unipile Account ID'),
        connection_status: record.get('Connection Status')
      });
  }

  console.log(`✅ Restored from Airtable: ${restorePointName}`);
}
```

## Cost Analysis

### Airtable Free Plan:
- 1,200 records per base
- Unlimited bases
- 2GB attachments per base

**Strategy:**
- One base per month: "SAM-Backups-2025-10"
- Critical tables only: ~50-200 records per backup
- Can store ~6-24 backups per base
- Create new base each month
- **Cost: FREE**

### Airtable Plus ($20/month):
- 5,000 records per base
- 3-year history
- 5GB attachments
- Can store 25-100 backups
- **Cost: $20/month**

## Setup Steps

1. **Create Airtable Account**
   - Sign up at airtable.com
   - Create new base: "SAM-Backups-2025-10"

2. **Create Tables**
   - Workspace Accounts
   - Workspace Members
   - Users
   - Backup Metadata

3. **Get API Credentials**
   - Go to airtable.com/account
   - Generate API key
   - Get Base ID from base URL

4. **Add to .env.local**
   ```
   AIRTABLE_API_KEY=key...
   AIRTABLE_BASE_ID=app...
   ```

5. **Install Airtable SDK**
   ```bash
   npm install airtable
   ```

6. **Test Backup**
   ```bash
   node scripts/backup-to-airtable.cjs "test-backup"
   ```

## Comparison: All Options

| Feature | Supabase Native | pg_dump | Airtable |
|---------|----------------|---------|----------|
| Cost | $25/mo (Pro) | Free | Free |
| Automatic | ✅ | ❌ | ✅ (with script) |
| Visual | ❌ | ❌ | ✅ |
| Easy Restore | ✅ | ⚠️ Complex | ✅ |
| Off-site | ✅ | ❌ Local | ✅ Cloud |
| Version History | ✅ 7 days | ❌ | ✅ Unlimited |
| Browse Data | ❌ | ❌ | ✅ Easy |

## Recommended Solution

**Hybrid Approach:**

1. **Supabase Native Backups** (if on Pro plan)
   - Automatic daily backups
   - Point-in-time recovery
   - Safety net

2. **Airtable Backups** (implement now)
   - Before restore points
   - Visual verification
   - Easy browsing
   - Off-site safety

3. **pg_dump** (keep as emergency)
   - Quick local backup
   - When Airtable/Supabase unavailable

**Best of all worlds!**
