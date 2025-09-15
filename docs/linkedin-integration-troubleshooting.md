# LinkedIn Integration Troubleshooting Guide

## Overview
This document provides comprehensive troubleshooting for SAM AI's LinkedIn integration via Unipile. The integration allows users to connect their LinkedIn accounts for prospecting and messaging features.

## Architecture
- **Frontend**: Next.js application with LinkedIn connection UI
- **Backend**: Next.js API routes using Supabase for database
- **External Service**: Unipile API for LinkedIn connectivity
- **Database**: Supabase with `user_unipile_accounts` table for associations

## Required Environment Variables

### Production (Netlify)
```bash
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=
```

### How to Add Environment Variables
```bash
# Using Netlify CLI
netlify env:set UNIPILE_DSN "api6.unipile.com:13670"
netlify env:set UNIPILE_API_KEY "aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU="

# Verify they were added
netlify env:list
```

## Database Schema Requirements

### Required Table: `user_unipile_accounts`

```sql
-- Create table with all required columns
CREATE TABLE IF NOT EXISTS user_unipile_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unipile_account_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'LINKEDIN',
  account_name TEXT,
  account_email TEXT,
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  connection_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_user_id ON user_unipile_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_unipile_account_id ON user_unipile_accounts(unipile_account_id);
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_platform ON user_unipile_accounts(platform);

-- Enable Row Level Security
ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DROP POLICY IF EXISTS "Users can manage their own unipile accounts" ON user_unipile_accounts;
CREATE POLICY "Users can manage their own unipile accounts" ON user_unipile_accounts FOR ALL USING (auth.uid() = user_id);
```

### How to Fix Existing Table Schema
If table exists but missing columns:

```sql
-- Add missing columns (safe to run multiple times)
ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'LINKEDIN';
ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS account_email TEXT;
ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS linkedin_public_identifier TEXT;
ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT;
ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

## Common Issues and Solutions

### 1. "Unable to connect LinkedIn at this time" Error

**Symptoms:**
- UI shows connection page but can't connect
- API returns 503 Service Unavailable

**Cause:** Missing Unipile environment variables in production

**Solution:**
1. Add environment variables to Netlify:
   ```bash
   netlify env:set UNIPILE_DSN "api6.unipile.com:13670"
   netlify env:set UNIPILE_API_KEY "aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU="
   ```
2. Redeploy the application
3. Verify with: `netlify env:list`

### 2. "No LinkedIn connections found" (After 503 Fixed)

**Symptoms:**
- API returns 200 but empty connections array
- User has LinkedIn connected to Unipile but SAM AI doesn't detect it

**Cause:** User's LinkedIn account exists in Unipile but no association in SAM AI database

**Solution:** Auto-association system will create the link automatically when user visits LinkedIn connection page

### 3. "column 'platform' of relation 'user_unipile_accounts' does not exist"

**Symptoms:**
- Database error when trying to create associations
- Table exists but with wrong schema

**Cause:** Table was created with incomplete schema

**Solution:** Run the schema fix SQL commands above in Supabase dashboard

## Debugging Steps

### 1. Check Environment Variables
```bash
# In production
netlify env:list

# Should show:
# UNIPILE_DSN: api6.unipile.com:13670
# UNIPILE_API_KEY: aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=
```

### 2. Check Database Schema
```sql
-- Check if table exists and has correct columns
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_unipile_accounts' 
AND table_schema = 'public'
ORDER BY ordinal_position;
```

### 3. Test Unipile API Connection
```bash
# Test API endpoint
curl -X GET "https://app.meet-sam.com/api/unipile/accounts" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### 4. Check Browser Console
Open browser dev tools and look for:
- Network errors in the Console tab
- Failed API calls in the Network tab
- Check response bodies for error details

### 5. Check Application Logs
```bash
# Check Netlify function logs
netlify functions:log

# Look for:
# - "🔧 Starting auto-association check"
# - "✅ LinkedIn account auto-associated"
# - "❌ Error" messages
```

## Auto-Association System

The system automatically creates associations between Unipile accounts and SAM AI users when:

1. User visits the LinkedIn connection page (`/linkedin-integration`)
2. User is authenticated with Clerk
3. User's LinkedIn account exists in Unipile
4. No existing association found in database

### How It Works
1. Fetch all Unipile accounts
2. For each LinkedIn account, try to match with current user
3. Create association record with LinkedIn account details
4. User sees "Great! You have X LinkedIn account(s) connected"

### Matching Logic
The system matches Unipile LinkedIn accounts to SAM AI users based on:
- Email domain matching
- Account name similarity
- Manual admin configuration (if needed)

## Testing the Integration

### 1. Use Test Page
Visit `/test-association` to run comprehensive tests:
- Database setup verification
- Manual association testing
- Production API testing

### 2. Manual Testing Steps
1. Ensure user is logged in to SAM AI
2. Visit `/linkedin-integration`
3. Check browser console for auto-association logs
4. Verify connection status displays correctly

### 3. Admin Tools
- `/api/admin/fix-user-unipile-table` - Fix database schema
- `/test-association` - Comprehensive testing interface

## File Locations

### Key API Routes
- `/app/api/unipile/accounts/route.ts` - Main Unipile integration endpoint
- `/app/api/linkedin/associate/route.ts` - Manual association endpoint
- `/app/api/admin/fix-user-unipile-table/route.ts` - Schema fix endpoint

### Frontend Components
- `/app/linkedin-integration/page.tsx` - Main LinkedIn connection UI
- `/app/test-association/page.tsx` - Testing interface

### Configuration
- `/.env.local` - Local environment variables
- Netlify dashboard - Production environment variables

## Maintenance

### Regular Checks
1. **Monthly**: Verify Unipile API connectivity
2. **Quarterly**: Review auto-association success rates
3. **As needed**: Update environment variables if Unipile credentials change

### Monitoring
- Watch for 503 errors in Netlify logs
- Monitor user reports of connection issues
- Check database for orphaned association records

### Updates
When updating the integration:
1. Test in development first
2. Use `/test-association` page to verify
3. Deploy during low-traffic periods
4. Monitor logs immediately after deployment

## Emergency Procedures

### If LinkedIn Integration Completely Breaks
1. Check environment variables first
2. Verify database schema with SQL commands above
3. Test Unipile API connectivity
4. Check for breaking changes in Unipile API
5. Roll back to previous working version if needed

### If Auto-Association Fails for New Users
1. Check user's email and Unipile account matching
2. Verify RLS policies are correct
3. Test with admin override if needed
4. Consider manual association as temporary fix

## Contact Information
- **Unipile API Docs**: https://developer.unipile.com
- **Supabase Dashboard**: https://latxadqrvrrrcvkktrog.supabase.co
- **Netlify Dashboard**: https://app.netlify.com

---

**Last Updated**: September 16, 2025  
**Next Review**: December 16, 2025