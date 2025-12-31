/**
 * EXAMPLE: Tenant-Protected API Endpoint
 * =====================================
 * This demonstrates how to protect API endpoints with strict tenant isolation
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

// Super admin emails with cross-tenant access
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. TENANT ISOLATION CHECK - CRITICAL SECURITY
    const tenantCheck = await enforceTenantIsolation(request, params.id);
    if (!tenantCheck.success) {
      return tenantCheck.response;
    }

    // 2. BUSINESS LOGIC - Only executes if tenant isolation passes

    // Query campaign with prospects
    const campaignResult = await pool.query(
      `SELECT c.*, json_agg(
         json_build_object(
           'id', cp.id,
           'status', cp.status,
           'prospect', json_build_object('name', cp.first_name || ' ' || cp.last_name, 'email', cp.email, 'company', cp.company_name)
         )
       ) FILTER (WHERE cp.id IS NOT NULL) as prospects
       FROM campaigns c
       LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [params.id]
    );

    if (campaignResult.rows.length === 0) {
      console.error('Campaign fetch error: not found');
      return NextResponse.json(
        { error: 'Campaign not found or access denied' },
        { status: 404 }
      );
    }

    const campaign = campaignResult.rows[0];

    // 3. AUDIT SUCCESSFUL ACCESS
    await logTenantAccess({
      userId: tenantCheck.context!.userId,
      workspaceId: tenantCheck.context!.workspaceId,
      action: 'campaign_view',
      resourceId: params.id,
      resourceType: 'campaign'
    });

    return NextResponse.json({
      campaign,
      tenantContext: {
        workspaceId: tenantCheck.context!.workspaceId,
        organizationId: tenantCheck.context!.organizationId
      }
    });

  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authErr = error as AuthError;
      return NextResponse.json(
        { error: authErr.message },
        { status: authErr.statusCode }
      );
    }
    console.error('Tenant-protected endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. TENANT ISOLATION CHECK
    const tenantCheck = await enforceTenantIsolation(request, params.id, {
      requireWriteAccess: true
    });
    if (!tenantCheck.success) {
      return tenantCheck.response;
    }

    // 2. VALIDATE USER PERMISSIONS
    const hasEditPermission = await checkEditPermissions(
      tenantCheck.context!.userId,
      tenantCheck.context!.workspaceId,
      tenantCheck.context!.userRole
    );

    if (!hasEditPermission) {
      await logTenantViolation('insufficient_permissions', {
        userId: tenantCheck.context!.userId,
        workspaceId: tenantCheck.context!.workspaceId,
        action: 'campaign_edit',
        resourceId: params.id
      });

      return NextResponse.json(
        { error: 'Insufficient permissions to edit campaign' },
        { status: 403 }
      );
    }

    // 3. BUSINESS LOGIC
    const updates = await request.json();

    // Build SET clause dynamically
    const updateKeys = Object.keys(updates);
    const setClause = updateKeys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    const values = [params.id, ...Object.values(updates), new Date().toISOString(), tenantCheck.context!.userId];

    const result = await pool.query(
      `UPDATE campaigns
       SET ${setClause}, updated_at = $${updateKeys.length + 2}, updated_by = $${updateKeys.length + 3}
       WHERE id = $1
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      console.error('Campaign update error: not found');
      return NextResponse.json(
        { error: 'Failed to update campaign' },
        { status: 400 }
      );
    }

    // 4. AUDIT SUCCESSFUL UPDATE
    await logTenantAccess({
      userId: tenantCheck.context!.userId,
      workspaceId: tenantCheck.context!.workspaceId,
      action: 'campaign_update',
      resourceId: params.id,
      resourceType: 'campaign',
      changes: updates
    });

    return NextResponse.json({ campaign: result.rows[0] });

  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authErr = error as AuthError;
      return NextResponse.json(
        { error: authErr.message },
        { status: authErr.statusCode }
      );
    }
    console.error('Campaign update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================================================
// TENANT ISOLATION ENFORCEMENT FUNCTIONS
// =====================================================================================

interface TenantContext {
  userId: string;
  workspaceId: string;
  organizationId: string;
  userRole: string;
  userEmail: string;
}

interface TenantCheckOptions {
  requireWriteAccess?: boolean;
  allowSuperAdmin?: boolean;
}

async function enforceTenantIsolation(
  request: NextRequest,
  resourceId: string,
  options: TenantCheckOptions = {}
): Promise<{
  success: boolean;
  context?: TenantContext;
  response?: NextResponse;
}> {
  try {
    // 1. Get authenticated user via Firebase
    const authContext = await verifyAuth(request);
    const userId = authContext.userId;
    const userEmail = authContext.userEmail.toLowerCase();

    // 2. Check super admin status
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(userEmail);
    if (isSuperAdmin && options.allowSuperAdmin !== false) {
      const userResult = await pool.query(
        'SELECT current_workspace_id FROM users WHERE id = $1',
        [userId]
      );

      return {
        success: true,
        context: {
          userId,
          workspaceId: userResult.rows[0]?.current_workspace_id || '',
          organizationId: '',
          userRole: 'super_admin',
          userEmail
        }
      };
    }

    // 3. Get user's workspace context
    const userResult = await pool.query(
      `SELECT u.current_workspace_id, wm.role, w.organization_id
       FROM users u
       LEFT JOIN workspace_members wm ON wm.user_id = u.id AND wm.workspace_id = u.current_workspace_id
       LEFT JOIN workspaces w ON w.id = u.current_workspace_id
       WHERE u.id = $1`,
      [userId]
    );

    if (!userResult.rows[0]?.current_workspace_id) {
      await logTenantViolation('no_workspace_context', {
        userId,
        userEmail,
        resourceId,
        path: request.nextUrl.pathname
      });

      return {
        success: false,
        response: NextResponse.json(
          { error: 'No workspace context - tenant isolation violation' },
          { status: 403 }
        )
      };
    }

    const userData = userResult.rows[0];

    // 4. Verify resource belongs to user's workspace
    const campaignResult = await pool.query(
      'SELECT workspace_id FROM campaigns WHERE id = $1',
      [resourceId]
    );

    if (campaignResult.rows.length === 0) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      };
    }

    if (campaignResult.rows[0].workspace_id !== userData.current_workspace_id) {
      await logTenantViolation('cross_tenant_access_attempt', {
        userId,
        userWorkspaceId: userData.current_workspace_id,
        resourceWorkspaceId: campaignResult.rows[0].workspace_id,
        resourceId,
        resourceType: 'campaign'
      });

      return {
        success: false,
        response: NextResponse.json(
          { error: 'Access denied - tenant isolation violation' },
          { status: 403 }
        )
      };
    }

    // 5. Build tenant context
    return {
      success: true,
      context: {
        userId,
        workspaceId: userData.current_workspace_id,
        organizationId: userData.organization_id || '',
        userRole: userData.role || 'member',
        userEmail
      }
    };

  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    console.error('Tenant isolation check failed:', error);
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Tenant isolation check failed' },
        { status: 500 }
      )
    };
  }
}

async function checkEditPermissions(
  userId: string,
  workspaceId: string,
  userRole: string
): Promise<boolean> {
  // Define role hierarchy for editing permissions
  const editRoles = ['owner', 'admin', 'member']; // viewer cannot edit
  return editRoles.includes(userRole);
}

async function logTenantViolation(eventType: string, details: any) {
  try {
    await pool.query(
      `INSERT INTO tenant_isolation_audit (event_type, user_id, workspace_id, attempted_workspace_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        eventType,
        details.userId || null,
        details.workspaceId || null,
        details.resourceWorkspaceId || null,
        JSON.stringify(details),
        new Date().toISOString()
      ]
    );
  } catch (error) {
    console.error('Failed to log tenant violation:', error);
  }
}

async function logTenantAccess(details: any) {
  try {
    await pool.query(
      `INSERT INTO tenant_isolation_audit (event_type, user_id, workspace_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'authorized_access',
        details.userId,
        details.workspaceId,
        JSON.stringify(details),
        new Date().toISOString()
      ]
    );
  } catch (error) {
    // Don't fail requests if audit logging fails
    console.error('Failed to log tenant access:', error);
  }
}
