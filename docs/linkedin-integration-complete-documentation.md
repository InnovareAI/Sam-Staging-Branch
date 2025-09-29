# Complete LinkedIn Integration Documentation
## SAM AI Platform - Comprehensive Technical Guide

## Executive Summary

The LinkedIn integration for SAM AI Platform provides seamless connection with user LinkedIn accounts through Unipile API, enabling prospect research, message management, and automated outreach capabilities. This document provides complete technical implementation details, troubleshooting guides, and maintenance procedures.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [API Integration](#api-integration)
4. [User Flow](#user-flow)
5. [Security Implementation](#security-implementation)
6. [Error Handling](#error-handling)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Known Issues & Solutions](#known-issues--solutions)
10. [Future Enhancements](#future-enhancements)

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     SAM AI Platform                           │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)                                           │
│  ├── LinkedIn Onboarding Component                             │
│  ├── Inbox (Contact Center) Interface                          │
│  ├── Account Status Management                                 │
│  └── Integration Settings                                      │
├─────────────────────────────────────────────────────────────────┤
│  Backend APIs                                                  │
│  ├── /api/unipile/accounts         (Account listing)          │
│  ├── /api/contact-center/accounts  (Workspace filtering)      │
│  ├── /api/linkedin/connect         (OAuth flow)               │
│  ├── /api/linkedin/callback        (OAuth callback)           │
│  ├── /api/linkedin/status          (Connection status)        │
│  └── /api/admin/rollout-*          (Admin tools)              │
├─────────────────────────────────────────────────────────────────┤
│  Database Layer (Supabase)                                    │
│  ├── user_unipile_accounts         (Account associations)     │
│  ├── user_organizations            (Workspace assignments)    │
│  ├── organizations                 (Workspace definitions)    │
│  └── auth.users                    (User authentication)      │
├─────────────────────────────────────────────────────────────────┤
│  External Services                                             │
│  ├── Unipile API                   (LinkedIn proxy)           │
│  ├── LinkedIn OAuth                (Authentication)           │
│  └── Supabase Auth                 (User management)          │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Flow

1. **User Authentication**: User logs into SAM AI via Supabase Auth
2. **Workspace Assignment**: User is assigned to organization/workspace
3. **LinkedIn Connection**: User initiates LinkedIn connection via Unipile
4. **Account Association**: System creates user-account association
5. **Message Sync**: LinkedIn messages synchronized to platform
6. **Inbox Management**: Messages appear in unified Inbox interface

## Database Schema

### Core Tables

#### user_unipile_accounts
```sql
CREATE TABLE user_unipile_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    unipile_account_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'LINKEDIN',
    account_name TEXT,
    account_email TEXT,
    linkedin_profile_url TEXT,
    connection_status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, unipile_account_id)
);
```

#### user_organizations
```sql
CREATE TABLE user_organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);
```

#### organizations
```sql
CREATE TABLE organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

```sql
-- Enable RLS on user_unipile_accounts
ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own accounts
CREATE POLICY "Users can see own accounts" 
ON user_unipile_accounts FOR ALL 
USING (auth.uid() = user_id);

-- Workspace admins can see accounts in their organization
CREATE POLICY "Workspace admins can see org accounts" 
ON user_unipile_accounts FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM user_organizations uo 
        WHERE uo.user_id = auth.uid() 
        AND uo.role = 'admin'
        AND uo.organization_id IN (
            SELECT uo2.organization_id 
            FROM user_organizations uo2 
            WHERE uo2.user_id = user_unipile_accounts.user_id
        )
    )
);
```

## API Integration

### Unipile API Configuration

Environment variables required:
```bash
UNIPILE_DSN=your-unipile-dsn
UNIPILE_API_KEY=your-unipile-api-key
```

### Key API Endpoints

#### 1. Account Listing (`/api/unipile/accounts`)
```typescript
// Returns basic connection status
GET /api/unipile/accounts
Response: {
  has_linkedin: boolean,
  connection_status: string,
  debug_info: object
}
```

#### 2. Contact Center Accounts (`/api/contact-center/accounts`)
```typescript
// Returns workspace-filtered account details
GET /api/contact-center/accounts
Response: {
  success: boolean,
  accounts: Account[],
  total: number,
  connected_count: number,
  workspace_filtering_active: boolean
}

interface Account {
  id: string;
  name: string;
  platform: 'linkedin';
  status: 'connected' | 'disconnected' | 'syncing';
  lastSync: string;
  messageCount: number;
  email: string;
  organizations: string[];
}
```

#### 3. LinkedIn Connection (`/api/linkedin/connect`)
```typescript
// Initiates OAuth flow with LinkedIn
POST /api/linkedin/connect
Body: {
  username: string,
  password: string
}
Response: {
  success: boolean,
  message: string,
  account_id?: string
}
```

### Security Features

#### Workspace Isolation
- **User-Account Association**: Links users to specific LinkedIn accounts
- **Organization Filtering**: Users only see accounts within their workspace
- **Super Admin Override**: Designated admins can access all accounts
- **Audit Trail**: All account associations are logged

#### Data Protection
- **Encrypted Storage**: Sensitive data encrypted at rest
- **Token Management**: OAuth tokens securely stored and rotated
- **Rate Limiting**: API calls throttled to prevent abuse
- **Access Logging**: All API access logged for security monitoring

## User Flow

### 1. Initial Connection
```
User clicks "Connect LinkedIn" → 
LinkedIn Onboarding Modal opens → 
User enters credentials → 
Unipile processes connection → 
Account association created → 
User redirected to Inbox
```

### 2. Daily Usage
```
User opens Inbox → 
System checks connection status → 
Messages synchronized from LinkedIn → 
User manages conversations → 
Responses sent via Unipile API
```

### 3. Troubleshooting Flow
```
Connection issue detected → 
Error displayed with guidance → 
User tries reconnection → 
Admin tools available if needed → 
Support documentation provided
```

## Error Handling

### Common Error Scenarios

#### 1. Organization Association Missing
**Error**: `"User not associated with any workspace"`

**Cause**: User not assigned to organization
**Solution**: 
```sql
-- Manual assignment
INSERT INTO user_organizations (user_id, organization_id) 
VALUES ('user-uuid', 'org-uuid');
```

**Prevention**: Automatic assignment during user creation

#### 2. LinkedIn Account Connection Failed
**Error**: `"Failed to connect LinkedIn account"`

**Cause**: Invalid credentials or LinkedIn restrictions
**Solutions**:
- Verify credentials are correct
- Check LinkedIn account status
- Ensure 2FA is disabled during connection
- Use LinkedIn Business account if available

#### 3. Unipile API Timeout
**Error**: `"Unipile API error: 504 - Gateway Timeout"`

**Cause**: Unipile service overload or network issues
**Solutions**:
- Implement retry logic with exponential backoff
- Check Unipile service status
- Contact Unipile support if persistent

### Error Recovery Procedures

#### Automatic Recovery
```typescript
// Retry logic for API calls
async function callUnipileWithRetry(endpoint: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callUnipileAPI(endpoint);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

#### Manual Recovery
```sql
-- Reset user account associations
DELETE FROM user_unipile_accounts WHERE user_id = 'user-uuid';

-- Reassign user to workspace
UPDATE user_organizations 
SET organization_id = 'new-org-uuid' 
WHERE user_id = 'user-uuid';
```

## Troubleshooting Guide

### Issue: "No LinkedIn connections found"

**Symptoms**:
- User sees empty Inbox
- Integration page shows no connections
- API returns `has_linkedin: false`

**Diagnosis Steps**:
1. Check user organization assignment
2. Verify Unipile account exists
3. Confirm account association in database
4. Test Unipile API connectivity

**Solutions**:
1. **Check Organization Assignment**:
```sql
SELECT * FROM user_organizations WHERE user_id = 'user-uuid';
```

2. **Verify Unipile Account**:
```bash
curl -H "X-API-KEY: $UNIPILE_API_KEY" \
  https://$UNIPILE_DSN/api/v1/accounts
```

3. **Create Manual Association**:
```sql
INSERT INTO user_unipile_accounts (
  user_id, unipile_account_id, platform, account_name
) VALUES (
  'user-uuid', 'unipile-account-id', 'LINKEDIN', 'Account Name'
);
```

### Issue: "Connection Error - Failed to fetch"

**Symptoms**:
- API calls return 500 errors
- Frontend shows connection errors
- Network timeouts

**Diagnosis**:
1. Check environment variables
2. Test Unipile API connectivity
3. Verify network permissions
4. Check rate limiting

**Solutions**:
1. **Verify Environment Variables**:
```bash
echo $UNIPILE_DSN
echo $UNIPILE_API_KEY
```

2. **Test API Connectivity**:
```bash
curl -v -H "X-API-KEY: $UNIPILE_API_KEY" \
  https://$UNIPILE_DSN/api/v1/accounts
```

3. **Check Rate Limits**:
```typescript
// Implement rate limiting
const rateLimiter = new Map();
function checkRateLimit(userId: string) {
  const now = Date.now();
  const userRequests = rateLimiter.get(userId) || [];
  const recentRequests = userRequests.filter(time => now - time < 60000);
  
  if (recentRequests.length >= 10) {
    throw new Error('Rate limit exceeded');
  }
  
  recentRequests.push(now);
  rateLimiter.set(userId, recentRequests);
}
```

### Issue: "Super Admin Access Issues"

**Symptoms**:
- Super admin cannot see all accounts
- Workspace filtering not working properly
- Permission errors

**Solutions**:
1. **Verify Super Admin Status**:
```typescript
const isSuperAdmin = ['tl@innovareai.com', 'cl@innovareai.com']
  .includes(user.email?.toLowerCase());
```

2. **Check RLS Policies**:
```sql
-- Disable RLS temporarily for testing
ALTER TABLE user_unipile_accounts DISABLE ROW LEVEL SECURITY;

-- Re-enable after testing
ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;
```

## Monitoring & Maintenance

### Health Checks

#### API Endpoint Monitoring
```typescript
// Health check endpoint
GET /api/linkedin/status
Response: {
  unipile_connectivity: boolean,
  database_connectivity: boolean,
  account_associations: number,
  last_sync: string,
  error_rate: number
}
```

#### Database Monitoring
```sql
-- Monitor account associations
SELECT 
  platform,
  connection_status,
  COUNT(*) as count
FROM user_unipile_accounts 
GROUP BY platform, connection_status;

-- Monitor workspace distribution
SELECT 
  o.name as workspace,
  COUNT(DISTINCT uua.user_id) as users_with_linkedin
FROM organizations o
JOIN user_organizations uo ON o.id = uo.organization_id
LEFT JOIN user_unipile_accounts uua ON uo.user_id = uua.user_id
GROUP BY o.name;
```

### Performance Optimization

#### Database Indexing
```sql
-- Optimize user lookups
CREATE INDEX idx_user_unipile_accounts_user_id 
ON user_unipile_accounts(user_id);

-- Optimize workspace queries
CREATE INDEX idx_user_organizations_user_org 
ON user_organizations(user_id, organization_id);

-- Optimize account status queries
CREATE INDEX idx_user_unipile_accounts_status 
ON user_unipile_accounts(connection_status, platform);
```

#### API Caching
```typescript
// Cache Unipile API responses
const accountCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedAccounts(userId: string) {
  const cacheKey = `accounts_${userId}`;
  const cached = accountCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const accounts = await fetchAccountsFromUnipile();
  accountCache.set(cacheKey, {
    data: accounts,
    timestamp: Date.now()
  });
  
  return accounts;
}
```

### Backup & Recovery

#### Database Backup
```sql
-- Export account associations
COPY user_unipile_accounts TO '/backup/user_accounts.csv' 
WITH (FORMAT CSV, HEADER true);

-- Export workspace assignments
COPY user_organizations TO '/backup/user_orgs.csv' 
WITH (FORMAT CSV, HEADER true);
```

#### Recovery Procedures
```sql
-- Restore account associations
COPY user_unipile_accounts FROM '/backup/user_accounts.csv' 
WITH (FORMAT CSV, HEADER true);

-- Restore workspace assignments
COPY user_organizations FROM '/backup/user_orgs.csv' 
WITH (FORMAT CSV, HEADER true);
```

## Known Issues & Solutions

### 1. LinkedIn Rate Limiting
**Issue**: LinkedIn restricts API calls, causing connection failures
**Solution**: Implement exponential backoff and request queuing
**Status**: Partially mitigated through Unipile proxy

### 2. Session Timeout
**Issue**: LinkedIn sessions expire, requiring re-authentication
**Solution**: Automatic token refresh and graceful re-authentication
**Status**: Handled by Unipile token management

### 3. Workspace Isolation Edge Cases
**Issue**: Super admins sometimes cannot access all accounts
**Solution**: Enhanced permission checking and fallback logic
**Status**: Fixed in latest release

### 4. Large Organization Performance
**Issue**: Slow queries in organizations with 1000+ users
**Solution**: Database indexing and query optimization
**Status**: Ongoing optimization

## Future Enhancements

### Planned Features
1. **Multi-Account Support**: Users can connect multiple LinkedIn accounts
2. **Advanced Analytics**: Connection health monitoring and usage statistics
3. **Automated Onboarding**: Bulk user imports with automatic LinkedIn association
4. **Integration Health Dashboard**: Real-time monitoring of all connections

### Technical Improvements
1. **Microservice Architecture**: Split LinkedIn integration into separate service
2. **Event-Driven Updates**: Real-time account status updates via webhooks
3. **Advanced Caching**: Redis-based caching for improved performance
4. **Automated Testing**: Comprehensive end-to-end testing suite

### API Extensions
1. **Webhook Support**: Real-time notifications of account changes
2. **Bulk Operations**: Mass account management for administrators
3. **Advanced Filtering**: Complex queries for account discovery
4. **Integration APIs**: Connect with external CRM and marketing tools

## Support & Documentation

### Internal Resources
- **Admin Dashboard**: `/demo/admin` for account management
- **API Documentation**: In-code documentation and examples
- **Database Schema**: Complete ERD in `/docs/database/`
- **Troubleshooting Runbook**: Step-by-step issue resolution

### External Dependencies
- **Unipile Documentation**: https://docs.unipile.com
- **LinkedIn API**: https://docs.microsoft.com/linkedin/
- **Supabase Documentation**: https://supabase.com/docs
- **Next.js Documentation**: https://nextjs.org/docs

### Contact Information
- **Technical Lead**: tl@innovareai.com
- **Customer Success**: cl@innovareai.com
- **Emergency Support**: Technical team Slack channel
- **Unipile Support**: Via Unipile dashboard

---

## Appendix

### A. Environment Variables
```bash
# Required
UNIPILE_DSN=your-unipile-instance.com
UNIPILE_API_KEY=your-api-key

# Optional
LINKEDIN_DEBUG=true
RATE_LIMIT_ENABLED=true
CACHE_TTL=300000
```

### B. SQL Maintenance Scripts
```sql
-- Clean up orphaned associations
DELETE FROM user_unipile_accounts 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Update connection status
UPDATE user_unipile_accounts 
SET connection_status = 'inactive' 
WHERE updated_at < NOW() - INTERVAL '30 days';
```

### C. API Testing Scripts
```bash
#!/bin/bash
# Test Unipile connectivity
curl -H "X-API-KEY: $UNIPILE_API_KEY" \
  https://$UNIPILE_DSN/api/v1/accounts

# Test SAM AI API
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://app.meet-sam.com/api/contact-center/accounts
```

This documentation provides comprehensive coverage of the LinkedIn integration system, enabling effective maintenance, troubleshooting, and future development.
