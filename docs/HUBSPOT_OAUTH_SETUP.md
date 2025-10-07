# HubSpot OAuth Integration Setup Guide

## Overview

This guide walks through setting up HubSpot OAuth integration for SAM AI CRM connectivity.

## Required Environment Variables

Add these to `.env.local`:

```bash
HUBSPOT_CLIENT_ID=your_client_id_here
HUBSPOT_CLIENT_SECRET=your_client_secret_here
HUBSPOT_REDIRECT_URI=https://app.meet-sam.com/api/crm/oauth/callback
```

## Step 1: Create HubSpot App

1. **Go to HubSpot Developer Account**
   - Visit: https://developers.hubspot.com/
   - Sign in with your HubSpot account (or create one)

2. **Create a New App**
   - Click "Apps" in the top navigation
   - Click "Create app"
   - Fill in app details:
     - **App name**: SAM AI CRM Integration
     - **Description**: AI-powered sales automation with CRM sync
     - **Logo**: (optional) Upload SAM AI logo

3. **Configure Auth Tab**
   - Click the "Auth" tab
   - **Redirect URL**: `https://app.meet-sam.com/api/crm/oauth/callback`
   - Click "Add redirect URL"

4. **Set Required Scopes**

   Navigate to the "Auth" tab and add these scopes:

   **Contacts:**
   - `crm.objects.contacts.read` - Read contact data
   - `crm.objects.contacts.write` - Create/update contacts

   **Companies:**
   - `crm.objects.companies.read` - Read company data
   - `crm.objects.companies.write` - Create/update companies

   **Deals:**
   - `crm.objects.deals.read` - Read deal data
   - `crm.objects.deals.write` - Create/update deals

5. **Get Your Credentials**
   - Go to the "Auth" tab
   - Copy **Client ID**
   - Copy **Client Secret** (click "Show" first)

## Step 2: Add Credentials to Environment

Edit `.env.local`:

```bash
# HubSpot OAuth
HUBSPOT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
HUBSPOT_CLIENT_SECRET=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
HUBSPOT_REDIRECT_URI=https://app.meet-sam.com/api/crm/oauth/callback
```

**For local development**, also add to `.env.local`:

```bash
# Development override
HUBSPOT_REDIRECT_URI=http://localhost:3000/api/crm/oauth/callback
```

## Step 3: Deploy Environment Variables to Netlify

```bash
# Set HubSpot credentials in Netlify
netlify env:set HUBSPOT_CLIENT_ID "your_client_id_here"
netlify env:set HUBSPOT_CLIENT_SECRET "your_client_secret_here"
netlify env:set HUBSPOT_REDIRECT_URI "https://app.meet-sam.com/api/crm/oauth/callback"
```

## Step 4: Test the Integration

### Method 1: Via UI (Recommended)

1. Go to https://app.meet-sam.com
2. Navigate to your workspace dashboard
3. Click "CRM Integration" tile
4. Click "Connect" on the HubSpot card
5. Authorize the app in HubSpot
6. Verify connection status shows "Connected"

### Method 2: Via API

```bash
# Initiate OAuth flow
curl -X POST https://app.meet-sam.com/api/crm/oauth/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "workspace_id": "your-workspace-id",
    "crm_type": "hubspot"
  }'

# Response will include auth_url - visit it to authorize
# After authorization, HubSpot redirects to callback URL
# Connection is saved to crm_connections table
```

## OAuth Flow Details

### 1. Initiation
- User clicks "Connect HubSpot"
- Frontend calls `/api/crm/oauth/initiate`
- API generates HubSpot OAuth URL with state parameter
- User is redirected to HubSpot

### 2. Authorization
- User signs into HubSpot
- User grants requested permissions
- HubSpot redirects back to callback URL with code

### 3. Callback & Token Exchange
- `/api/crm/oauth/callback` receives authorization code
- Exchanges code for access_token + refresh_token
- Stores tokens in `crm_connections` table (encrypted)
- Redirects user back to dashboard

### 4. Token Storage
```sql
-- Tokens stored securely in database
INSERT INTO crm_connections (
  workspace_id,
  crm_type,
  access_token,      -- Encrypted
  refresh_token,     -- Encrypted
  token_expires_at,
  connection_metadata
)
```

### 5. Token Refresh
- Access tokens expire after 6 hours
- Refresh tokens last indefinitely (until revoked)
- Auto-refresh happens in HubSpot adapter before API calls

## Testing Checklist

- [ ] HubSpot app created in developer portal
- [ ] Redirect URL configured: `https://app.meet-sam.com/api/crm/oauth/callback`
- [ ] All 6 scopes added (contacts, companies, deals - read/write)
- [ ] Client ID and Secret copied
- [ ] Environment variables set in `.env.local`
- [ ] Environment variables deployed to Netlify
- [ ] OAuth flow tested end-to-end
- [ ] Connection shows as active in database
- [ ] Test contact sync works

## Troubleshooting

### Error: "Invalid redirect_uri"
- **Cause**: Redirect URI in HubSpot app doesn't match environment variable
- **Fix**: Ensure exact match including protocol (https://)

### Error: "Invalid client_id"
- **Cause**: Wrong Client ID or not deployed to production
- **Fix**: Double-check Client ID, redeploy environment variables

### Error: "insufficient_scope"
- **Cause**: Missing required scopes in HubSpot app
- **Fix**: Add all 6 scopes listed above

### Tokens not refreshing
- **Cause**: Missing or invalid refresh_token
- **Fix**: Delete connection, reconnect to get new tokens

## Security Notes

- ✅ Tokens are stored encrypted in database
- ✅ Only service role can access raw tokens
- ✅ RLS policies enforce workspace isolation
- ✅ Refresh tokens rotated on each refresh
- ✅ Users can disconnect/revoke at any time

## Next Steps After Setup

1. **Test Contact Sync**
   - Create a contact in SAM AI
   - Verify it appears in HubSpot
   - Update in HubSpot, verify sync back

2. **Configure Field Mappings**
   - Map custom HubSpot fields to SAM fields
   - Set up bi-directional sync preferences

3. **Enable MCP Tools**
   - Build MCP server: `cd mcp-crm-server && npm run build`
   - SAM AI can now query HubSpot data via MCP

4. **Set Up Webhooks** (Optional)
   - Real-time updates from HubSpot
   - Faster sync than polling

---

**Created**: October 6, 2025
**Last Updated**: October 6, 2025
**Status**: Ready for configuration
