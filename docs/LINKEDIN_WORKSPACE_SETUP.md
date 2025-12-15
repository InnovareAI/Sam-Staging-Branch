# LinkedIn Workspace Setup Guide

How to properly configure a new workspace with LinkedIn integration in SAM AI.

---

## Quick Setup (5 minutes)

### Step 1: Create User Account in Supabase

```javascript
// Run in Node.js or browser console
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create user with password
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email: 'user@company.com',
  password: 'SecurePassword123!',
  email_confirm: true
});

console.log('User ID:', authData.user.id);
```

### Step 2: Create Workspace

```javascript
const { data: workspace, error } = await supabase
  .from('workspaces')
  .insert({
    name: 'Company Name',
    owner_id: authData.user.id
  })
  .select()
  .single();

console.log('Workspace ID:', workspace.id);
```

### Step 3: Add User as Workspace Member with LinkedIn Account

```javascript
// Get the Unipile Account ID from: https://api6.unipile.com:13670/api/v1/accounts
// Use X-API-KEY header with your Unipile API key

const { data: member, error } = await supabase
  .from('workspace_members')
  .insert({
    workspace_id: workspace.id,
    user_id: authData.user.id,
    role: 'owner',
    status: 'active',
    linkedin_unipile_account_id: 'UNIPILE_ACCOUNT_ID_HERE'  // e.g., 'I0XZxvzfSRuCL8nuFoUEuw'
  })
  .select()
  .single();

console.log('Member created:', member.id);
```

### Step 4: Set User's Current Workspace

```javascript
const { error } = await supabase
  .from('users')
  .upsert({
    id: authData.user.id,
    email: 'user@company.com',
    current_workspace_id: workspace.id
  });
```

---

## Finding the Unipile Account ID

### Option 1: Via API

```bash
curl -s 'https://api6.unipile.com:13670/api/v1/accounts' \
  -H 'X-API-KEY: YOUR_UNIPILE_API_KEY' | jq '.[] | {id, name, type}'
```

### Option 2: Via Node.js Script

```javascript
const response = await fetch('https://api6.unipile.com:13670/api/v1/accounts', {
  headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY }
});
const accounts = await response.json();

// Find LinkedIn accounts
const linkedinAccounts = accounts.filter(a => a.type === 'LINKEDIN');
console.log(linkedinAccounts.map(a => ({
  id: a.id,
  name: a.name,
  email: a.connection_params?.im?.username
})));
```

---

## Complete Example: Setting Up Rony @ Tursio

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupTursioWorkspace() {
  // 1. Create user
  const { data: authData } = await supabase.auth.admin.createUser({
    email: 'rony@tursio.ai',
    password: 'Tursio2025!Rony',
    email_confirm: true
  });
  const userId = authData.user.id;
  console.log('Created user:', userId);

  // 2. Create workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .insert({ name: 'Tursio', owner_id: userId })
    .select()
    .single();
  console.log('Created workspace:', workspace.id);

  // 3. Add member with LinkedIn
  // Rony's LinkedIn Unipile ID: I0XZxvzfSRuCL8nuFoUEuw
  await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
      linkedin_unipile_account_id: 'I0XZxvzfSRuCL8nuFoUEuw'
    });

  // 4. Set current workspace
  await supabase
    .from('users')
    .upsert({
      id: userId,
      email: 'rony@tursio.ai',
      current_workspace_id: workspace.id
    });

  console.log('Setup complete!');
  console.log('Login: rony@tursio.ai / Tursio2025!Rony');
}

setupTursioWorkspace();
```

---

## Database Schema Reference

### workspaces
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Workspace display name |
| owner_id | uuid | FK to auth.users |
| commenting_agent_enabled | boolean | Enable commenting agent |
| created_at | timestamp | Creation time |

### workspace_members
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| workspace_id | uuid | FK to workspaces |
| user_id | uuid | FK to auth.users |
| role | text | 'owner', 'admin', 'member' |
| status | text | 'active', 'pending', 'inactive' |
| linkedin_unipile_account_id | text | **Unipile account ID for LinkedIn** |
| joined_at | timestamp | Join time |

### users
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | FK to auth.users |
| email | text | User email |
| current_workspace_id | uuid | Active workspace |
| first_name | text | Optional |
| last_name | text | Optional |

---

## How LinkedIn Detection Works

The `/api/unipile/accounts` endpoint checks TWO sources for LinkedIn account association:

1. **`user_unipile_accounts` table** (legacy) - Stores user-to-Unipile mappings
2. **`workspace_members.linkedin_unipile_account_id`** (preferred) - Direct link on membership

When a user loads the LinkedIn Integration page, the API:
1. Gets user's `linkedin_unipile_account_id` from `workspace_members`
2. Fetches all accounts from Unipile API
3. Filters to only show accounts matching the user's ID
4. Returns `has_linkedin: true` if a matching account is found and connected

---

## Troubleshooting

### User sees "Connect LinkedIn" but account exists in Unipile

**Cause:** `linkedin_unipile_account_id` not set in `workspace_members`

**Fix:**
```javascript
await supabase
  .from('workspace_members')
  .update({ linkedin_unipile_account_id: 'UNIPILE_ID' })
  .eq('user_id', 'USER_UUID')
  .eq('workspace_id', 'WORKSPACE_UUID');
```

### User sees "No Workspace Selected"

**Cause:** Either:
- User not in `workspace_members` table
- `current_workspace_id` not set in `users` table
- Token not being passed to API

**Fix:**
1. Verify membership: `SELECT * FROM workspace_members WHERE user_id = 'USER_UUID'`
2. Set current workspace: `UPDATE users SET current_workspace_id = 'WORKSPACE_UUID' WHERE id = 'USER_UUID'`
3. Hard refresh the page (Cmd+Shift+R)

### Unipile account not found

**Cause:** LinkedIn account not connected in Unipile

**Fix:**
1. Go to Unipile dashboard
2. Connect LinkedIn account
3. Get the new account ID
4. Update `workspace_members.linkedin_unipile_account_id`

---

## Environment Variables

Required in Netlify (set via `netlify env:set`):

```
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=your-api-key-here
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Current Workspaces (Dec 2025)

| Workspace | ID | Owner | LinkedIn Account |
|-----------|------|-------|------------------|
| InnovareAI | babdcab8-1a78-4b2f-913e-6e9fd9821009 | tl@innovareai.com | ymtTx4xVQ6OVUFk83ctwtA |
| Tursio | 8a720935-db68-43e2-b16d-34383ec6c3e8 | rony@tursio.ai | I0XZxvzfSRuCL8nuFoUEuw |

---

**Last Updated:** December 15, 2025
