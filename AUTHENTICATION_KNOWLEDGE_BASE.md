# SAM AI Authentication & Password System - Knowledge Base

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Magic Link Authentication](#magic-link-authentication)
3. [User Registration & Onboarding](#user-registration--onboarding)
4. [Workspace Management](#workspace-management)
5. [Technical Implementation](#technical-implementation)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Security Features](#security-features)
8. [API Reference](#api-reference)

---

## 🎯 System Overview

### Architecture Summary
SAM AI uses a **passwordless authentication system** built on Supabase Auth with magic link delivery via Postmark. The system provides seamless user onboarding with automatic workspace assignment and enterprise-grade security.

### Key Components
- **Supabase Authentication**: User identity and session management
- **Magic Link System**: Passwordless login via Edge Functions
- **Postmark Email Service**: Reliable email delivery bypassing rate limits
- **Workspace Auto-Assignment**: Automatic organizational setup
- **Multi-tenant Architecture**: Organization-based data isolation

### User Flow
```
User Signup → Email Verification → Magic Link → Auto-Login → Workspace Assignment → Dashboard Access
```

---

## 🔗 Magic Link Authentication

### How It Works
1. **User Request**: User enters email on login/reset page
2. **Edge Function**: Generates secure magic link via Supabase Admin API
3. **Email Delivery**: Professional branded email sent via Postmark
4. **Authentication**: User clicks link, gets auto-authenticated
5. **Redirect**: Seamless redirect to dashboard with workspace context

### Technical Implementation

#### Edge Function: `/supabase/functions/send-magic-link/index.ts`
```typescript
// Generate magic link using Admin API (bypasses rate limiting)
const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
  type: 'magiclink',
  email: email,
  options: {
    redirectTo: `${Deno.env.get('SITE_URL')}/auth/callback`
  }
});
```

#### Key Features
- **Rate Limit Bypass**: Uses Supabase Admin API instead of client-side OTP
- **Professional Emails**: Branded templates with SAM AI design
- **Security**: 30-minute expiration, single-use tokens
- **Reliable Delivery**: Postmark integration with verified domain

#### Configuration
```bash
# Supabase Edge Function Environment Variables
SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
POSTMARK_SERVER_TOKEN=bf9e070d-eec7-4c41-8fb5-1d37fe384723
SITE_URL=https://app.meet-sam.com
```

---

## 👤 User Registration & Onboarding

### Registration Process

#### 1. Signup Form (`/app/api/auth/signup/route.ts`)
- **Email validation**: Standard email format verification
- **Password requirements**: Minimum 8 characters (clearly communicated)
- **User creation**: Supabase Auth user creation
- **No immediate workspace**: Workspace assigned after email confirmation

#### 2. Email Confirmation
- **Automatic email**: Supabase sends confirmation email
- **Verification required**: User must verify email before access
- **Callback processing**: Handled by `/app/auth/callback/route.ts`

#### 3. Workspace Auto-Assignment
```typescript
// Check if user has workspace, create if needed
if (!userCheckError && existingUser && !existingUser.default_workspace_id) {
  // Try to add to InnovareAI workspace
  const { data: innovareWorkspace } = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .eq('name', 'InnovareAI')
    .single();

  if (innovareWorkspace) {
    // Add to existing InnovareAI workspace
  } else {
    // Create personal workspace
  }
}
```

### Registration Fixes Applied

#### ❌ **Previous Issue**: Password Requirement Confusion
- **Problem**: Placeholder showed "min 6 characters" but validation required 8
- **User Impact**: Signup failures and user complaints
- **Solution**: Updated placeholder to "min 8 characters"
- **File**: `/app/api/auth/signup/route.ts`

#### ❌ **Previous Issue**: Missing Workspace Assignment
- **Problem**: Users authenticated but had no workspace, causing redirect loops
- **User Impact**: "Successfully signed in" but stuck on login page
- **Solution**: Auto-workspace creation in auth callback
- **File**: `/app/auth/callback/route.ts`

---

## 🏢 Workspace Management

### Workspace Structure
```sql
-- Workspaces table
CREATE TABLE workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (connects to Supabase Auth)
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  default_workspace_id UUID REFERENCES workspaces(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Auto-Assignment Logic

#### Primary: InnovareAI Workspace
- **Target**: All new users added to shared "InnovareAI" workspace
- **Benefits**: Centralized user management, shared resources
- **Implementation**: Automatic assignment during email confirmation

#### Fallback: Personal Workspace
- **Trigger**: If InnovareAI workspace doesn't exist
- **Creation**: Personal workspace with user's name
- **Isolation**: Individual user environment

### Workspace Operations
```typescript
// Add user to workspace
const { error: memberError } = await supabaseAdmin
  .from('workspace_members')
  .insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'member'
  });

// Update user's default workspace
const { error: updateError } = await supabaseAdmin
  .from('users')
  .upsert({
    id: user.id,
    email: user.email,
    default_workspace_id: workspace.id
  });
```

---

## ⚙️ Technical Implementation

### File Structure
```
/app/api/auth/
├── signup/route.ts              # User registration endpoint
├── reset-password/route.ts      # Magic link request endpoint
└── callback/route.ts            # Auth callback handler

/supabase/functions/
└── send-magic-link/
    └── index.ts                 # Edge Function for magic links

/app/auth/
└── callback/
    └── route.ts                 # Authentication callback processing
```

### Key API Endpoints

#### 1. User Registration
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### 2. Magic Link Request
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### 3. Authentication Callback
```http
GET /auth/callback?access_token=...&refresh_token=...
```

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  default_workspace_id UUID REFERENCES workspaces(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Workspaces Table
```sql
CREATE TABLE workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Workspace Members Table
```sql
CREATE TABLE workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);
```

---

## 🛠️ Troubleshooting Guide

### Common Issues & Solutions

#### 🚨 **"No email received"**
**Symptoms**: User requests magic link but doesn't receive email
**Diagnosis Steps**:
1. Check Postmark API response in Edge Function logs
2. Verify sender domain (`tl@innovareai.com`) is valid
3. Check spam/junk folders
4. Test Postmark API directly

**Solution**:
```bash
# Test Edge Function directly
node test-magic-link.js

# Test Postmark API directly  
node test-postmark-direct.js
```

#### 🚨 **"Invalid or expired reset link"**
**Symptoms**: Magic link doesn't work when clicked
**Diagnosis**:
- Links expire after 30 minutes
- Single-use tokens become invalid after first use
- Check URL parameters are intact

**Solution**: Request new magic link

#### 🚨 **"Authentication redirect loop"**
**Symptoms**: User successfully authenticates but gets stuck on login page
**Diagnosis**: User has no workspace assigned
**Solution**:
```typescript
// Check user workspace assignment
const { data: user } = await supabase
  .from('users')
  .select('default_workspace_id')
  .eq('email', 'user@example.com')
  .single();

// If null, workspace assignment failed
```

#### 🚨 **"Organization Access Error"**
**Symptoms**: Database queries fail with UUID errors
**Diagnosis**: Invalid organization context or missing workspace
**Solution**: Ensure proper workspace assignment and UUID format

### Debugging Tools

#### Edge Function Logs
```bash
# View function deployment status
supabase functions list --project-ref latxadqrvrrrcvkktrog

# Check function execution (via Supabase Dashboard)
# https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/functions
```

#### Database Queries
```sql
-- Check user workspace assignments
SELECT u.email, w.name as workspace_name
FROM users u
LEFT JOIN workspaces w ON u.default_workspace_id = w.id
WHERE u.email = 'user@example.com';

-- Check workspace members
SELECT w.name, u.email, wm.role
FROM workspace_members wm
JOIN workspaces w ON wm.workspace_id = w.id
JOIN users u ON wm.user_id = u.id;
```

---

## 🔒 Security Features

### Authentication Security
- **Magic Links**: 30-minute expiration, single-use tokens
- **HTTPS Only**: All authentication flows require HTTPS
- **Session Management**: Supabase handles secure session tokens
- **Rate Limiting**: Bypassed via Admin API, preventing abuse

### Data Security
- **Row Level Security (RLS)**: Enabled on all tables
- **Workspace Isolation**: Users only access their workspace data
- **API Key Protection**: Service role keys secured in environment variables
- **Email Verification**: Required before account activation

### Postmark Security
- **Domain Verification**: `innovareai.com` domain verified in Postmark
- **API Key Rotation**: Regular rotation of Postmark server tokens
- **SPF/DKIM**: Email authentication configured
- **Sender Reputation**: Professional sender identity maintained

---

## 📚 API Reference

### Edge Function: send-magic-link

#### Endpoint
```
POST https://latxadqrvrrrcvkktrog.supabase.co/functions/v1/send-magic-link
```

#### Headers
```http
Authorization: Bearer [anon-key]
Content-Type: application/json
```

#### Request Body
```json
{
  "email": "user@example.com"
}
```

#### Response Success (200)
```json
{
  "success": true,
  "message": "Magic link sent to your email - check your inbox!",
  "messageId": "uuid-from-postmark"
}
```

#### Response Error (400/500)
```json
{
  "error": "Email is required"
}
```

### Authentication Callback

#### URL Pattern
```
https://app.meet-sam.com/auth/callback#access_token=...&expires_in=3600&refresh_token=...&token_type=bearer&type=magiclink
```

#### Processing
1. Extract tokens from URL hash
2. Set Supabase session
3. Check/create user workspace
4. Redirect to dashboard

### Database Operations

#### Create User
```typescript
const { data, error } = await supabase
  .from('users')
  .upsert({
    id: authUser.id,
    email: authUser.email,
    default_workspace_id: workspaceId
  });
```

#### Check Workspace Membership
```typescript
const { data, error } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('user_id', userId)
  .eq('workspace_id', workspaceId)
  .single();
```

---

## 📊 Monitoring & Maintenance

### Key Metrics to Monitor
1. **Email Delivery Rate**: Postmark dashboard
2. **Authentication Success Rate**: Supabase Auth dashboard
3. **Edge Function Performance**: Supabase Functions dashboard
4. **User Onboarding Completion**: Custom analytics

### Regular Maintenance Tasks
1. **Monitor Email Reputation**: Check Postmark sender score
2. **Rotate API Keys**: Quarterly rotation of sensitive keys
3. **Update Dependencies**: Keep Supabase CLI and packages current
4. **Review Error Logs**: Weekly review of function and auth errors

### Health Checks
```bash
# Test magic link system
npm run test:magic-link

# Verify Postmark integration
npm run test:postmark

# Check database connectivity
npm run test:database
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Edge Function deployed
- [ ] Postmark domain verified
- [ ] Database migrations applied
- [ ] Test suite passing

### Post-Deployment
- [ ] Magic link flow tested end-to-end
- [ ] Email delivery confirmed
- [ ] User registration flow verified
- [ ] Workspace assignment working
- [ ] Error monitoring configured

---

**Last Updated**: January 15, 2025  
**Version**: 2.0  
**Status**: ✅ Production Ready  
**Maintainer**: InnovareAI Team