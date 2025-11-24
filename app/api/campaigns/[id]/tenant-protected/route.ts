/**
 * EXAMPLE: Tenant-Protected API Endpoint
 * =====================================
 * This demonstrates how to protect API endpoints with strict tenant isolation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

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
    const supabase = createRouteHandlerClient({ cookies: cookies });
    
    // This query will automatically respect RLS policies
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        prospects:campaign_prospects(
          id,
          status,
          prospects(name, email, company)
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Campaign fetch error:', error);
      return NextResponse.json(
        { error: 'Campaign not found or access denied' },
        { status: 404 }
      );
    }

    // 3. AUDIT SUCCESSFUL ACCESS
    await logTenantAccess({
      userId: tenantCheck.context.userId,
      workspaceId: tenantCheck.context.workspaceId,
      action: 'campaign_view',
      resourceId: params.id,
      resourceType: 'campaign'
    });

    return NextResponse.json({
      campaign,
      tenantContext: {
        workspaceId: tenantCheck.context.workspaceId,
        organizationId: tenantCheck.context.organizationId
      }
    });

  } catch (error) {
    console.error('❌ Tenant-protected endpoint error:', error);
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
      tenantCheck.context.userId,
      tenantCheck.context.workspaceId,
      tenantCheck.context.userRole
    );

    if (!hasEditPermission) {
      await logTenantViolation('insufficient_permissions', {
        userId: tenantCheck.context.userId,
        workspaceId: tenantCheck.context.workspaceId,
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
    const supabase = createRouteHandlerClient({ cookies: cookies });
    
    // RLS policies ensure this only updates campaigns in user's workspace
    const { data, error } = await supabase
      .from('campaigns')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: tenantCheck.context.userId
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Campaign update error:', error);
      return NextResponse.json(
        { error: 'Failed to update campaign' },
        { status: 400 }
      );
    }

    // 4. AUDIT SUCCESSFUL UPDATE
    await logTenantAccess({
      userId: tenantCheck.context.userId,
      workspaceId: tenantCheck.context.workspaceId,
      action: 'campaign_update',
      resourceId: params.id,
      resourceType: 'campaign',
      changes: updates
    });

    return NextResponse.json({ campaign: data });

  } catch (error) {
    console.error('❌ Campaign update error:', error);
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
    // 1. Get authenticated user
    const supabase = createRouteHandlerClient({ cookies: cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      };
    }

    const userId = session.user.id;
    const userEmail = session.user.email?.toLowerCase() || '';

    // 2. Check super admin status
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(userEmail);
    if (isSuperAdmin && options.allowSuperAdmin !== false) {
      const { data: userData } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', userId)
        .single();

      return {
        success: true,
        context: {
          userId,
          workspaceId: userData?.current_workspace_id || '',
          organizationId: '',
          userRole: 'super_admin',
          userEmail
        }
      };
    }

    // 3. Get user's workspace context
    const { data: userData } = await supabase
      .from('users')
      .select(`
        current_workspace_id,
        workspace_members!inner(
          workspace_id,
          role,
          workspaces!inner(
            id,
            organization_id
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (!userData?.current_workspace_id) {
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

    // 4. Verify resource belongs to user's workspace
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', resourceId)
      .single();

    if (!campaign) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      };
    }

    if (campaign.workspace_id !== userData.current_workspace_id) {
      await logTenantViolation('cross_tenant_access_attempt', {
        userId,
        userWorkspaceId: userData.current_workspace_id,
        resourceWorkspaceId: campaign.workspace_id,
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
    const currentWorkspace = userData.workspace_members?.find(
      (wm: any) => wm.workspace_id === userData.current_workspace_id
    );

    return {
      success: true,
      context: {
        userId,
        workspaceId: userData.current_workspace_id,
        organizationId: currentWorkspace?.workspaces?.organization_id || '',
        userRole: currentWorkspace?.role || 'member',
        userEmail
      }
    };

  } catch (error) {
    console.error('❌ Tenant isolation check failed:', error);
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
    const supabase = createRouteHandlerClient({ cookies: cookies });
    await supabase
      .from('tenant_isolation_audit')
      .insert({
        event_type: eventType,
        user_id: details.userId || null,
        workspace_id: details.workspaceId || null,
        attempted_workspace_id: details.resourceWorkspaceId || null,
        details: details,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('❌ Failed to log tenant violation:', error);
  }
}

async function logTenantAccess(details: any) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies });
    await supabase
      .from('tenant_isolation_audit')
      .insert({
        event_type: 'authorized_access',
        user_id: details.userId,
        workspace_id: details.workspaceId,
        details: details,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    // Don't fail requests if audit logging fails
    console.error('⚠️ Failed to log tenant access:', error);
  }
}