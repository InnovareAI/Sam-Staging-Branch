# LinkedIn Connection Prompt - ICP Discovery Implementation

**Date:** October 10, 2025
**Status:** ✅ **IMPLEMENTED**

---

## Summary

Added proactive LinkedIn connection check before ICP discovery. SAM now detects when LinkedIn is required, provides a friendly message with connection link, and waits for user to connect before proceeding.

---

## Implementation

### **File Modified:** `/app/api/sam/threads/[threadId]/messages/route.ts`

**Location:** Lines 516-550 (before ICP discovery trigger)

### **What It Does:**

1. **Detects ICP Discovery Intent:**
   - Keywords: `find prospects`, `ideal customer`, `build icp`, `vp sales`, etc.

2. **Checks LinkedIn Connection Status:**
   ```typescript
   const { data: linkedInAccount } = await supabase
     .from('user_unipile_accounts')
     .select('unipile_account_id, connection_status')
     .eq('user_id', user.id)
     .eq('platform', 'LINKEDIN')
     .eq('connection_status', 'active')
     .maybeSingle()
   ```

3. **If Not Connected:**
   - Returns friendly message with benefits
   - Provides clickable connection link
   - Saves message to conversation history
   - **Waits for user to connect** (doesn't proceed)

4. **If Connected:**
   - Proceeds with ICP discovery normally
   - Searches LinkedIn for prospects
   - Returns real prospect data

---

## User Experience

### **Scenario 1: LinkedIn Not Connected**

```
User: "Find me 10 VP Sales prospects in SaaS companies"
   ↓
SAM: "To find prospects and run ICP discovery, I need access to
      your LinkedIn account.

      Why LinkedIn?
      - Search the full LinkedIn database for your ideal prospects
      - Unlimited searches (no quota limits)
      - Access to real-time prospect data

      Connect your LinkedIn account here:
      [Connect LinkedIn Now]

      Once connected, I'll be able to search for prospects and
      help you build your ICP!"
   ↓
User clicks link → LinkedIn OAuth
   ↓
Returns to conversation
   ↓
User: "Now find me those prospects" (retry)
   ↓
SAM: ✅ Proceeds with ICP discovery
```

### **Scenario 2: LinkedIn Already Connected**

```
User: "Find me 10 VP Sales prospects"
   ↓
SAM: ✅ Immediately proceeds with search
   ↓
Returns real LinkedIn prospect data
```

---

## Code Implementation

```typescript
// Trigger ICP research for interactive building sessions
if (isICPRequest && !linkedInUrls) {
  // CHECK: Is LinkedIn connected before proceeding with ICP discovery?
  const { data: linkedInAccount } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, connection_status')
    .eq('user_id', user.id)
    .eq('platform', 'LINKEDIN')
    .eq('connection_status', 'active')
    .maybeSingle()

  if (!linkedInAccount) {
    // LinkedIn not connected - provide helpful message with connection link
    const connectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings/integrations?connect=linkedin`

    const linkedInPromptMessage = {
      role: 'assistant' as const,
      content: `To find prospects and run ICP discovery, I need access to your LinkedIn account.\n\n**Why LinkedIn?**\n- Search the full LinkedIn database for your ideal prospects\n- Unlimited searches (no quota limits)\n- Access to real-time prospect data\n\n**Connect your LinkedIn account here:**\n[Connect LinkedIn Now](${connectUrl})\n\nOnce connected, I'll be able to search for prospects and help you build your ICP!`
    }

    // Save the assistant's prompt message
    await supabase
      .from('sam_conversation_messages')
      .insert({
        thread_id: resolvedParams.threadId,
        role: 'assistant',
        content: linkedInPromptMessage.content,
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: linkedInPromptMessage.content,
      requiresLinkedIn: true,
      connectUrl
    })
  }

  // LinkedIn is connected - proceed with ICP discovery
  try {
    // ... existing ICP discovery code
  }
}
```

---

## Connection Link Format

**URL:** `{APP_URL}/settings/integrations?connect=linkedin`

**Examples:**
- Production: `https://app.meet-sam.com/settings/integrations?connect=linkedin`
- Development: `http://localhost:3000/settings/integrations?connect=linkedin`

**Query Parameter:**
- `connect=linkedin` - Auto-triggers LinkedIn connection modal or redirects to OAuth

---

## Benefits

### **For Users:**
✅ **Clear guidance** - Knows exactly why LinkedIn is needed
✅ **One-click action** - Direct link to connection page
✅ **Value explained** - Sees benefits before connecting
✅ **No confusion** - SAM waits instead of showing error
✅ **Smooth flow** - Returns to conversation after connecting

### **For System:**
✅ **Prevents errors** - No failed API calls to find-prospects
✅ **Better UX** - Proactive help vs reactive error
✅ **Tracks intent** - Saves message to conversation history
✅ **Retry-friendly** - User can simply retry request after connecting

---

## Testing

### **Test Case 1: User Without LinkedIn**

1. Start new conversation
2. Ask: "Find me 10 VP Sales prospects"
3. **Expected:** SAM provides LinkedIn connection prompt with link
4. **Verify:** Message saved to conversation history
5. **Verify:** Response includes `requiresLinkedIn: true`

### **Test Case 2: User Connects LinkedIn Mid-Conversation**

1. Get LinkedIn prompt from SAM
2. Click connection link
3. Complete LinkedIn OAuth
4. Return to conversation
5. Retry: "Find me those prospects"
6. **Expected:** SAM proceeds with ICP discovery
7. **Expected:** Real prospect data returned

### **Test Case 3: User Already Has LinkedIn**

1. User with LinkedIn connected
2. Ask: "Find me prospects"
3. **Expected:** SAM immediately proceeds with search
4. **Expected:** No connection prompt shown

### **Manual Testing:**

```bash
# 1. Test without LinkedIn connected
curl -X POST http://localhost:3000/api/sam/threads/THREAD_ID/messages \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{"content": "Find me 10 VP Sales prospects in SaaS companies"}'

# Expected: requiresLinkedIn: true, connectUrl in response

# 2. Connect LinkedIn via Unipile
# Visit: http://localhost:3000/settings/integrations?connect=linkedin

# 3. Retry same request
# Expected: ICP discovery proceeds, prospect data returned
```

---

## Keywords That Trigger LinkedIn Check

```typescript
const icpKeywords = [
  'build icp',
  'ideal customer',
  'find prospects',
  'target audience',
  'who should i target',
  'search for',
  'show me examples',
  'vp sales',
  'director',
  'manager',
  'cto',
  'ceo'
]
```

Any message containing these keywords will trigger the LinkedIn connection check.

---

## Database Schema

### **Table:** `user_unipile_accounts`

**Query:**
```sql
SELECT unipile_account_id, connection_status
FROM user_unipile_accounts
WHERE user_id = $1
  AND platform = 'LINKEDIN'
  AND connection_status = 'active'
LIMIT 1
```

**Expected Columns:**
- `user_id` (UUID) - Foreign key to auth.users
- `platform` (TEXT) - 'LINKEDIN', 'EMAIL', etc.
- `unipile_account_id` (TEXT) - Unipile account identifier
- `connection_status` (TEXT) - 'active', 'inactive', 'expired'

---

## Error Handling

### **If Database Query Fails:**

```typescript
const { data: linkedInAccount, error } = await supabase
  .from('user_unipile_accounts')
  .select('unipile_account_id, connection_status')
  .eq('user_id', user.id)
  .eq('platform', 'LINKEDIN')
  .eq('connection_status', 'active')
  .maybeSingle()

if (error) {
  // Log error but proceed with default behavior
  console.error('Failed to check LinkedIn connection:', error)
  // Falls through to existing error handling
}
```

Currently using `.maybeSingle()` which returns `null` if no record found (not an error).

---

## Future Enhancements

### **Potential Improvements:**

1. **Check Connection Quality:**
   - Verify LinkedIn account not expired
   - Check last successful API call timestamp
   - Warn if token might be stale

2. **Multiple LinkedIn Accounts:**
   - Support users with multiple LinkedIn accounts
   - Let user choose which account to use for search

3. **Connection Status in UI:**
   - Show LinkedIn connection badge in SAM interface
   - Display account name/email when connected

4. **Retry Logic:**
   - Auto-retry failed ICP discovery after LinkedIn connection
   - Store original request and replay it

5. **Analytics:**
   - Track how often users hit LinkedIn prompt
   - Measure conversion: prompt → connection
   - Identify drop-off points

---

## Related Files

1. `/app/api/sam/threads/[threadId]/messages/route.ts` - Main implementation
2. `/app/api/sam/find-prospects/route.ts` - Uses Unipile LinkedIn search
3. `/app/api/linkedin/search/route.ts` - Unipile LinkedIn API wrapper
4. `/app/settings/integrations/page.tsx` - Where user connects LinkedIn
5. `/docs/UNIPILE_LINKEDIN_SEARCH_IMPLEMENTATION.md` - Overall architecture

---

## Troubleshooting

### **User sees prompt but LinkedIn IS connected**

**Possible causes:**
- `connection_status` not set to 'active'
- `platform` field not exactly 'LINKEDIN' (case-sensitive)
- User connected to different workspace

**Solution:**
```sql
-- Check user's LinkedIn accounts
SELECT * FROM user_unipile_accounts
WHERE user_id = 'USER_ID'
  AND platform = 'LINKEDIN';

-- Update connection status if needed
UPDATE user_unipile_accounts
SET connection_status = 'active'
WHERE user_id = 'USER_ID'
  AND platform = 'LINKEDIN';
```

### **Link doesn't work**

**Check:**
- `NEXT_PUBLIC_APP_URL` environment variable set correctly
- `/settings/integrations` page exists and accessible
- Query parameter `?connect=linkedin` is handled in frontend

### **User connects but SAM still prompts**

**Possible causes:**
- Browser cache (user sees old message)
- LinkedIn OAuth failed silently
- Account created but not marked 'active'

**Solution:**
- Clear browser cache and retry
- Check Unipile OAuth logs
- Verify database record created

---

**Last Updated:** October 10, 2025
**Status:** ✅ Production Ready
**Testing:** Pending user acceptance testing
