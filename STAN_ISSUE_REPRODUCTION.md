# Stan's Issue - Reproduction Steps

**User:** Stan Bounev (stan01@signali.ai)
**Workspace:** Blue Label Labs
**Workspace ID:** 014509ba-226e-43ee-ba58-ab5f20d2ed08

## Current State (Verified via DB)
- ✅ LinkedIn account connected and active
- ✅ 0 campaigns
- ✅ 0 prospects in campaigns  
- ✅ 0 approved prospects waiting
- ❌ 0 knowledge base documents
- ⚠️ 2 members but 0 owners (potential permission issue?)

## Reported Issues

### Issue 1: Import button doesn't work
**Stan:** "I can't upload more documents as the import button doesn't work"

**Hypothesis:** 
- Button may be disabled due to permission issue (0 owners in workspace)
- Or button exists but has no onClick handler
- Or API endpoint failing silently

**To Test:**
1. Go to https://app.meet-sam.com
2. Login with stan01@signali.ai
3. Navigate to Knowledge Base section
4. Try to upload a document
5. Check browser console for errors

### Issue 2: Target Profile buttons not active
**Stan:** "If I click Target Profile under ICP Configuration, the buttons are not active"

**Hypothesis:**
- These aren't actually buttons - they're display-only badges (lines 758-895 in KnowledgeBase.tsx)
- They show example data as `<span>` tags with no onClick
- Stan expects them to be editable but they're just previews

**To Test:**
1. Go to Knowledge Base → ICP Configuration → Target Profile
2. Verify these are just static badges
3. Look for actual edit/upload functionality

### Issue 3: Campaign can't start
**Stan:** "Campaign can't start as it needs more info"

**Hypothesis:**
- Campaign requires KB documents to generate messaging
- Since Blue Label Labs has 0 KB docs, campaigns are blocked
- OR approved prospects = 0, so no one to message

**To Test:**
1. Try to create/activate a campaign
2. Check what validation errors appear
3. Verify if KB documents are required

## Database Evidence

```sql
-- Blue Label Labs has:
- 0 KB documents (blocks campaign messaging)
- 0 approved prospects (blocks campaign execution)
- 0 owners (may block certain actions)
```

## Next Steps

1. **Login as Stan** to see exact UI state
2. **Reproduce each issue** with screenshots
3. **Fix root cause** (likely: no KB docs = can't proceed)
4. **Add owner role** to Stan if needed

