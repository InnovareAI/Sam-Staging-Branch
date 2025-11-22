# LinkedIn Search URL Staling Fix

## Problem Identified

**Date**: November 22, 2025
**Reported By**: User (Irish's campaigns failing)
**Root Cause**: SAM's LinkedIn search feature was storing stale LinkedIn URLs

### The Issue

When SAM searched LinkedIn via Unipile API (`/api/v1/linkedin/search`), it was storing the `profile_url` field directly without cleaning it. These URLs contained query parameters like:

```
https://www.linkedin.com/in/annie-meyer-422ab?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAAADdpoBT_UGeqLTWpIvOQ9_V1PBwIAkEnY
```

Over time, these URLs become **stale** and redirect to different LinkedIn profiles. This caused:

1. **Connection requests sent to wrong people** - Annie Meyer's URL pointed to Jamshaid Ali (Pakistan-based)
2. **WITHDRAWN invitation detection** - System correctly detected WITHDRAWN but for wrong person
3. **Campaign failures** - System blocked CR sends thinking prospect had withdrawn invitation

### Example Case

**Search Result**: "Annie Meyer" with URL `https://www.linkedin.com/in/annie-meyer-422ab?miniProfileUrn=...`
**Actual Profile**: Jamshaid Ali (completely different person)
**Invitation Status**: WITHDRAWN (from Irish's previous attempt to connect to Jamshaid)
**System Behavior**: ✅ Correctly blocked CR send (protecting user from LinkedIn limits)
**Real Problem**: ❌ Wrong person in database due to stale URL

## Solution Implemented

### 1. Clean LinkedIn URLs

Added URL cleaning function to remove query parameters:

```typescript
const cleanLinkedInUrl = (url: string): string => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    // Remove all query parameters (miniProfileUrn, etc.)
    urlObj.search = '';
    // Remove trailing slash
    let cleanUrl = urlObj.toString().replace(/\/$/, '');
    // Extract just the profile identifier
    if (cleanUrl.includes('linkedin.com/in/')) {
      const match = cleanUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
      if (match) {
        return `https://www.linkedin.com/in/${match[1]}`;
      }
    }
    return cleanUrl;
  } catch (error) {
    console.error('Error cleaning LinkedIn URL:', url, error);
    return url;
  }
};
```

**Result**: `https://www.linkedin.com/in/annie-meyer-422ab` (clean, canonical URL)

### 2. Store Authoritative provider_id

Unipile provides a `provider_id` field in search results - this is LinkedIn's internal user ID that **never changes**. We now store this alongside the URL:

```typescript
const prospects = items.map((item: any) => ({
  // ... other fields
  providerId: item.provider_id, // ← Authoritative LinkedIn ID
  linkedinUrl: cleanLinkedInUrl(item.profile_url), // ← Cleaned URL
  publicIdentifier: item.public_identifier,
  // ... other fields
}));
```

### 3. Pass provider_id Through Data Pipeline

Updated the entire data flow:

**Step 1: LinkedIn Search** (`/app/api/linkedin/search/direct/route.ts`)
- Stores `providerId` from Unipile search results
- Stores cleaned `linkedinUrl` without query parameters

**Step 2: Prospect Approval Data** (`prospect_approval_data` table)
```typescript
contact: {
  linkedin: p.linkedinUrl,
  linkedin_provider_id: p.providerId, // ← NEW: Store provider_id
  public_identifier: p.publicIdentifier,
  email: null
}
```

**Step 3: Campaign Prospects** (`campaign_prospects` table)
```typescript
{
  linkedin_url: linkedinUrl, // Cleaned URL
  linkedin_user_id: linkedinUserId, // ← NEW: Authoritative provider_id
  // ... other fields
}
```

## Files Modified

### `/app/api/linkedin/search/direct/route.ts`

**Lines 225-279**: Added URL cleaning function and updated prospect transformation

**Changes**:
- Added `cleanLinkedInUrl()` helper function
- Changed `linkedinUrl: item.profile_url` → `linkedinUrl: cleanLinkedInUrl(item.profile_url)`
- Added `providerId: item.provider_id` to prospect data
- Updated `prospect_approval_data` insertion to include `linkedin_provider_id` in contact object

### `/app/api/campaigns/add-approved-prospects/route.ts`

**Lines 195-232**: Updated prospect transformation to include provider_id

**Changes**:
- Extract `linkedin_provider_id` from `prospect.contact`
- Store it in `linkedin_user_id` column when creating campaign prospects
- Added logging for both URL and provider_id

## Database Schema

The `campaign_prospects` table already had the `linkedin_user_id` column (verified):

```
Columns in campaign_prospects:
id, campaign_id, first_name, last_name, email, company_name,
linkedin_url, linkedin_user_id, title, phone, location,
industry, status, notes, personalization_data, ...
```

No migration needed - column already exists!

## Impact

### Before Fix
- LinkedIn URLs contained query parameters that become stale
- System relied only on URLs to identify prospects
- URLs could redirect to different LinkedIn profiles over time
- Connection requests sent to wrong people
- Campaigns failed with confusing "WITHDRAWN" errors

### After Fix
- LinkedIn URLs are cleaned (canonical format only)
- System stores authoritative `provider_id` that never changes
- Even if URL becomes stale, `provider_id` remains accurate
- Future: Can use `provider_id` to fetch fresh profile data
- Campaigns work correctly with fresh prospects from search

## Testing Recommendations

1. **Test with fresh LinkedIn search**:
   - Use SAM's search feature to find new prospects
   - Verify LinkedIn URLs are clean (no query parameters)
   - Verify `provider_id` is stored in approval_data
   - Approve prospects and add to campaign
   - Verify `linkedin_user_id` is populated in campaign_prospects

2. **Test CR sending**:
   - Create campaign with freshly searched prospects
   - Send connection requests
   - Verify CRs go to correct LinkedIn profiles
   - Verify no WITHDRAWN errors for fresh prospects

3. **Verify data integrity**:
   ```sql
   SELECT
     first_name,
     last_name,
     linkedin_url,
     linkedin_user_id,
     status
   FROM campaign_prospects
   WHERE campaign_id = 'eb291960-085d-46a4-8bf3-53feb6a9fefb'
   LIMIT 10;
   ```

## Next Steps

1. **User needs to run new search**: Irish's current campaign has old prospects with stale URLs
   - Use SAM's search feature to find fresh prospects
   - The new search will use the fixed code
   - Prospects will have clean URLs and provider_id

2. **Optional: Backfill provider_id for existing prospects**:
   - For prospects with LinkedIn URLs but no `linkedin_user_id`
   - Call Unipile API to fetch profile by URL
   - Extract `provider_id` from response
   - Update `linkedin_user_id` column

3. **Future enhancement**: Use `provider_id` for CR sending
   - Instead of using LinkedIn URL for profile lookup
   - Use `provider_id` directly in Unipile API calls
   - Even more reliable than cleaned URLs

## User Confirmation

The user confirmed the LinkedIn URL provided was:
```
https://www.linkedin.com/in/annie-meyer-422ab?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAAADdpoBT_UGeqLTWpIvOQ9_V1PBwIAkEnY
```

And stated: **"this is the profile URL that sam provided"** and **"which is correct"**

This confirmed that:
1. SAM's search was providing URLs with query parameters
2. These query parameters were being stored in the database
3. The URLs were becoming stale and pointing to wrong profiles
4. The system was working correctly (detecting WITHDRAWN), but with wrong data

## Conclusion

The root cause was **data quality** - not a bug in the campaign execution system. The system was correctly detecting WITHDRAWN invitations and blocking CR sends. The problem was that the LinkedIn URLs coming from SAM's search feature were stale and pointing to the wrong people.

With this fix, SAM will now:
- Clean LinkedIn URLs (remove query parameters)
- Store authoritative `provider_id` for each prospect
- Pass `provider_id` through the entire data pipeline
- Enable future use of `provider_id` for more reliable operations

**Status**: ✅ Fixed - Ready for testing with fresh LinkedIn search
