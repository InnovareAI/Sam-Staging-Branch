/**
 * Enterprise-grade authentication and authorization system
 * Provides secure JWT verification, user context extraction, and workspace access control
 */

import { supabaseAdmin } from '../app/lib/supabase'
import { NextRequest } from 'next/server'

// Use admin client for auth verification
const supabase = supabaseAdmin()

export interface AuthContext {
  userId: string
  workspaceId: string
  userEmail: string
  userRole: 'owner' | 'admin' | 'member'
  workspaceRole: 'owner' | 'admin' | 'member'
  permissions: string[]
}

export interface AuthError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_TOKEN' | 'WORKSPACE_ACCESS_DENIED' | 'MISSING_PERMISSIONS'
  message: string
  statusCode: 401 | 403
}

/**
 * Extract and verify JWT token from request
 * Returns user context or throws AuthError
 */
export async function verifyAuth(request: NextRequest): Promise<AuthContext> {
  // Extract Authorization header
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw {
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
      statusCode: 401
    } as AuthError
  }

  const token = authHeader.slice(7)
  
  try {
    // Verify JWT token with Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        statusCode: 401
      } as AuthError
    }

    // Extract workspace ID from headers (validated against user access)
    const workspaceId = request.headers.get('x-workspace-id')
    if (!workspaceId) {
      throw {
        code: 'UNAUTHORIZED',
        message: 'Missing workspace ID header',
        statusCode: 401
      } as AuthError
    }

    // Verify user has access to the workspace
    const { data: workspaceMember, error: memberError } = await supabase
      .from('workspace_members')
      .select(`
        role,
        permissions,
        workspace:workspaces!inner(
          id,
          name,
          status
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (memberError || !workspaceMember) {
      throw {
        code: 'WORKSPACE_ACCESS_DENIED',
        message: 'Access denied to workspace',
        statusCode: 403
      } as AuthError
    }

    // Check workspace is active
    if (workspaceMember.workspace.status !== 'active') {
      throw {
        code: 'WORKSPACE_ACCESS_DENIED',
        message: 'Workspace is not active',
        statusCode: 403
      } as AuthError
    }

    return {
      userId: user.id,
      workspaceId,
      userEmail: user.email!,
      userRole: user.user_metadata?.role || 'member',
      workspaceRole: workspaceMember.role,
      permissions: workspaceMember.permissions || []
    }

  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error as AuthError
    }
    
    throw {
      code: 'UNAUTHORIZED',
      message: 'Authentication failed',
      statusCode: 401
    } as AuthError
  }
}

/**
 * Check if user has required permissions for operation
 */
export function hasPermission(authContext: AuthContext, requiredPermissions: string[]): boolean {
  // Workspace owners have all permissions
  if (authContext.workspaceRole === 'owner') {
    return true
  }

  // Check if user has all required permissions
  return requiredPermissions.every(permission => 
    authContext.permissions.includes(permission)
  )
}

/**
 * Validate user has required permissions or throw error
 */
export function requirePermissions(authContext: AuthContext, requiredPermissions: string[]): void {
  if (!hasPermission(authContext, requiredPermissions)) {
    throw {
      code: 'MISSING_PERMISSIONS',
      message: `Missing required permissions: ${requiredPermissions.join(', ')}`,
      statusCode: 403
    } as AuthError
  }
}

/**
 * Common campaign-related permissions
 */
export const PERMISSIONS = {
  CAMPAIGNS_VIEW: 'campaigns:view',
  CAMPAIGNS_CREATE: 'campaigns:create',
  CAMPAIGNS_EXECUTE: 'campaigns:execute',
  CAMPAIGNS_DELETE: 'campaigns:delete',
  PROSPECTS_VIEW: 'prospects:view',
  PROSPECTS_EDIT: 'prospects:edit',
  PROSPECTS_DELETE: 'prospects:delete',
  N8N_WORKFLOWS_MANAGE: 'n8n:workflows:manage',
  ANALYTICS_VIEW: 'analytics:view'
} as const

/**
 * Create authentication middleware for API routes
 */
export function withAuth(permissions: string[] = []) {
  return async function authMiddleware(request: NextRequest): Promise<AuthContext> {
    const authContext = await verifyAuth(request)
    
    if (permissions.length > 0) {
      requirePermissions(authContext, permissions)
    }
    
    return authContext
  }
}

// Environment validation removed - using custom supabase client