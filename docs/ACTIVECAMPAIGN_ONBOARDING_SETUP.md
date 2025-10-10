# ActiveCampaign Onboarding Integration

## Overview

Automatically syncs new SAM AI signups to ActiveCampaign for onboarding email sequences.

**Filtering**: Only users from **InnovareAI workspaces** are synced (tenant = 'innovareai')

## Setup Complete ✅

### Environment Variables
Already configured in `.env.local`:
```bash
ACTIVECAMPAIGN_BASE_URL=https://innovareai.api-us1.com
ACTIVECAMPAIGN_API_KEY=453675737b6accc1d499c5c7da2c86baedf1af829c2f29b605b16d2dbb8940a98a2d5e0d
```

### API Route
**POST** `/api/activecampaign/sync-user`

Checks workspace tenant and only syncs InnovareAI users.

## Usage

### 1. ✅ Auto-Sync on New Signup (ACTIVE)

**Status:** ✅ **FULLY AUTOMATED**

New user signups are automatically synced to ActiveCampaign:
- **Location:** `/app/api/auth/signup/route.ts` (lines 399-423)
- **Trigger:** Runs automatically after workspace creation during signup
- **Filtering:** Only InnovareAI workspace users are synced (tenant check in API)
- **Non-blocking:** If ActiveCampaign is down, signup still succeeds

**How it works:**
1. User signs up via Stripe checkout (InnovareAI) or manual invite (3cubed)
2. Supabase user + workspace created
3. ActiveCampaign sync automatically called
4. If workspace tenant = 'innovareai' → sync to ActiveCampaign
5. If workspace tenant = '3cubed' → skip (logged but not synced)

### 2. Sync Existing InnovareAI Users (One-Time)

```bash
node scripts/sync-innovareai-users-to-activecampaign.cjs
```

This will:
- Find all InnovareAI workspaces (tenant = 'innovareai')
- Get all users in those workspaces
- Sync each user to ActiveCampaign with "InnovareAI" tag

### 3. Manual Sync Single User

```bash
curl -X POST http://localhost:3000/api/activecampaign/sync-user \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid-here"}'
```

## How It Works

1. **User signs up** → User record created in Supabase
2. **Check workspace tenant** → Only proceed if tenant = 'innovareai'
3. **Sync to ActiveCampaign:**
   - Create/find contact by email
   - Add to "SAM" list
   - Tag with "InnovareAI"
4. **ActiveCampaign automation** → Onboarding email sequence triggers

## ActiveCampaign Setup

### In ActiveCampaign Dashboard:

1. **Create "SAM" List**
   - Go to Lists → Create List
   - Name: "SAM"
   - Description: "SAM AI Platform users"

2. **Create "InnovareAI" Tag**
   - Go to Tags → Create Tag
   - Name: "InnovareAI"
   - Type: Contact

3. **Create Onboarding Automation**
   - Go to Automations → Create Automation
   - Trigger: "Contact is added to list" → Select "SAM" list
   - Condition: "Contact has tag" → "InnovareAI"
   - Actions: Your onboarding email sequence

## API Response

### Success (InnovareAI user):
```json
{
  "success": true,
  "user": {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "workspace": {
    "name": "InnovareAI Workspace",
    "tenant": "innovareai"
  },
  "activecampaign": {
    "contactId": "123",
    "listId": "456",
    "tagId": "789",
    "company": "InnovareAI"
  }
}
```

### Skipped (3cubed user):
```json
{
  "skipped": true,
  "reason": "User belongs to 3cubed workspace, not InnovareAI",
  "workspace": "3cubed Workspace",
  "tenant": "3cubed"
}
```

## Current Reseller Configuration

**InnovareAI Customers (will be synced):**
- InnovareAI Workspace (IAI)
- Blue Label Labs (BLL)

**3cubed Customers (will be skipped):**
- 3cubed Workspace (3WC)
- Sendingcell Workspace (SWS)
- True People Consulting (TPC)
- WT Matchmaker Workspace (WTM)

## Testing

1. **Test API connection:**
```bash
node -e "
const { activeCampaignService } = require('./lib/activecampaign.ts');
activeCampaignService.testConnection().then(console.log);
"
```

2. **Test single user sync:**
```bash
# Get a user ID from InnovareAI workspace
USER_ID="user-id-here"

curl -X POST http://localhost:3000/api/activecampaign/sync-user \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\"}"
```

3. **Verify in ActiveCampaign:**
   - Go to Contacts
   - Search for the email
   - Check if they're on "SAM" list with "InnovareAI" tag

## Troubleshooting

**"Failed to sync to ActiveCampaign"**
- Check API credentials in .env.local
- Verify ActiveCampaign account is active
- Check network connectivity

**"User belongs to X workspace, not InnovareAI"**
- This is expected for 3cubed users
- Only InnovareAI workspace users are synced

**"User not found"**
- Verify the userId exists in the users table
- Check if user has a current_workspace_id

## Next Steps

1. Run the sync script to add existing InnovareAI users
2. Add the sync call to your signup flow
3. Set up the onboarding automation in ActiveCampaign
4. Test with a new signup

---

**Created**: October 10, 2025
**Status**: Ready for deployment
