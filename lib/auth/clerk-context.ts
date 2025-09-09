// lib/auth/clerk-context.ts
import { auth, clerkClient } from '@clerk/nextjs/server';

export interface OrganizationContext {
  user_id: string;
  organization_id: string | null;
  role: string | null;
  needs_organization: boolean;
  permissions: string[];
}

// SAM AI permission mapping based on Clerk roles
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

/**
 * Get current user's organization context from Clerk
 * Handles cases where user has no active organization
 */
export async function getOrganizationContext(): Promise<OrganizationContext> {
  try {
    const { userId, orgId, orgRole } = await auth();
    
    if (!userId) {
      throw new Error('Unauthorized - No user ID');
    }
    
    // If no active organization, get user's organizations
    if (!orgId) {
      try {
        const clerk = await clerkClient();
        const userOrganizations = await clerk.users.getOrganizationMembershipList({
          userId,
        });
        
        if (userOrganizations.data.length === 0) {
          return {
            user_id: userId,
            organization_id: null,
            role: null,
            needs_organization: true,
            permissions: []
          };
        }
        
        // Use first organization as default if no active organization
        const defaultOrg = userOrganizations.data[0];
        return {
          user_id: userId,
          organization_id: defaultOrg.organization.id,
          role: defaultOrg.role,
          needs_organization: false,
          permissions: SAMPermissions[defaultOrg.role as keyof typeof SAMPermissions] || []
        };
      } catch (clerkError) {
        console.error('Error fetching user organizations:', clerkError);
        return {
          user_id: userId,
          organization_id: null,
          role: null,
          needs_organization: true,
          permissions: []
        };
      }
    }
    
    // User has active organization
    return {
      user_id: userId,
      organization_id: orgId,
      role: orgRole || 'basic_member',
      needs_organization: false,
      permissions: SAMPermissions[orgRole as keyof typeof SAMPermissions] || SAMPermissions.basic_member
    };
  } catch (error) {
    console.error('Error getting organization context:', error);
    throw error;
  }
}

/**
 * Require organization access - throws error if user needs organization
 */
export async function requireOrganizationAccess(): Promise<Required<Omit<OrganizationContext, 'needs_organization'>>> {
  const context = await getOrganizationContext();
  
  if (context.needs_organization || !context.organization_id) {
    throw new Error('Organization required');
  }
  
  return {
    user_id: context.user_id,
    organization_id: context.organization_id,
    role: context.role!,
    permissions: context.permissions
  };
}

/**
 * Check if user has specific permission
 */
export function hasPermission(permissions: string[], requiredPermission: string): boolean {
  return permissions.includes(requiredPermission);
}

/**
 * Require specific permission - throws error if not authorized
 */
export function requirePermission(permissions: string[], requiredPermission: string): void {
  if (!hasPermission(permissions, requiredPermission)) {
    throw new Error(`Permission denied: ${requiredPermission}`);
  }
}