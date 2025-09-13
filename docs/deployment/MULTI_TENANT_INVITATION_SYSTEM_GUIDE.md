# Multi-Tenant Cross-Company Invitation System Deployment Guide
**SAM AI Platform - Enterprise Multi-Tenant Architecture**

**Created**: 2025-09-12  
**Version**: 1.0  
**Status**: Production Ready  
**Classification**: Enterprise Deployment Guide

---

## 🎯 Overview

The SAM AI Platform features a sophisticated **multi-tenant invitation system** that seamlessly manages cross-company user invitations and workspace assignments between **InnovareAI** and **3CubedAI**. This enterprise-grade system handles complex user lifecycle management, email customization, and automated ActiveCampaign integration.

### **Key Capabilities**
- ✅ **Cross-Company Invitations**: Seamless invitations between InnovareAI and 3CubedAI
- ✅ **Automatic Company Detection**: Intelligent company assignment based on email domains
- ✅ **Dual Email Systems**: Separate Postmark configurations for each company
- ✅ **Multi-Tenant Database**: Isolated workspace and user management
- ✅ **ActiveCampaign Integration**: Automatic marketing list segmentation
- ✅ **Enterprise Error Handling**: Comprehensive error tracking and recovery
- ✅ **Production Monitoring**: Real-time health checks and metrics

---

## 📊 System Architecture

### **Multi-Tenant Architecture Stack**
```
┌─────────────────────────────────────────────────────────┐
│                  USER INTERFACES                        │
│   InnovareAI UI  │  3CubedAI UI  │  Admin Dashboard    │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                INVITATION API LAYER                     │
│   /api/admin/invite-user  │  /api/admin/simple-invite   │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│              COMPANY CONFIGURATION LAYER                │
│   InnovareAI Config  │  3CubedAI Config                 │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE DATABASE                      │
│  workspace_invitations  │  workspace_members  │  users  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                 EXTERNAL INTEGRATIONS                   │
│  Postmark Email  │  ActiveCampaign  │  Supabase Auth   │
└─────────────────────────────────────────────────────────┘
```

### **Multi-Company Configuration Architecture**

#### **Company Configuration System**
```typescript
const COMPANY_CONFIG = {
  InnovareAI: {
    postmarkApiKey: process.env.POSTMARK_INNOVAREAI_API_KEY,
    fromEmail: 'sp@innovareai.com', // Sarah Powell
    companyName: 'InnovareAI',
    contactEmail: 'sp@innovareai.com',
    contactName: 'Sarah Powell'
  },
  '3cubedai': {
    postmarkApiKey: process.env.POSTMARK_3CUBEDAI_API_KEY,
    fromEmail: 'sophia@3cubed.ai', // Sophia Caldwell
    companyName: '3CubedAI',
    contactEmail: 'sophia@3cubed.ai',
    contactName: 'Sophia Caldwell'
  }
};
```

#### **Workspace Assignment Logic**
```typescript
const WORKSPACE_CONFIG = {
  InnovareAI: process.env.INNOVAREAI_WORKSPACE_ID,
  '3cubedai': process.env.THREECUBEDAI_WORKSPACE_ID
};

// Auto-detection based on admin email domain
const adminCompany = userEmail.includes('@3cubed.ai') ? '3cubedai' : 'InnovareAI';
```

---

## 🚀 Core Features

### **1. Cross-Company Invitation Flow**

#### **Primary Invitation Endpoint**
**Location**: `app/api/admin/invite-user/route.ts`

**Flow Architecture**:
```
Email Input → Company Detection → User Lookup → 
Workspace Assignment → Email Dispatch → ActiveCampaign Sync
```

#### **Simplified Invitation Endpoint**
**Location**: `app/api/admin/simple-invite/route.ts`

**Streamlined Flow**:
```
Email Input → Direct Invitation → Immediate Response → 
Background Processing → Marketing Integration
```

### **2. Company Detection & Assignment**

#### **Automatic Company Detection**
```typescript
// Primary company detection logic
let targetCompany: 'InnovareAI' | '3cubedai';

if (organization?.toLowerCase() === '3cubedai' || organization?.toLowerCase() === '3cubed') {
  targetCompany = '3cubedai';
} else if (adminUserEmail?.includes('@3cubed.ai')) {
  targetCompany = '3cubedai';
} else {
  targetCompany = 'InnovareAI';
}
```

#### **Workspace Assignment Logic**
- **InnovareAI Users**: Assigned to `INNOVAREAI_WORKSPACE_ID`
- **3CubedAI Users**: Assigned to `THREECUBEDAI_WORKSPACE_ID`  
- **Cross-Company Support**: Users can be invited across companies
- **Admin Override**: Manual organization parameter available

### **3. Multi-Tenant Database Schema**

#### **Core Database Tables**

##### **workspace_invitations Table**
```sql
CREATE TABLE workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin', 'owner')),
  company TEXT DEFAULT 'InnovareAI' CHECK (company IN ('InnovareAI', '3cubedai')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

##### **workspace_members Table**
```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin', 'owner')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);
```

##### **Performance Indexes**
```sql
-- Optimized indexes for multi-tenant queries
CREATE INDEX idx_workspace_invitations_company ON workspace_invitations(company);
CREATE INDEX idx_workspace_invitations_invited_by ON workspace_invitations(invited_by);
CREATE INDEX idx_workspace_invitations_expires_at ON workspace_invitations(expires_at);
CREATE INDEX idx_workspace_members_workspace_user ON workspace_members(workspace_id, user_id);
```

### **4. Dual Email System Integration**

#### **Postmark Multi-Account Setup**
```typescript
interface PostmarkConfig {
  InnovareAI: {
    apiKey: string;
    fromEmail: 'sp@innovareai.com';
    senderName: 'Sarah Powell';
    domain: 'innovareai.com';
  };
  '3CubedAI': {
    apiKey: string;
    fromEmail: 'sophia@3cubed.ai';
    senderName: 'Sophia Caldwell';
    domain: '3cubed.ai';
  };
}
```

#### **Email Template Customization**
- **Company-Specific Templates**: Branded emails for each organization
- **Dynamic Sender Names**: Automatic sender assignment based on company
- **Custom Contact Information**: Company-specific contact details
- **Branded URLs**: Company-appropriate redirect URLs

### **5. ActiveCampaign Multi-Tenant Integration**

#### **Automatic Marketing Segmentation**
```typescript
// Integration triggered during successful invitation
const acResult = await activeCampaignService.addSamUserToList(
  email,
  firstName || '',
  lastName || '',
  company // 'InnovareAI' | '3CubedAI'
);
```

#### **Company Tag Assignment**
- **InnovareAI Tag**: Applied to all InnovareAI users
- **3CubedAI Tag**: Applied to all 3CubedAI users
- **SAM List Membership**: All users added to unified SAM mailing list

---

## 🔧 Deployment Configuration

### **Environment Variables Setup**

#### **Required Environment Variables**
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Workspace IDs (Multi-tenant)
INNOVAREAI_WORKSPACE_ID=uuid_for_innovareai_workspace
THREECUBEDAI_WORKSPACE_ID=uuid_for_3cubedai_workspace

# Postmark Email Configuration (Dual Setup)
POSTMARK_INNOVAREAI_API_KEY=your_innovareai_postmark_key
POSTMARK_3CUBEDAI_API_KEY=your_3cubedai_postmark_key

# ActiveCampaign Integration
ACTIVECAMPAIGN_BASE_URL=https://innovareai.api-us1.com
ACTIVECAMPAIGN_API_KEY=your_activecampaign_api_key

# Organization & User Configuration
ORGANIZATION_ID=default-org
USER_ID=default-user
```

#### **Production Environment Setup**
```bash
# Production-specific configurations
NODE_ENV=production
ENVIRONMENT=production
DEPLOYMENT_STAGE=production

# Error Tracking
ENABLE_ERROR_TRACKING=true
ERROR_TRACKING_ENDPOINT=/api/monitoring/errors

# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=true
MONITORING_ENDPOINT=/api/monitoring/health
```

### **Database Schema Migration**

#### **Required Migration: Workspace Invitations Schema**
**File**: `supabase/migrations/20250911_fix_workspace_invitations_schema.sql`

```sql
-- Add company column for multi-tenant support
ALTER TABLE public.workspace_invitations 
ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'InnovareAI' 
CHECK (company IN ('InnovareAI', '3cubedai'));

-- Add invitation tracking columns
ALTER TABLE public.workspace_invitations 
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.workspace_invitations 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days');

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_company ON public.workspace_invitations(company);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_by ON public.workspace_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_expires_at ON public.workspace_invitations(expires_at);

-- Enable service role access
CREATE POLICY "Service role can manage invitations" ON public.workspace_invitations
  FOR ALL USING (auth.role() = 'service_role');
```

#### **Migration Deployment Command**
```bash
# Apply migration to production database
supabase db push --project-ref latxadqrvrrrcvkktrog

# Verify migration success
supabase db diff --project-ref latxadqrvrrrcvkktrog
```

---

## 📱 API Endpoints

### **Primary Invitation Endpoint**
**Endpoint**: `POST /api/admin/invite-user`

#### **Request Schema**
```typescript
interface InviteUserRequest {
  email: string;                    // Required: User email
  firstName?: string;               // Optional: User first name
  lastName?: string;                // Optional: User last name
  role?: 'member' | 'admin';        // Optional: Workspace role (default: member)
  organization?: 'InnovareAI' | '3cubedai' | '3cubed';  // Optional: Company override
}
```

#### **Response Schema**
```typescript
interface InviteUserResponse {
  message: string;                  // Success/failure message
  company: string;                  // Assigned company
  isNewUser: boolean;               // Whether user was created or existed
  user: {
    id: string;                     // User ID
    email: string;                  // User email
    invited_at?: string;            // Invitation timestamp
  };
  debug: {
    source: 'existing_user' | 'new_invitation' | 'fallback_created';
    timestamp: string;              // Request timestamp
  };
}
```

### **Simplified Invitation Endpoint**
**Endpoint**: `POST /api/admin/simple-invite`

#### **Streamlined Request Schema**
```typescript
interface SimpleInviteRequest {
  email: string;                    // Required: User email
  firstName?: string;               // Optional: User first name
  lastName?: string;                // Optional: User last name
}
```

#### **Error Response Schema**
```typescript
interface InviteErrorResponse {
  error: string;                    // Error description
  details: {
    message: string;                // Detailed error message
    errorCode: string;              // Error classification
    timestamp: string;              // Error timestamp
    email?: string;                 // Associated email (if available)
    workspace?: string;             // Target workspace (if applicable)
  };
}
```

---

## 🎯 Invitation Flow Workflows

### **Complete Invitation Workflow**

#### **1. Pre-Processing Phase**
```typescript
// Company detection and configuration
const adminUserEmail = await getAdminUserEmail(request);
const targetCompany = detectCompany(organization, adminUserEmail);
const companyConfig = COMPANY_CONFIG[targetCompany];
const targetWorkspace = WORKSPACE_CONFIG[targetCompany];
```

#### **2. User Resolution Phase**
```typescript
// Enhanced user lookup with fallback creation
const inviteResult = await enhancedInviteUserByEmail(
  supabase,
  email,
  { redirectTo: constructRedirectUrl(targetCompany) }
);

// User source classification
interface UserSource {
  'existing_user': 'User already exists in system',
  'new_invitation': 'New user invited via Supabase Auth',
  'fallback_created': 'User created through fallback mechanism'
}
```

#### **3. Workspace Assignment Phase**
```typescript
// Membership validation and assignment
const membershipCheck = await supabase
  .from('workspace_members')
  .select('id, role, joined_at')
  .eq('workspace_id', targetWorkspace)
  .eq('user_id', user.id)
  .maybeSingle();

if (!membershipCheck.data) {
  // Assign user to workspace
  await supabase.from('workspace_members').insert({
    workspace_id: targetWorkspace,
    user_id: user.id,
    role: requestedRole,
    invited_by: adminUser.id,
    joined_at: new Date().toISOString()
  });
}
```

#### **4. Email Dispatch Phase**
```typescript
// Company-specific email configuration
const postmarkHelper = createPostmarkHelper(companyConfig.postmarkApiKey);
const emailResult = await postmarkHelper.sendCustomWelcomeEmail(
  email,
  firstName,
  lastName,
  companyConfig,
  isNewUser
);
```

#### **5. Marketing Integration Phase**
```typescript
// ActiveCampaign synchronization
const acResult = await activeCampaignService.addSamUserToList(
  email,
  firstName || '',
  lastName || '',
  targetCompany === 'InnovareAI' ? 'InnovareAI' : '3CubedAI'
);
```

### **Error Handling & Recovery**

#### **Graceful Degradation Strategy**
```typescript
interface ErrorRecoverySteps {
  emailFailure: 'Continue invitation, log email error, attempt retry';
  databaseFailure: 'Rollback transactions, return detailed error';
  workspaceAssignment: 'Create fallback membership, alert administrators';
  marketingIntegration: 'Continue core flow, log marketing sync failure';
}
```

#### **Comprehensive Error Logging**
```typescript
// Enterprise error tracking
const logInvitationError = (context: {
  phase: 'preprocessing' | 'user_resolution' | 'workspace_assignment' | 'email_dispatch' | 'marketing_integration';
  error: Error;
  email: string;
  company: string;
  userId?: string;
  workspaceId?: string;
}) => {
  // Detailed error logging with context preservation
  console.error(`INVITATION_ERROR_${context.phase.toUpperCase()}`, {
    error: context.error,
    email: context.email,
    company: context.company,
    timestamp: new Date().toISOString(),
    phase: context.phase
  });
};
```

---

## 📊 Monitoring & Health Checks

### **Invitation System Health Monitoring**

#### **Health Check Endpoints**
```typescript
// System health monitoring
GET /api/monitoring/health
Response: {
  invitations: {
    status: 'pass' | 'fail' | 'warn';
    pendingInvitations: number;
    failedInvitations: number;
    successRate: number;
    lastInvitationSent?: string;
  }
}

// Detailed invitation metrics
GET /api/monitoring/metrics
Response: {
  invitation: {
    totalInvitations: number;
    pendingInvitations: number;
    acceptedInvitations: number;
    rejectedInvitations: number;
    invitationsLast24h: number;
    invitationsThisWeek: number;
  }
}
```

#### **Key Performance Indicators**
- **Invitation Success Rate**: Target > 95%
- **Email Delivery Rate**: Target > 98%
- **Database Response Time**: Target < 500ms
- **ActiveCampaign Sync Rate**: Target > 90%
- **Cross-Company Assignment Accuracy**: Target 100%

### **Real-Time Monitoring Dashboard**
**Location**: `/admin/monitoring`

#### **Invitation System Metrics**
- **Total Invitations**: Complete count across all companies
- **Company Distribution**: InnovareAI vs 3CubedAI invitation breakdown
- **Pending Invitations**: Awaiting user acceptance
- **Success Rate Trends**: 7-day and 30-day invitation success tracking
- **Error Classification**: Database, email, workspace, and marketing errors

---

## 🛡️ Security & Access Control

### **Multi-Tenant Security Model**

#### **Row-Level Security (RLS) Policies**
```sql
-- Workspace invitation security
CREATE POLICY "Users can view own company invitations" ON workspace_invitations
  FOR SELECT USING (
    company = (
      SELECT company FROM user_company_mapping 
      WHERE user_id = auth.uid()
    )
  );

-- Service role bypass for system operations
CREATE POLICY "Service role can manage invitations" ON workspace_invitations
  FOR ALL USING (auth.role() = 'service_role');
```

#### **API Authentication & Authorization**
```typescript
// Admin-only endpoint protection
const adminEmails = ['tl@innovareai.com', 'cl@innovareai.com'];

// Company-specific admin validation
const validateCompanyAdmin = (userEmail: string, targetCompany: string): boolean => {
  const innovareAdmins = ['tl@innovareai.com', 'sp@innovareai.com'];
  const cubedAdmins = ['cl@innovareai.com', 'sophia@3cubed.ai'];
  
  return targetCompany === 'InnovareAI' 
    ? innovareAdmins.includes(userEmail)
    : cubedAdmins.includes(userEmail);
};
```

### **Data Privacy & Compliance**

#### **Cross-Company Data Isolation**
- **Workspace Isolation**: Users can only access assigned company workspaces
- **Email Segregation**: Company-specific email domains and templates
- **Marketing Segmentation**: Separate ActiveCampaign tags for each company
- **Database Partitioning**: Logical separation via company column

#### **GDPR & Privacy Compliance**
- **Data Minimization**: Only necessary user data collected
- **Consent Management**: Automatic email subscription handling
- **Right to Erasure**: User data deletion capabilities
- **Data Export**: User data export functionality available

---

## 🚨 Troubleshooting Guide

### **Common Multi-Tenant Issues**

#### **1. Cross-Company Invitation Failures**
**Symptoms**:
- Users not receiving invitations from other companies
- Workspace assignment errors
- Email delivery to wrong company domain

**Diagnosis**:
```bash
# Check company detection logic
curl -X POST https://app.meet-sam.com/api/admin/invite-user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@3cubed.ai","organization":"3cubedai"}'

# Verify workspace configuration
echo $INNOVAREAI_WORKSPACE_ID
echo $THREECUBEDAI_WORKSPACE_ID
```

**Resolution**:
1. Verify environment variable configuration for workspace IDs
2. Check company detection logic in invitation endpoints
3. Validate Postmark API keys for both companies
4. Confirm database schema includes company column

#### **2. Email System Cross-Company Issues**
**Symptoms**:
- Wrong sender name on invitation emails
- Emails from incorrect company domain
- Missing company-specific branding

**Diagnosis**:
```bash
# Check Postmark configuration
curl -X GET "https://api.postmarkapp.com/servers" \
  -H "X-Postmark-Server-Token: $POSTMARK_INNOVAREAI_API_KEY"

curl -X GET "https://api.postmarkapp.com/servers" \
  -H "X-Postmark-Server-Token: $POSTMARK_3CUBEDAI_API_KEY"
```

**Resolution**:
1. Verify both Postmark API keys are configured correctly
2. Check email template company detection logic
3. Validate sender email addresses and domains
4. Confirm DNS records for both company domains

#### **3. ActiveCampaign Segmentation Issues**
**Symptoms**:
- Users tagged with wrong company
- Missing from company-specific lists
- Cross-company marketing data mixing

**Diagnosis**:
```bash
# Test ActiveCampaign integration
curl https://app.meet-sam.com/admin/activecampaign

# Check tag assignment
curl -X POST https://app.meet-sam.com/api/admin/activecampaign \
  -H "Content-Type: application/json" \
  -d '{"email":"test@3cubed.ai","firstName":"Test","lastName":"User","listId":"sam-list-id"}'
```

**Resolution**:
1. Verify ActiveCampaign tag creation for both companies
2. Check company parameter passing to marketing integration
3. Validate list membership and tag assignment logic
4. Confirm company name mapping ('InnovareAI' vs '3CubedAI')

### **Database Troubleshooting**

#### **Schema Validation**
```sql
-- Verify multi-tenant schema
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'workspace_invitations' 
AND column_name IN ('company', 'invited_by', 'expires_at');

-- Check workspace configuration
SELECT id, name, company FROM workspaces 
WHERE id IN (
  SELECT unnest(string_to_array(
    coalesce($INNOVAREAI_WORKSPACE_ID, '') || ',' || 
    coalesce($THREECUBEDAI_WORKSPACE_ID, ''), ','
  ))::uuid
);
```

#### **Data Integrity Verification**
```sql
-- Verify company distribution
SELECT company, COUNT(*) as invitation_count
FROM workspace_invitations 
GROUP BY company;

-- Check cross-company workspace assignments
SELECT w.company, wm.role, COUNT(*) as member_count
FROM workspace_members wm
JOIN workspaces w ON wm.workspace_id = w.id
GROUP BY w.company, wm.role;
```

---

## 📈 Performance Optimization

### **Database Performance**

#### **Query Optimization**
```sql
-- Optimized company-specific invitation lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  idx_workspace_invitations_email_company 
  ON workspace_invitations(email, company) 
  WHERE expires_at > NOW();

-- Workspace member lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  idx_workspace_members_composite 
  ON workspace_members(workspace_id, user_id, role);
```

#### **Connection Pool Configuration**
```typescript
// Supabase client optimization for multi-tenant operations
const supabaseConfig = {
  db: {
    pool: {
      max: 20,                    // Maximum connections
      min: 5,                     // Minimum connections
      acquireTimeoutMillis: 60000, // Connection timeout
      idleTimeoutMillis: 600000   // Idle timeout
    }
  }
};
```

### **API Performance Optimization**

#### **Response Time Targets**
- **Simple Invite Endpoint**: < 2000ms
- **Complex Invite Endpoint**: < 3000ms  
- **Workspace Assignment**: < 500ms
- **Email Dispatch**: < 1500ms
- **ActiveCampaign Sync**: < 1000ms (non-blocking)

#### **Caching Strategy**
```typescript
// Workspace configuration caching
const workspaceCache = new Map<string, string>();
const getWorkspaceForCompany = (company: string): string => {
  const cacheKey = `workspace_${company}`;
  if (workspaceCache.has(cacheKey)) {
    return workspaceCache.get(cacheKey)!;
  }
  
  const workspaceId = company === 'InnovareAI' 
    ? process.env.INNOVAREAI_WORKSPACE_ID
    : process.env.THREECUBEDAI_WORKSPACE_ID;
    
  workspaceCache.set(cacheKey, workspaceId!);
  return workspaceId!;
};
```

---

## 📋 Deployment Checklist

### **Pre-Deployment Verification**

#### **Environment Configuration**
- [ ] All environment variables configured correctly
- [ ] Workspace IDs exist in database
- [ ] Both Postmark API keys validated
- [ ] ActiveCampaign API credentials tested
- [ ] Supabase connection established

#### **Database Schema**
- [ ] workspace_invitations table includes company column
- [ ] RLS policies configured for multi-tenant access
- [ ] Performance indexes created
- [ ] Foreign key constraints validated

#### **Email System**
- [ ] Both Postmark accounts configured
- [ ] DNS records verified for both domains
- [ ] Email templates tested for both companies
- [ ] Sender reputation validated

#### **Integration Testing**
- [ ] Cross-company invitations tested
- [ ] ActiveCampaign segmentation verified
- [ ] Error handling validated
- [ ] Performance benchmarks met

### **Post-Deployment Validation**

#### **Functional Testing**
```bash
# Test InnovareAI invitation
curl -X POST https://app.meet-sam.com/api/admin/invite-user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@innovareai.com","organization":"InnovareAI"}'

# Test 3CubedAI invitation  
curl -X POST https://app.meet-sam.com/api/admin/invite-user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@3cubed.ai","organization":"3cubedai"}'

# Test cross-company invitation
curl -X POST https://app.meet-sam.com/api/admin/invite-user \
  -H "Content-Type: application/json" \
  -d '{"email":"cross-test@gmail.com","organization":"3cubedai"}'
```

#### **Health Check Validation**
```bash
# System health verification
curl https://app.meet-sam.com/api/monitoring/health | jq '.checks.invitations'

# Metrics validation
curl https://app.meet-sam.com/api/monitoring/metrics | jq '.invitation'
```

---

## 📚 Related Documentation

### **Internal References**
- [Enterprise Monitoring System](../monitoring/ENTERPRISE_MONITORING_SYSTEM.md)
- [ActiveCampaign Integration](../marketing/ACTIVECAMPAIGN_INTEGRATION_SYSTEM.md)
- [Error Tracking System](../monitoring/ERROR_TRACKING_SYSTEM.md)
- [Invitation System Runbook](../operations/INVITATION_SYSTEM_RUNBOOK.md)

### **Database Documentation**
- [Supabase Multi-tenant Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

### **Email Integration**
- [Postmark API Documentation](https://postmarkapp.com/developer)
- [Multi-domain Email Setup](https://postmarkapp.com/support/article/1036-how-to-set-up-multiple-sending-domains)

---

## 🤝 Support & Contact

### **Technical Support**
- **Development Team**: dev@innovareai.com
- **Database Admin**: admin@innovareai.com  
- **Email Systems**: email-admin@innovareai.com
- **Emergency Contact**: emergency@innovareai.com

### **Company-Specific Contacts**
- **InnovareAI Support**: sp@innovareai.com (Sarah Powell)
- **3CubedAI Support**: sophia@3cubed.ai (Sophia Caldwell)
- **Cross-Company Issues**: tl@innovareai.com (Technical Lead)

---

**Last Updated**: September 12, 2025  
**Next Review**: October 12, 2025  
**Document Version**: 1.0.0  
**Status**: Production Ready ✅