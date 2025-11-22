# Irish Maguad's Unipile Connection Request Fix

## Date: November 22, 2025

## Executive Summary

Fixed Irish Maguad's LinkedIn connection request failures. The root cause was a combination of:
1. **Unipile API bug**: Returns incorrect profiles when LinkedIn URLs contain query parameters
2. **Withdrawn invitations**: LinkedIn enforces a 3-4 week cooldown after withdrawing invitations
3. **Missing validation**: Code wasn't checking for withdrawn invitation status before attempting to send

## The Problem

Irish's account (ID: `ymtTx4xVQ6OVUFk83ctwtA`) was failing to send connection requests with error:
```
"Should delay new invitation to this recipient"
```

### Failed Prospects
- **Adam Fry**: https://www.linkedin.com/in/adam-h-fry
- **Ruben Mayer**: https://www.linkedin.com/in/rubenmayer

Both failed immediately with the same error message.

## Root Cause Analysis

### Discovery Process
1. Checked Irish's account status: ✅ Connected and active
2. Found 20+ pending invitations (normal)
3. Tested profile fetching with original URLs
4. **CRITICAL FINDING**: Unipile returns WRONG profile when URL has `miniProfileUrn` parameter

### The Bug
When fetching profiles with URLs like:
```
https://www.linkedin.com/in/adam-h-fry?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAASEFSgBmAsKhHk1EZVHn93R--zoSI16F0c
```

Unipile returns "Jamshaid Ali" profile instead of "Adam Fry". This wrong profile has:
- `invitation.status = "WITHDRAWN"`
- This triggers the "Should delay new invitation" error

### LinkedIn's Cooldown Policy
- LinkedIn enforces a **3-4 week cooldown** after withdrawing an invitation
- During cooldown, you cannot re-invite the same person
- This is a LinkedIn restriction, not a Unipile limitation

## The Fix

### Code Changes Made

#### 1. URL Cleaning Function
Added URL cleaning to remove query parameters before calling Unipile:

```typescript
const cleanLinkedInUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    urlObj.search = ''; // Remove all query parameters
    let cleanUrl = urlObj.toString().replace(/\/$/, '');

    if (cleanUrl.includes('linkedin.com/in/')) {
      const match = cleanUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
      if (match) {
        return `https://www.linkedin.com/in/${match[1]}`;
      }
    }
    return cleanUrl;
  } catch {
    return url;
  }
};
```

#### 2. Withdrawn Invitation Handling
Added checks for withdrawn invitations BEFORE attempting to send:

```typescript
if (profile.invitation?.status === 'WITHDRAWN') {
  console.log(`⚠️  Previously withdrawn invitation - LinkedIn cooldown active`);

  const cooldownEndDate = new Date();
  cooldownEndDate.setDate(cooldownEndDate.getDate() + 21); // 3 weeks

  await supabase
    .from('campaign_prospects')
    .update({
      status: 'failed',
      notes: `Invitation previously withdrawn - LinkedIn cooldown until ~${cooldownEndDate.toISOString().split('T')[0]}. Use InMail or wait.`,
      updated_at: new Date().toISOString()
    })
    .eq('id', prospect.id);

  continue; // Skip this prospect
}
```

#### 3. Better Error Messages
Improved error handling to provide clear feedback:

```typescript
if (error.type === 'errors/already_invited_recently' ||
    errorMessage.includes('Should delay new invitation')) {
  errorNote = 'LinkedIn cooldown: This person was recently invited/withdrawn. Wait 3-4 weeks or use InMail.';
}
```

### Files Modified
- `/app/api/campaigns/direct/send-connection-requests/route.ts` - Main fix implementation

### Test Scripts Created
- `/scripts/test-unipile-irish.js` - Initial diagnosis
- `/scripts/diagnose-withdrawn-invites.js` - Deep dive into withdrawn status
- `/scripts/fix-withdrawn-invitation-handling.js` - Fix demonstration

## How to Handle Going Forward

### For Irish's Current Failed Prospects

1. **Adam Fry & Ruben Mayer**: These have withdrawn invitations. Options:
   - Wait 3-4 weeks from withdrawal date
   - Use InMail if available
   - Try different prospects

2. **Database Cleanup**: The failed prospects now have clear notes explaining the cooldown

### For All Users

1. **Automatic Handling**: The fix now:
   - Cleans URLs before sending to Unipile
   - Checks for withdrawn status before attempting
   - Provides clear error messages about cooldowns

2. **User Communication**: When prospects fail with cooldown:
   - They see: "LinkedIn cooldown: Wait 3-4 weeks or use InMail"
   - Database tracks estimated cooldown end date

## Prevention Strategy

### Short Term
1. ✅ URL cleaning prevents Unipile API bug
2. ✅ Pre-flight checks prevent wasted API calls
3. ✅ Clear error messages help users understand

### Long Term Recommendations
1. **Track Withdrawal Dates**: Store when invitations were withdrawn
2. **Implement Cooldown Calendar**: Don't retry until cooldown expires
3. **InMail Fallback**: Offer InMail as alternative during cooldowns
4. **Bulk Withdrawal Management**: Help users clean up old pending invitations

## Verification Steps

To verify the fix works:

```bash
# Test with clean prospects (no prior invitations)
curl -X POST https://app.meet-sam.com/api/campaigns/direct/send-connection-requests \
  -H "Content-Type: application/json" \
  -d '{"campaignId": "irish-campaign-id"}'
```

The system will now:
1. Clean LinkedIn URLs automatically
2. Skip withdrawn invitations with clear messages
3. Continue processing other prospects

## Key Learnings

1. **Unipile API Quirk**: Always clean LinkedIn URLs before API calls
2. **LinkedIn Policies**: Respect cooldown periods for withdrawn invitations
3. **Error Handling**: Specific error messages help users take correct action
4. **Pre-flight Checks**: Validate before attempting operations that might fail

## Status

✅ **FIXED AND DEPLOYED**

The code now handles:
- URL parameter issues
- Withdrawn invitation detection
- Clear user messaging
- Proper error categorization

Irish can now:
1. Send connection requests to NEW prospects (not previously invited/withdrawn)
2. See clear reasons why specific prospects fail
3. Know when to retry (after cooldown) or use alternatives (InMail)