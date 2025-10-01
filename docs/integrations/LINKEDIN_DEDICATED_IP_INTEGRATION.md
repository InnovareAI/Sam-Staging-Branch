# LinkedIn Dedicated IP Integration

## Overview

Each LinkedIn account is automatically assigned a dedicated Bright Data residential proxy IP from its **registration country** for maximum authenticity and to avoid detection. Users can manually override the country if needed.

## Implementation

### 1. OAuth Callback Enhancement

**File**: `app/api/linkedin/callback/route.ts` (Lines 396-537)

When a user connects a LinkedIn account via OAuth, the callback now:

1. **Extracts registration country** from LinkedIn profile:
   - `connection_params.im.location`
   - `connection_params.im.geoCountryName`
   - `connection_params.profile.location`
   - `metadata.country`

2. **Generates dedicated proxy** using `AutoIPAssignmentService`:
   - Country-specific proxy configuration
   - Unique session ID per account
   - Bright Data username string with location parameters

3. **Stores assignment** in `linkedin_proxy_assignments` table:
   ```sql
   {
     user_id,
     linkedin_account_id,      -- Unipile account ID
     linkedin_account_name,
     detected_country,          -- From LinkedIn profile
     proxy_country,             -- Bright Data country code
     proxy_state,               -- Optional state/region
     proxy_city,                -- Optional city
     proxy_session_id,          -- Unique session identifier
     proxy_username,            -- Full Bright Data connection string
     confidence_score,          -- Mapping confidence
     connectivity_status,       -- active/untested/failed/disabled
     connectivity_details,      -- Test results
     is_primary_account,
     account_features           -- Premium/Sales Navigator
   }
   ```

4. **Tests connectivity** to verify the proxy works

### 2. Settings UI Enhancement

**File**: `app/page.tsx`

#### New State Variables (Lines 226-228)
```typescript
const [linkedinProxyAssignments, setLinkedinProxyAssignments] = useState<any[]>([]);
const [selectedLinkedinAccount, setSelectedLinkedinAccount] = useState<string | null>(null);
const [loadingProxyAssignments, setLoadingProxyAssignments] = useState(false);
```

#### Load Assignments Function (Lines 322-346)
Fetches proxy assignments from `/api/linkedin/assign-proxy-ips` endpoint

#### Enhanced Modal (Lines 4824-5076)
The **Proxy Country Selection** modal now shows:

1. **List View** - All LinkedIn accounts with:
   - Account name and detected country
   - Connection status badge (Active/Untested/Failed)
   - Current proxy country assignment
   - Confidence score
   - "Change Country" button per account

2. **Edit View** - For selected account:
   - Country dropdown (US, CA, GB, DE, FR, AU, NL, CH, AT, PH)
   - Optional state/region input
   - Optional city input
   - Save button to update proxy for that specific account

### 3. Database Schema

**Table**: `linkedin_proxy_assignments`

**File**: `supabase/migrations/20250918110000_linkedin_proxy_assignments.sql`

Key features:
- Unique constraint on `(user_id, linkedin_account_id)`
- Row Level Security enabled
- Helper functions:
  - `get_linkedin_account_proxy()` - Get optimal proxy for user
  - `rotate_linkedin_proxy_session()` - Generate new session ID
  - `update_linkedin_proxy_connectivity()` - Update status after tests

### 4. Monitoring Script

**File**: `scripts/js/check-linkedin-proxy-assignments.js`

Command-line tool to view proxy assignments:

```bash
# View all assignments
node scripts/js/check-linkedin-proxy-assignments.js

# View specific user
node scripts/js/check-linkedin-proxy-assignments.js tl@innovareai.com
```

## User Flow

### Automatic Assignment (OAuth)

1. User clicks "Connect LinkedIn" on `/linkedin-integration`
2. Completes OAuth with LinkedIn
3. Callback extracts profile location
4. System automatically assigns matching Bright Data IP
5. Account ready to use with dedicated IP

### Manual Country Change

1. User opens **Settings & Profile**
2. Clicks **Proxy Country Selection**
3. Sees list of LinkedIn accounts with current assignments
4. Clicks **Change Country** on desired account
5. Selects new country (optionally state/city)
6. Clicks **Save Country Change**
7. New IP assigned for that account only

## Benefits

### ✅ Authenticity
- LinkedIn sees residential IPs from correct geographic region
- Matches account registration location by default
- Reduces detection risk

### ✅ Consistency
- Each account has dedicated session ID
- Same IP maintained across LinkedIn operations
- No IP rotation between requests from same account

### ✅ Flexibility
- Users can override country for specific targeting
- Support for state/region targeting (e.g., California, Bavaria)
- Multiple LinkedIn accounts can use different countries

### ✅ Monitoring
- Real-time connectivity status
- Confidence scores for geo-mapping
- Track last updated timestamps

## API Endpoints

### GET `/api/linkedin/assign-proxy-ips`
Returns current proxy assignments for user's LinkedIn accounts

**Response**:
```json
{
  "current_assignments": [...],
  "unassigned_accounts": [],
  "brightdata_configured": true,
  "summary": {
    "total_linkedin_accounts": 3,
    "assigned_accounts": 3,
    "unassigned_accounts": 0
  }
}
```

### POST `/api/linkedin/assign-proxy-ips`
Manually assigns proxies to all LinkedIn accounts (for batch operations)

### PUT `/api/bright-data/location-assignment`
Update proxy country for a specific LinkedIn account

**Request**:
```json
{
  "country": "DE",
  "state": "bavaria",
  "city": "munich"
}
```

## Configuration

### Environment Variables Required

```env
# Bright Data Credentials
BRIGHT_DATA_CUSTOMER_ID=hl_8aca120e
BRIGHT_DATA_RESIDENTIAL_PASSWORD=your_password_here

# Proxy Configuration
BRIGHT_DATA_RESIDENTIAL_HOST=brd.superproxy.io
BRIGHT_DATA_RESIDENTIAL_PORT=22225
```

### Supported Countries

- 🇺🇸 United States (US) - with state-level targeting
- 🇨🇦 Canada (CA)
- 🇬🇧 United Kingdom (GB)
- 🇩🇪 Germany (DE)
- 🇫🇷 France (FR)
- 🇦🇺 Australia (AU)
- 🇳🇱 Netherlands (NL)
- 🇨🇭 Switzerland (CH)
- 🇦🇹 Austria (AT)
- 🇵🇭 Philippines (PH)

## Troubleshooting

### Account shows "Untested" status
- This is normal for newly connected accounts
- Status updates to "Active" after first successful use
- Can manually test via Settings modal

### Wrong country detected
- Happens when LinkedIn profile location is ambiguous
- User can manually override in Settings
- Confidence score shows mapping accuracy

### No location found in profile
- LinkedIn profile may not have location set
- System defaults to user's detected location
- Falls back to US/California if no location available

## Future Enhancements

1. **Automatic IP Rotation**
   - Schedule periodic session ID rotation
   - Configurable rotation intervals (daily/weekly)
   - Maintain same country/region

2. **Campaign-Specific Proxies**
   - Assign proxy based on campaign target region
   - Multiple IPs per account for different campaigns
   - Geographic A/B testing

3. **Health Monitoring Dashboard**
   - Real-time connectivity monitoring
   - Alert on failed proxies
   - Automatic failover to backup IPs

4. **Usage Analytics**
   - Track proxy performance by country
   - LinkedIn action success rates per IP
   - Geographic response rate analysis

## Testing

### Test OAuth Flow
1. Go to https://app.meet-sam.com/linkedin-integration
2. Connect a new LinkedIn account
3. Check logs for proxy assignment confirmation
4. Verify in database:
   ```sql
   SELECT * FROM linkedin_proxy_assignments 
   WHERE linkedin_account_name = 'Your Name';
   ```

### Test Manual Override
1. Open Settings → Proxy Country Selection
2. Select any LinkedIn account
3. Click "Change Country"
4. Choose different country
5. Verify proxy_country updated in database

### Test with Script
```bash
node scripts/js/check-linkedin-proxy-assignments.js your@email.com
```

## Support

For issues or questions:
- Check logs in `/api/linkedin/callback` route
- Run monitoring script for current status
- Verify Bright Data credentials are configured
- Ensure `linkedin_proxy_assignments` table exists in database
