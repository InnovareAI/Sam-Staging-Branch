# Email Campaign Account Selection Feature

## Overview
Users can now select which email account to send emails from when creating or editing email campaigns. This feature enables campaigns to be sent from multiple email accounts with proper account management.

## Implementation Summary

### 1. Database Schema Update
**File**: `/sql/migrations/20251122_add_email_account_to_campaigns.sql`

- Added `email_account_id UUID` column to `campaigns` table
- Column references `workspace_accounts(id)` for email accounts
- Created index for efficient lookups: `idx_campaigns_email_account_id`
- Includes documentation comment explaining the field

### 2. Frontend UI Implementation
**File**: `/app/components/CampaignStepsEditor.tsx`

#### State Management
```typescript
const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
const [selectedEmailAccountId, setSelectedEmailAccountId] = useState<string>('');
const [loadingEmailAccounts, setLoadingEmailAccounts] = useState(false);
```

#### Email Account Loading
- `loadEmailAccounts()`: Fetches list of connected email accounts from `/api/email-providers`
- `loadCampaignEmailAccount()`: Loads the campaign's current email_account_id if it exists
- Both functions triggered when Settings modal opens for email campaigns

#### Email Account Selection UI
Located in Campaign Settings modal under "Email Account" section:
- Shows email accounts dropdown (only for email campaigns)
- Displays selected account status and details
- Shows helpful link if no accounts are configured
- Loading state while fetching accounts

#### Save Functionality
- `handleSave()`: Updated to save email_account_id when user clicks "Save Changes"
- Calls `/api/campaigns/{campaignId}` with PUT method
- Handles errors gracefully with user feedback

### 3. API Updates
**File**: `/app/api/campaigns/route.ts`

- Added `email_account_id` to the campaigns SELECT query
- Now returns email_account_id in campaign list responses
- Allows frontend to display which account was selected

**File**: `/app/api/campaigns/[id]/route.ts`

- Already supports PATCH/PUT updates to campaigns
- No changes needed - PUT endpoint automatically handles email_account_id updates

### 4. How It Works

#### For Users Creating/Editing Email Campaigns:
1. Open Campaign Settings
2. Scroll to "Email Account" section (only visible for email campaigns)
3. Select which email account to send from
4. Click "Save Changes"
5. Selection is persisted to database

#### When Campaign Executes:
- System reads `campaign.email_account_id` from database
- Uses that account to send all emails for the campaign
- Ensures consistent sender identity throughout campaign

## Current Limitations

1. **Email Account Requirement**: Users must have at least one email account configured before creating email campaigns
2. **Single Account per Campaign**: Each campaign sends from one account (not round-robin)
3. **No Account Switching**: Cannot change the email account mid-campaign

## Future Enhancements

1. **Account-Level Rate Limiting**: Enforce 40 emails/day per account
2. **Timezone-Aware Scheduling**: Respect user timezone when scheduling emails
3. **Weekend Skipping**: Automatically skip emails on weekends
4. **Round-Robin Sending**: Optionally distribute sends across multiple accounts
5. **Sender Rotation**: Change sender account between follow-ups for campaign variation

## Testing Checklist

- [ ] Create new email campaign with one email account connected
- [ ] Edit email campaign and verify dropdown shows connected accounts
- [ ] Save email campaign with account selection
- [ ] Verify email_account_id is stored in database
- [ ] View campaign list and confirm email account data loads
- [ ] Test with multiple email accounts - verify selection persists
- [ ] Test error cases: no accounts configured, network failures
- [ ] Verify only email campaigns show the email account selector

## Database Schema

```sql
-- Campaigns table now includes:
email_account_id UUID REFERENCES workspace_accounts(id),

-- Index for performance:
CREATE INDEX idx_campaigns_email_account_id ON campaigns(email_account_id);
```

## API Endpoints

### GET /api/campaigns
Returns list of campaigns including `email_account_id`:
```json
{
  "campaigns": [
    {
      "id": "uuid",
      "name": "Campaign Name",
      "campaign_type": "email",
      "email_account_id": "uuid",
      ...
    }
  ]
}
```

### GET /api/email-providers?workspace_id=xxx
Returns list of connected email accounts:
```json
{
  "providers": [
    {
      "id": "uuid",
      "email_address": "sender@example.com",
      "provider_name": "Gmail",
      "status": "connected",
      ...
    }
  ]
}
```

### PUT /api/campaigns/{id}
Update campaign including email account:
```json
{
  "email_account_id": "uuid"
}
```

## Component Props

### CampaignStepsEditor
```typescript
interface CampaignStepsEditorProps {
  campaignId: string;
  campaignName: string;
  campaignType: 'connector' | 'messenger' | ... | 'email';
  onClose: () => void;
  onSave: (steps: CampaignStep[]) => void;
}
```

## Related Files

- Email Providers Modal: `/app/components/EmailProvidersModal.tsx`
- Email Provider API: `/app/api/email-providers/route.ts`
- Workspace Accounts: `/app/api/workspace/[workspaceId]/accounts/route.ts`
- Campaign Hub: `/app/components/CampaignHub.tsx`

## Deployment Notes

1. **Database Migration**: Run migration to add email_account_id column
   ```bash
   # Via Supabase dashboard SQL editor:
   SELECT * FROM migration_log; -- verify migration runs
   ```

2. **No Breaking Changes**: Existing campaigns will have NULL email_account_id
3. **Backward Compatible**: System still works without email_account_id set

## Error Handling

- Missing email accounts: User sees message with link to Settings → Email Integration
- Failed save: Toast notification with error message
- Network failures: Console logs and user feedback
- Invalid account ID: Database constraints prevent invalid references

## Security Considerations

1. **RLS Policies**: Email accounts are workspace-scoped via RLS
2. **User Authentication**: All endpoints require authenticated user
3. **Workspace Membership**: User must be member of workspace
4. **Account Ownership**: Users can only select accounts from their workspace
5. **No Password Storage**: All credentials stored in workspace_accounts table

## Performance

- **Email Account Loading**: Cached per modal open (loads once)
- **Campaign Updates**: Single PUT request with minimal payload
- **Index**: Efficient lookups via email_account_id index

## Monitoring

Track in analytics/logs:
- Email accounts selected per campaign type
- Campaign sends per email account
- Account switching rate (for future feature)
- Timezone preferences (when implemented)

---

**Implementation Date**: November 22, 2025
**Feature Status**: Ready for production testing
**Related Epic**: Email Campaign Enhancement - Rate Limiting & Scheduling
