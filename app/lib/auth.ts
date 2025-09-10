import { currentUser, auth as clerkAuth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CurrentUserData {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  organizationId?: string;
  organizationSlug?: string;
  role?: string;
}

/**
 * Get the current authenticated user with organization context
 */
export async function getCurrentUser(): Promise<CurrentUserData | null> {
  try {
    const { userId, orgId, orgSlug, orgRole } = await clerkAuth();
    
    if (!userId) {
      return null;
    }

    const user = await currentUser();
    if (!user) {
      return null;
    }

    return {
      id: userId,
      clerkId: userId,
      email: user.emailAddresses[0]?.emailAddress || '',
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      imageUrl: user.imageUrl || undefined,
      organizationId: orgId || undefined,
      organizationSlug: orgSlug || undefined,
      role: orgRole || undefined,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Sync Clerk user to Supabase
 */
export async function syncUserToSupabase(userId: string) {
  try {
    const user = await currentUser();
    if (!user) {
      throw new Error('User not found');
    }

    const { error } = await supabaseAdmin
      .from('users')
      .upsert({
        clerk_id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        first_name: user.firstName,
        last_name: user.lastName,
        image_url: user.imageUrl,
      }, {
        onConflict: 'clerk_id'
      });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error syncing user to Supabase:', error);
    return false;
  }
}

/**
 * Check if user has access to a resource based on organization
 */
export function hasOrganizationAccess(userOrgId?: string, resourceOrgId?: string): boolean {
  if (!userOrgId || !resourceOrgId) {
    return false;
  }
  return userOrgId === resourceOrgId;
}

/**
 * Get organization context for API requests
 */
export async function getOrganizationContext() {
  const { orgId, orgSlug, orgRole } = await clerkAuth();
  
  return {
    organizationId: orgId,
    organizationSlug: orgSlug,
    role: orgRole,
    hasOrganization: !!orgId,
  };
}

/**
 * Require authentication and organization for API routes
 */
export async function requireAuth() {
  const { userId } = await clerkAuth();
  
  if (!userId) {
    throw new Error('Unauthorized: No user found');
  }
  
  return userId;
}

/**
 * Require organization context for multi-tenant features
 */
export async function requireOrganization() {
  const { userId, orgId } = await clerkAuth();
  
  if (!userId) {
    throw new Error('Unauthorized: No user found');
  }
  
  if (!orgId) {
    throw new Error('Unauthorized: No organization context');
  }
  
  return { userId, organizationId: orgId };
}