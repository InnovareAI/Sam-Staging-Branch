/**
 * Simplified Workspace Authorization
 * Replaces complex workspace_members checks with simple owner_id lookup
 * Date: October 31, 2025
 */

import { createClient } from '@/lib/supabase-server';
import { Pool } from 'pg';

export interface WorkspaceAuthResult {
  authorized: boolean;
  workspace?: {
    id: string;
    name: string;
    owner_id: string;
    workspace_type: 'personal' | 'shared';
  };
  role?: 'owner' | 'admin' | 'member';
  error?: string;
}

/**
 * Check if user has access to workspace (simplified)
 * For personal workspaces: checks owner_id
 * For shared workspaces: checks workspace_members
 */
export async function authorizeWorkspaceAccess(
  workspaceId: string,
  requiredRole?: 'owner' | 'admin' | 'member'
): Promise<WorkspaceAuthResult> {
  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authorized: false,
      error: 'Not authenticated',
    };
  }

  // Get workspace details
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, owner_id, workspace_type')
    .eq('id', workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return {
      authorized: false,
      error: 'Workspace not found',
    };
  }

  // Personal workspace: simple owner check
  if (workspace.workspace_type === 'personal') {
    const isOwner = workspace.owner_id === user.id;

    if (!isOwner) {
      return {
        authorized: false,
        workspace,
        error: 'Not the workspace owner',
      };
    }

    return {
      authorized: true,
      workspace,
      role: 'owner',
    };
  }

  // Shared workspace: check membership
  if (workspace.workspace_type === 'shared') {
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !membership) {
      return {
        authorized: false,
        workspace,
        error: 'Not a member of this workspace',
      };
    }

    // Check required role
    if (requiredRole) {
      const roleHierarchy = { owner: 3, admin: 2, member: 1 };
      const userRoleLevel = roleHierarchy[membership.role as keyof typeof roleHierarchy] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole];

      if (userRoleLevel < requiredRoleLevel) {
        return {
          authorized: false,
          workspace,
          role: membership.role as any,
          error: `Requires ${requiredRole} role`,
        };
      }
    }

    return {
      authorized: true,
      workspace,
      role: membership.role as any,
    };
  }

  return {
    authorized: false,
    error: 'Invalid workspace type',
  };
}

/**
 * Get all workspaces user has access to
 */
export async function getUserWorkspaces(): Promise<
  Array<{
    id: string;
    name: string;
    workspace_type: 'personal' | 'shared';
    role: 'owner' | 'admin' | 'member';
    is_owner: boolean;
  }>
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_user_workspaces', {
    p_user_id: user.id,
  });

  if (error) {
    console.error('Error fetching user workspaces:', error);
    return [];
  }

  return (data || []).map((w: any) => ({
    id: w.workspace_id,
    name: w.workspace_name,
    workspace_type: w.workspace_type,
    role: w.role,
    is_owner: w.is_owner,
  }));
}

/**
 * Get user's default (personal) workspace
 * Creates one if it doesn't exist
 */
export async function getUserDefaultWorkspace(): Promise<{
  id: string;
  name: string;
} | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Try to get existing personal workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('owner_id', user.id)
    .eq('workspace_type', 'personal')
    .single();

  if (workspace) {
    return workspace;
  }

  // Create personal workspace if it doesn't exist
  const { data: newWorkspace, error } = await supabase
    .from('workspaces')
    .insert({
      name: `${user.email}'s Workspace`,
      tenant: `user-${user.id}`,
      owner_id: user.id,
      workspace_type: 'personal',
    })
    .select('id, name')
    .single();

  if (error) {
    console.error('Error creating default workspace:', error);
    return null;
  }

  return newWorkspace;
}

/**
 * DEPRECATED: Use authorizeWorkspaceAccess instead
 * This function is kept for backward compatibility during migration
 */
export async function checkWorkspaceMembership(
  workspaceId: string,
  requiredRole?: 'owner' | 'admin' | 'member'
): Promise<WorkspaceAuthResult> {
  console.warn(
    'checkWorkspaceMembership is deprecated. Use authorizeWorkspaceAccess instead.'
  );
  return authorizeWorkspaceAccess(workspaceId, requiredRole);
}

/**
 * Middleware-style workspace authorization
 * Returns workspace details if authorized, throws error if not
 */
export async function requireWorkspaceAccess(
  workspaceId: string,
  requiredRole?: 'owner' | 'admin' | 'member'
): Promise<{
  workspace: {
    id: string;
    name: string;
    owner_id: string;
    workspace_type: 'personal' | 'shared';
  };
  role: 'owner' | 'admin' | 'member';
}> {
  const result = await authorizeWorkspaceAccess(workspaceId, requiredRole);

  if (!result.authorized || !result.workspace || !result.role) {
    throw new Error(result.error || 'Unauthorized');
  }

  return {
    workspace: result.workspace,
    role: result.role,
  };
}
