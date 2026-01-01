/**
 * STRICT TENANT ISOLATION MIDDLEWARE
 * ==================================
 * Enforces zero data pollution across tenants at the API level
 * Complements database-level RLS policies with application-level checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export interface TenantContext {
  userId: string;
  workspaceId: string;
  organizationId: string;
  userRole: string;
  hasAccess: boolean;
}

export interface TenantIsolationOptions {
  requireWorkspace?: boolean;
  allowSuperAdmin?: boolean;
  auditAccess?: boolean;
  strictMode?: boolean;
}

// Super admin emails with full tenant access
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

/**
 * Tenant Isolation Middleware Class
 */
export class TenantIsolationMiddleware {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Extract and validate tenant context from request
   */
  async extractTenantContext(request: NextRequest): Promise<TenantContext | null> {
    try {
      // Get user from Supabase session
      const session = await this.getSessionFromRequest(request);
      if (!session?.user) {
        return null;
      }

      const userId = session.user.id;
      const userEmail = session.user.email?.toLowerCase();

      // Check if user is super admin
      const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(userEmail || '');

      // Get user's current workspace and organization
      const { data: userData } = await this.supabase
        .from('users')
        .select(`
          current_workspace_id,
          workspace_members!inner(
            workspace_id,
            role,
            workspaces!inner(
              id,
              organization_id,
              name
            )
          )
        `)
        .eq('id', userId)
        .single();

      if (!userData?.current_workspace_id && !isSuperAdmin) {
        await this.logTenantViolation('no_workspace_context', {
          userId,
          userEmail,
          path: request.nextUrl.pathname
        });
        return null;
      }

      // Find the current workspace details
      const currentWorkspace = userData.workspace_members?.find(
        (wm: any) => wm.workspace_id === userData.current_workspace_id
      );

      if (!currentWorkspace && !isSuperAdmin) {
        await this.logTenantViolation('invalid_workspace_access', {
          userId,
          workspaceId: userData.current_workspace_id,
          path: request.nextUrl.pathname
        });
        return null;
      }

      return {
        userId,
        workspaceId: userData.current_workspace_id || '',
        organizationId: currentWorkspace?.workspaces?.organization_id || '',
        userRole: currentWorkspace?.role || (isSuperAdmin ? 'super_admin' : 'member'),
        hasAccess: true
      };

    } catch (error) {
      console.error('❌ Tenant context extraction failed:', error);
      await this.logTenantViolation('context_extraction_error', {
        error: error.message,
        path: request.nextUrl.pathname
      });
      return null;
    }
  }

  /**
   * Enforce tenant isolation on API requests
   */
  async enforceTenantIsolation(
    request: NextRequest,
    options: TenantIsolationOptions = {}
  ): Promise<{ 
    success: boolean; 
    context?: TenantContext; 
    response?: NextResponse 
  }> {
    const {
      requireWorkspace = true,
      allowSuperAdmin = true,
      auditAccess = true,
      strictMode = true
    } = options;

    try {
      // Extract tenant context
      const context = await this.extractTenantContext(request);

      if (!context) {
        if (auditAccess) {
          await this.logTenantViolation('unauthorized_access_attempt', {
            path: request.nextUrl.pathname,
            method: request.method,
            ip: this.getClientIP(request),
            userAgent: request.headers.get('user-agent')
          });
        }

        return {
          success: false,
          response: NextResponse.json(
            { 
              error: 'Unauthorized - Invalid tenant context',
              code: 'TENANT_ISOLATION_VIOLATION'
            },
            { status: 403 }
          )
        };
      }

      // Check workspace requirement
      if (requireWorkspace && !context.workspaceId && context.userRole !== 'super_admin') {
        await this.logTenantViolation('workspace_required', {
          userId: context.userId,
          path: request.nextUrl.pathname
        });

        return {
          success: false,
          response: NextResponse.json(
            { 
              error: 'Workspace context required',
              code: 'WORKSPACE_REQUIRED'
            },
            { status: 400 }
          )
        };
      }

      // Validate workspace access for specific workspace requests
      const workspaceId = this.extractWorkspaceIdFromPath(request.nextUrl.pathname);
      if (workspaceId && strictMode) {
        const hasWorkspaceAccess = await this.verifyWorkspaceAccess(
          context.userId, 
          workspaceId
        );

        if (!hasWorkspaceAccess && context.userRole !== 'super_admin') {
          await this.logTenantViolation('cross_tenant_access_attempt', {
            userId: context.userId,
            currentWorkspaceId: context.workspaceId,
            attemptedWorkspaceId: workspaceId,
            path: request.nextUrl.pathname
          });

          return {
            success: false,
            response: NextResponse.json(
              { 
                error: 'Access denied - Tenant isolation violation',
                code: 'CROSS_TENANT_ACCESS_DENIED'
              },
              { status: 403 }
            )
          };
        }
      }

      // Log successful access if auditing enabled
      if (auditAccess) {
        await this.logTenantAccess('authorized_access', {
          userId: context.userId,
          workspaceId: context.workspaceId,
          organizationId: context.organizationId,
          path: request.nextUrl.pathname,
          method: request.method
        });
      }

      return { success: true, context };

    } catch (error) {
      console.error('❌ Tenant isolation enforcement failed:', error);
      
      return {
        success: false,
        response: NextResponse.json(
          { 
            error: 'Internal server error - Tenant isolation check failed',
            code: 'TENANT_ISOLATION_ERROR'
          },
          { status: 500 }
        )
      };
    }
  }

  /**
   * Validate that data operations respect tenant boundaries
   */
  async validateDataAccess(
    userId: string,
    workspaceId: string,
    dataType: string,
    dataId: string
  ): Promise<boolean> {
    try {
      // Check if the data belongs to the user's workspace
      const tableMap: Record<string, string> = {
        'campaign': 'campaigns',
        'prospect': 'prospects',
        'conversation': 'sam_conversation_threads',
        'message': 'sam_messages',
        'knowledge': 'knowledge_base'
      };

      const tableName = tableMap[dataType];
      if (!tableName) {
        return false;
      }

      const { data, error } = await this.supabase
        .from(tableName)
        .select('workspace_id')
        .eq('id', dataId)
        .single();

      if (error || !data) {
        await this.logTenantViolation('data_access_validation_failed', {
          userId,
          workspaceId,
          dataType,
          dataId,
          error: error?.message
        });
        return false;
      }

      const dataOwnsWorkspace = data.workspace_id === workspaceId;
      
      if (!dataOwnsWorkspace) {
        await this.logTenantViolation('cross_tenant_data_access', {
          userId,
          userWorkspaceId: workspaceId,
          dataWorkspaceId: data.workspace_id,
          dataType,
          dataId
        });
      }

      return dataOwnsWorkspace;

    } catch (error) {
      console.error('❌ Data access validation failed:', error);
      return false;
    }
  }

  /**
   * Helper function to get session from request
   */
  private async getSessionFromRequest(request: NextRequest) {
    // This would integrate with your auth system
    // For now, assume we can extract from cookies/headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;

    // Implementation depends on your auth setup
    // This is a placeholder for session extraction
    return null;
  }

  /**
   * Verify user has access to specific workspace
   */
  private async verifyWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();

    return !!data;
  }

  /**
   * Extract workspace ID from URL path
   */
  private extractWorkspaceIdFromPath(path: string): string | null {
    // Look for workspace ID in paths like /workspace/[id]/ or /api/workspace/[id]/
    const workspaceMatch = path.match(/\/(?:workspace|workspaces)\/([^\/]+)/);
    return workspaceMatch ? workspaceMatch[1] : null;
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for') || 
           request.headers.get('x-real-ip') || 
           'unknown';
  }

  /**
   * Log tenant isolation violations
   */
  private async logTenantViolation(eventType: string, details: any) {
    try {
      await this.supabase
        .from('tenant_isolation_audit')
        .insert({
          event_type: eventType,
          user_id: details.userId || null,
          workspace_id: details.workspaceId || null,
          attempted_workspace_id: details.attemptedWorkspaceId || null,
          details: details,
          ip_address: details.ip || null,
          user_agent: details.userAgent || null
        });
    } catch (error) {
      console.error('❌ Failed to log tenant violation:', error);
    }
  }

  /**
   * Log successful tenant access
   */
  private async logTenantAccess(eventType: string, details: any) {
    try {
      await this.supabase
        .from('tenant_isolation_audit')
        .insert({
          event_type: eventType,
          user_id: details.userId,
          workspace_id: details.workspaceId,
          details: details
        });
    } catch (error) {
      // Don't fail requests if audit logging fails
      console.error('⚠️ Failed to log tenant access:', error);
    }
  }
}

/**
 * Convenience function for API route protection
 */
export async function withTenantIsolation(
  request: NextRequest,
  options?: TenantIsolationOptions
) {
  const middleware = new TenantIsolationMiddleware();
  return middleware.enforceTenantIsolation(request, options);
}

/**
 * Higher-order function for protecting API routes
 */
export function requireTenantIsolation(options?: TenantIsolationOptions) {
  return async function(request: NextRequest) {
    const result = await withTenantIsolation(request, options);
    
    if (!result.success) {
      return result.response;
    }
    
    // Add tenant context to request for use in handlers
    (request as any).tenantContext = result.context;
    return null; // Continue to actual handler
  };
}

/**
 * Tenant context hook for API handlers
 */
export function getTenantContext(request: NextRequest): TenantContext | null {
  return (request as any).tenantContext || null;
}