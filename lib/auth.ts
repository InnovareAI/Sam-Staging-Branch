/**
 * Firebase-based authentication and authorization system
 * Provides secure session verification, user context extraction, and workspace access control
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { Pool } from 'pg';

// Initialize PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export interface AuthContext {
  userId: string;
  workspaceId: string;
  userEmail: string;
  userRole: 'owner' | 'admin' | 'member';
  workspaceRole: 'owner' | 'admin' | 'member';
  permissions: string[];
}

export interface AuthError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_TOKEN' | 'WORKSPACE_ACCESS_DENIED' | 'MISSING_PERMISSIONS';
  message: string;
  statusCode: 401 | 403;
}

const SESSION_COOKIE_NAME = 'session';

/**
 * Extract and verify Firebase session from request
 * Returns user context or throws AuthError
 */
export async function verifyAuth(request: NextRequest): Promise<AuthContext> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  // Also check Authorization header for API calls
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!sessionCookie && !token) {
    throw {
      code: 'UNAUTHORIZED',
      message: 'No authentication provided',
      statusCode: 401
    } as AuthError;
  }

  try {
    const auth = getAdminAuth();
    let decodedClaims;

    if (sessionCookie) {
      // Verify session cookie
      decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    } else if (token) {
      // Verify ID token from header
      decodedClaims = await auth.verifyIdToken(token);
    }

    if (!decodedClaims) {
      throw {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        statusCode: 401
      } as AuthError;
    }

    // Extract workspace ID from headers
    const workspaceId = request.headers.get('x-workspace-id');
    if (!workspaceId) {
      throw {
        code: 'UNAUTHORIZED',
        message: 'Missing workspace ID header',
        statusCode: 401
      } as AuthError;
    }

    // Get user from database using Firebase UID
    // First, find user by email since we're migrating from Supabase
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [decodedClaims.email]
    );

    if (userResult.rows.length === 0) {
      throw {
        code: 'UNAUTHORIZED',
        message: 'User not found in database',
        statusCode: 401
      } as AuthError;
    }

    const dbUser = userResult.rows[0];

    // Verify user has access to the workspace
    const memberResult = await pool.query(
      `SELECT wm.role, wm.permissions, w.id, w.name
       FROM workspace_members wm
       JOIN workspaces w ON wm.workspace_id = w.id
       WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
      [workspaceId, dbUser.id]
    );

    if (memberResult.rows.length === 0) {
      throw {
        code: 'WORKSPACE_ACCESS_DENIED',
        message: 'Access denied to workspace',
        statusCode: 403
      } as AuthError;
    }

    const membership = memberResult.rows[0];

    return {
      userId: dbUser.id,
      workspaceId,
      userEmail: decodedClaims.email!,
      userRole: 'member',
      workspaceRole: membership.role || 'member',
      permissions: membership.permissions || []
    };

  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error as AuthError;
    }

    console.error('Auth verification error:', error);
    throw {
      code: 'UNAUTHORIZED',
      message: 'Authentication failed',
      statusCode: 401
    } as AuthError;
  }
}

/**
 * Check if user has required permissions for operation
 */
export function hasPermission(authContext: AuthContext, requiredPermissions: string[]): boolean {
  if (authContext.workspaceRole === 'owner') {
    return true;
  }
  return requiredPermissions.every(permission =>
    authContext.permissions.includes(permission)
  );
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
    } as AuthError;
  }
}

/**
 * Common permissions
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
} as const;

/**
 * Create authentication middleware for API routes
 */
export function withAuth(permissions: string[] = []) {
  return async function authMiddleware(request: NextRequest): Promise<AuthContext> {
    const authContext = await verifyAuth(request);

    if (permissions.length > 0) {
      requirePermissions(authContext, permissions);
    }

    return authContext;
  };
}

/**
 * Get current user from session (for server components)
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return null;
    }

    const auth = getAdminAuth();
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    // Get user from database
    const userResult = await pool.query(
      'SELECT id, email, first_name, last_name, current_workspace_id FROM users WHERE email = $1',
      [decodedClaims.email]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    return userResult.rows[0];
  } catch (error) {
    console.error('getCurrentUser error:', error);
    return null;
  }
}