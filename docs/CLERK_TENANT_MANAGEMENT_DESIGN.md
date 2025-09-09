# SAM AI - Clerk-Based Tenant Management Design

## 🎯 **Architecture Overview**

**Use Clerk Organizations as Primary Tenant System** - Eliminate custom workspace management and leverage Clerk's built-in multi-tenant capabilities.

### **Key Principle: Clerk-Native Tenancy**
```
✅ Clerk Organization = SAM AI Tenant/Workspace
✅ Clerk User Roles = SAM AI Permissions  
✅ Clerk Invitations = SAM AI Team Management
✅ Clerk Organization Switching = SAM AI Tenant Switching
```

## 🔧 **Clerk Organization Structure**

### **Organization Types**
```typescript
interface SAMTenantOrganization {
  // Clerk native fields
  id: string;                    // Clerk organization ID
  name: string;                  // Company/team name
  slug: string;                  // URL-friendly identifier
  created_at: string;            // Clerk creation timestamp
  
  // Clerk membership management
  members: OrganizationMember[]; // Users with roles
  invitations: Invitation[];     // Pending invites
  
  // SAM AI specific metadata (stored in Clerk metadata)
  public_metadata: {
    subscription_plan: 'free' | 'pro' | 'enterprise';
    lead_quota: number;           // Monthly lead generation limit
    integration_config: {
      linkedin_accounts: string[];
      email_domains: string[];
      api_keys_configured: string[];
    };
    billing_status: 'active' | 'suspended' | 'trial';
    created_by_user_id: string;
  };
  
  private_metadata: {
    // Internal SAM AI settings
    workflow_config: any;
    cost_tracking: any;
  };
}
```

### **User Roles in Organizations**
```typescript
// Clerk native role system
type ClerkOrgRole = 'admin' | 'basic_member';

// SAM AI permission mapping
const SAMPermissions = {
  'admin': [
    'manage_team',
    'configure_integrations', 
    'view_billing',
    'export_data',
    'manage_workflows',
    'access_all_conversations'
  ],
  'basic_member': [
    'use_sam_chat',
    'create_campaigns',
    'view_own_conversations',
    'generate_leads'
  ]
};
```

## 🚀 **Implementation Strategy**

### **1. Organization-First User Flow**

#### **New User Experience**
```typescript
// After Clerk sign-up/sign-in
const userFlow = {
  step1: 'Check if user belongs to any organizations',
  step2a: 'If organizations exist → Show organization selector',
  step2b: 'If no organizations → Prompt to create or join organization',
  step3: 'Set active organization context',
  step4: 'Load SAM AI with organization context'
};
```

#### **Organization Creation Flow**
```typescript
async function createSAMOrganization(userId: string, companyName: string) {
  // Create Clerk organization with SAM metadata
  const organization = await clerkClient.organizations.createOrganization({
    name: companyName,
    slug: generateSlug(companyName),
    public_metadata: {
      subscription_plan: 'free',
      lead_quota: 500, // Free tier limit
      integration_config: {
        linkedin_accounts: [],
        email_domains: [],
        api_keys_configured: []
      },
      billing_status: 'trial',
      created_by_user_id: userId
    },
    private_metadata: {
      workflow_config: getDefaultWorkflowConfig(),
      cost_tracking: { monthly_spend: 0, lead_cost: 0 }
    }
  });
  
  // Auto-provision N8N workflow for organization
  await provisionDefaultWorkflow(organization.id);
  
  // Initialize Supabase tenant data
  await initializeOrganizationData(organization.id);
  
  return organization;
}
```

### **2. Database Schema Alignment**

#### **Supabase Schema Update**
```sql
-- Remove custom workspace tables, use Clerk organization IDs
DROP TABLE IF EXISTS workspaces CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;

-- Update all tables to use Clerk organization IDs
ALTER TABLE sam_conversations 
  DROP COLUMN workspace_id,
  DROP COLUMN tenant_id,
  ADD COLUMN organization_id TEXT NOT NULL;

ALTER TABLE sam_leads 
  DROP COLUMN workspace_id,
  ADD COLUMN organization_id TEXT NOT NULL;

ALTER TABLE sam_outreach_messages
  DROP COLUMN workspace_id,
  ADD COLUMN organization_id TEXT NOT NULL;

-- Add indexes for organization-based queries
CREATE INDEX idx_sam_conversations_org_id ON sam_conversations(organization_id);
CREATE INDEX idx_sam_leads_org_id ON sam_leads(organization_id);
CREATE INDEX idx_sam_outreach_messages_org_id ON sam_outreach_messages(organization_id);

-- RLS policies using Clerk organization membership
CREATE OR REPLACE FUNCTION get_user_organizations(user_id TEXT)
RETURNS TEXT[] AS $$
BEGIN
  -- This will be populated by API routes that verify Clerk membership
  -- Return organization IDs that the user has access to
  RETURN (
    SELECT ARRAY_AGG(organization_id) 
    FROM user_organization_access 
    WHERE clerk_user_id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated RLS policies
DROP POLICY IF EXISTS "Users can access their workspace conversations" ON sam_conversations;
CREATE POLICY "Users can access their organization conversations" ON sam_conversations
  FOR ALL USING (organization_id = ANY(get_user_organizations(auth.jwt() ->> 'sub')));
```

#### **Organization Access Tracking**
```sql
-- Track which organizations users have access to
CREATE TABLE user_organization_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'basic_member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clerk_user_id, organization_id)
);

-- Sync with Clerk via webhook or API calls
CREATE OR REPLACE FUNCTION sync_user_organization_access(
  p_clerk_user_id TEXT,
  p_organization_id TEXT, 
  p_role TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_organization_access (clerk_user_id, organization_id, role)
  VALUES (p_clerk_user_id, p_organization_id, p_role)
  ON CONFLICT (clerk_user_id, organization_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

### **3. API Routes with Clerk Organization Context**

#### **Authentication Helper**
```typescript
// lib/auth/clerk-context.ts
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function getOrganizationContext() {
  const { userId, orgId, orgRole } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized');
  }
  
  // If no active organization, get user's organizations
  if (!orgId) {
    const userOrganizations = await clerkClient.users.getOrganizationMembershipList({
      userId,
    });
    
    if (userOrganizations.length === 0) {
      return {
        user_id: userId,
        organization_id: null,
        role: null,
        needs_organization: true
      };
    }
    
    // Use first organization as default
    const defaultOrg = userOrganizations[0];
    return {
      user_id: userId,
      organization_id: defaultOrg.organization.id,
      role: defaultOrg.role,
      needs_organization: false
    };
  }
  
  return {
    user_id: userId,
    organization_id: orgId,
    role: orgRole,
    needs_organization: false
  };
}

export async function requireOrganizationAccess() {
  const context = await getOrganizationContext();
  
  if (context.needs_organization) {
    throw new Error('Organization required');
  }
  
  return context;
}
```

#### **Updated API Routes**
```typescript
// app/api/sam/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireOrganizationAccess } from '@/lib/auth/clerk-context';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { user_id, organization_id, role } = await requireOrganizationAccess();
    
    const supabase = supabaseAdmin();
    
    // Get conversations for this organization
    const { data: conversations, error } = await supabase
      .from('sam_conversations')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('user_id', user_id) // Users can only see their own conversations
      .order('last_active_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      conversations: conversations || [],
      organization_context: {
        organization_id,
        role,
        permissions: SAMPermissions[role] || []
      }
    });

  } catch (error) {
    if (error.message === 'Organization required') {
      return NextResponse.json({ 
        error: 'Organization required',
        needs_organization: true 
      }, { status: 403 });
    }
    
    console.error('Error in conversations GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### **4. Frontend Organization Management**

#### **Organization Selector Component**
```typescript
// app/components/OrganizationSelector.tsx
'use client';

import { useOrganization, useOrganizationList, useUser } from '@clerk/nextjs';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Building, Plus, Users } from 'lucide-react';

export function OrganizationSelector() {
  const { organization } = useOrganization();
  const { organizationList, isLoaded } = useOrganizationList();
  const { user } = useUser();
  const [showCreateForm, setShowCreateForm] = useState(false);

  if (!isLoaded) {
    return <div className="animate-pulse">Loading organizations...</div>;
  }

  // No organizations - show creation prompt
  if (!organizationList || organizationList.length === 0) {
    return <CreateOrganizationPrompt />;
  }

  return (
    <div className="space-y-4">
      {/* Current Organization */}
      {organization && (
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center space-x-3">
            <Building className="text-purple-600" size={20} />
            <div>
              <h3 className="font-medium text-gray-900">{organization.name}</h3>
              <p className="text-sm text-gray-600">
                {organization.membersCount} member{organization.membersCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Organization List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Switch Organization</h4>
        {organizationList.map((orgMembership) => (
          <button
            key={orgMembership.organization.id}
            onClick={() => orgMembership.organization.setActive()}
            className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Building size={16} className="text-gray-400" />
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-900">
                {orgMembership.organization.name}
              </p>
              <p className="text-sm text-gray-500">
                {orgMembership.role} • {orgMembership.organization.membersCount} members
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Create New Organization */}
      <Button
        variant="outline"
        onClick={() => setShowCreateForm(true)}
        className="w-full"
      >
        <Plus size={16} className="mr-2" />
        Create New Organization
      </Button>

      {showCreateForm && (
        <CreateOrganizationModal onClose={() => setShowCreateForm(false)} />
      )}
    </div>
  );
}
```

#### **Organization Creation Modal**
```typescript
// app/components/CreateOrganizationModal.tsx
'use client';

import { useState } from 'react';
import { useOrganization } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

interface CreateOrganizationModalProps {
  onClose: () => void;
}

export function CreateOrganizationModal({ onClose }: CreateOrganizationModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { organization } = useOrganization();

  const handleCreate = async () => {
    if (!companyName.trim()) return;

    setIsCreating(true);
    try {
      // Create organization via Clerk
      const newOrg = await organization?.create({
        name: companyName.trim(),
        slug: generateSlug(companyName.trim())
      });

      if (newOrg) {
        // Initialize SAM AI workspace for this organization
        await fetch('/api/organizations/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            organization_id: newOrg.id,
            organization_name: newOrg.name
          })
        });

        // Set as active organization
        await newOrg.setActive();
        onClose();
      }
    } catch (error) {
      console.error('Failed to create organization:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Create Your SAM AI Workspace</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company/Team Name
            </label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
              className="w-full"
            />
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-medium text-purple-900 mb-2">What you'll get:</h4>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• 2,000 enriched leads per month</li>
              <li>• Multi-channel outreach (LinkedIn + Email)</li>
              <li>• AI-powered reply management</li>
              <li>• Team collaboration & invitations</li>
            </ul>
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              className="flex-1"
              disabled={isCreating || !companyName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}
```

### **5. Updated Main App Component**

#### **Organization-First Page Component**
```typescript
// app/page.tsx (Updated)
'use client';

import { useUser, useOrganization } from '@clerk/nextjs';
import { OrganizationSelector } from './components/OrganizationSelector';
import { SAMChatInterface } from './components/SAMChatInterface';
import { LoadingScreen } from './components/LoadingScreen';

export default function Page() {
  const { user, isLoaded: userLoaded } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();

  // Loading state
  if (!userLoaded || !orgLoaded) {
    return <LoadingScreen />;
  }

  // Not authenticated - Clerk will handle redirect
  if (!user) {
    return <LoadingScreen message="Redirecting to sign-in..." />;
  }

  // User authenticated but no organization
  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <img 
              src="/SAM.jpg" 
              alt="Sam AI" 
              className="w-24 h-24 rounded-full mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to SAM AI!</h1>
            <p className="text-gray-400">
              Create or join a workspace to get started with AI-powered sales automation.
            </p>
          </div>
          
          <OrganizationSelector />
        </div>
      </div>
    );
  }

  // User has organization - show full SAM AI interface
  return <SAMChatInterface organization={organization} user={user} />;
}
```

## 🎯 **Benefits of Clerk-Based Tenancy**

### **1. Simplified Architecture**
- **No Custom Workspace Management** - Leverage Clerk's proven multi-tenant system
- **Native Role Management** - Use Clerk's role-based access control
- **Built-in Invitations** - Clerk handles team invites and onboarding
- **Organization Switching** - Native UI components for tenant switching

### **2. Enhanced Security**
- **JWT-Based Access Control** - Clerk JWTs contain organization context
- **Row-Level Security** - Supabase RLS policies using Clerk organization IDs
- **Role-Based Permissions** - Clerk roles mapped to SAM AI capabilities
- **Audit Trail** - Clerk provides organization activity logging

### **3. Better User Experience**
- **Familiar Organization UI** - Users understand "organizations" vs "workspaces"
- **Seamless Team Management** - Native invitation and member management
- **Professional Branding** - Organization names in URLs and interfaces
- **Scalable Multi-Tenancy** - Users can belong to multiple organizations

### **4. Reduced Maintenance**
- **No Custom Auth Logic** - Clerk handles all authentication flows
- **Automatic Scaling** - Clerk manages organization limits and billing
- **Built-in Analytics** - Organization usage and activity metrics
- **API Simplification** - Single source of truth for user/organization context

## 🚀 **Implementation Roadmap**

### **Phase 1: Core Migration** (This Week)
1. ✅ **Update Database Schema** - Replace workspace tables with organization_id columns
2. ✅ **Fix API Routes** - Use Clerk organization context instead of demo user
3. ✅ **Organization Selector** - UI for creating/switching organizations
4. ✅ **Authentication Flow** - Proper organization-first user experience

### **Phase 2: Enhanced Features** (Next Week)  
1. **Team Management** - Invite members, manage roles, organization settings
2. **Billing Integration** - Organization-based subscription management
3. **Multi-Organization Support** - Users can switch between multiple organizations
4. **Organization Analytics** - Usage metrics and cost tracking per organization

---

**This Clerk-native approach eliminates all the custom tenant management complexity while providing enterprise-grade multi-tenancy with zero maintenance overhead!** 🚀