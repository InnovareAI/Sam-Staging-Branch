import { requireAdmin } from '@/lib/security/route-auth';

/**
 * SCALABLE TENANT ONBOARDING SYSTEM
 * =================================
 * Automated onboarding for new organizations with complete tenant isolation
 * Ensures ALL tenants are completely separated regardless of how many join
 */


interface TenantOnboardingRequest {
  organizationName: string;
  organizationSlug: string;
  tenantType: 'infrastructure_owner' | 'client';
  parentInfrastructure?: 'innovareai' | '3cubed'; // Required for clients
  
  // Email Configuration
  emailSender?: string;
  emailSenderName?: string;
  customPostmarkKey?: string;
  
  // Client Configuration
  clientDomain?: string;
  usageLimits?: {
    campaignsPerMonth?: number;
    prospectsPerCampaign?: number;
    emailsPerMonth?: number;
    storageGb?: number;
  };
  
  // Compliance and Data
  dataResidency?: string;
  complianceRequirements?: string[];
  allowedIpRanges?: string[];
  require2FA?: boolean;
  
  // Initial Admin User
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPassword: string;
}

export async function POST(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    console.log('🏢 Starting new tenant onboarding...');
    
    // 1. VALIDATE SUPER ADMIN ACCESS
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email || 
        !['tl@innovareai.com', 'cl@innovareai.com'].includes(session.user.email.toLowerCase())) {
      return NextResponse.json(
        { error: 'Super admin access required for tenant onboarding' },
        { status: 403 }
      );
    }

    // 2. PARSE AND VALIDATE REQUEST
    const tenantData: TenantOnboardingRequest = await request.json();
    
    const validationErrors = validateTenantData(tenantData);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    console.log(`🎯 Onboarding tenant: ${tenantData.organizationName}`);

    // 3. CHECK FOR EXISTING ORGANIZATION
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('slug', tenantData.organizationSlug)
      .single();

    if (existingOrg) {
      return NextResponse.json(
        { error: `Organization with slug '${tenantData.organizationSlug}' already exists` },
        { status: 409 }
      );
    }

    // 4. CREATE ORGANIZATION WITH COMPLETE ISOLATION
    const organizationId = crypto.randomUUID();
    const clerkOrgId = `${tenantData.organizationSlug}_org_${Date.now()}`;

    console.log('📋 Creating organization...');
    const { error: orgError } = await supabase
      .from('organizations')
      .insert({
        id: organizationId,
        clerk_org_id: clerkOrgId,
        name: tenantData.organizationName,
        slug: tenantData.organizationSlug,
        created_by: 'system_onboarding',
        settings: buildOrganizationSettings(tenantData)
      });

    if (orgError) {
      console.error('❌ Organization creation failed:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization', details: orgError.message },
        { status: 500 }
      );
    }

    // 5. CREATE ISOLATED WORKSPACE
    const workspaceId = crypto.randomUUID();
    const workspaceName = `${tenantData.organizationName} Workspace`;
    const workspaceSlug = `${tenantData.organizationSlug}-workspace`;

    console.log('🏗️ Creating isolated workspace...');
    const { error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        id: workspaceId,
        name: workspaceName,
        slug: workspaceSlug,
        organization_id: organizationId,
        owner_id: null, // Will be set when admin user is created
        settings: {
          tenant_isolated: true,
          created_via: 'automated_onboarding',
          isolation_level: 'complete'
        }
      });

    if (workspaceError) {
      console.error('❌ Workspace creation failed:', workspaceError);
      return NextResponse.json(
        { error: 'Failed to create workspace', details: workspaceError.message },
        { status: 500 }
      );
    }

    // 6. CREATE TENANT CONFIGURATION
    console.log('⚙️ Creating tenant configuration...');
    const tenantConfig = buildTenantConfiguration(tenantData, organizationId, workspaceId);
    
    const { error: configError } = await supabase
      .from('tenant_configurations')
      .insert(tenantConfig);

    if (configError) {
      console.error('❌ Tenant configuration failed:', configError);
      return NextResponse.json(
        { error: 'Failed to create tenant configuration', details: configError.message },
        { status: 500 }
      );
    }

    // 7. CREATE ADMIN USER WITH TENANT ISOLATION
    console.log('👤 Creating admin user...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: tenantData.adminEmail,
      password: tenantData.adminPassword,
      email_confirm: true,
      user_metadata: {
        first_name: tenantData.adminFirstName,
        last_name: tenantData.adminLastName,
        organization_id: organizationId,
        workspace_id: workspaceId,
        tenant_type: tenantData.tenantType,
        onboarded_via: 'automated_system'
      }
    });

    if (authError) {
      console.error('❌ Admin user creation failed:', authError);
      return NextResponse.json(
        { error: 'Failed to create admin user', details: authError.message },
        { status: 500 }
      );
    }

    // 8. CREATE USER PROFILE WITH TENANT CONTEXT
    const { error: userProfileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        supabase_id: authUser.user.id,
        email: tenantData.adminEmail,
        first_name: tenantData.adminFirstName,
        last_name: tenantData.adminLastName,
        current_workspace_id: workspaceId,
        default_workspace_id: workspaceId
      });

    if (userProfileError) {
      console.error('❌ User profile creation failed:', userProfileError);
    }

    // 9. ADD USER TO WORKSPACE AS OWNER
    const { error: membershipError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: authUser.user.id,
        role: 'owner',
        invited_by: null
      });

    if (membershipError) {
      console.error('❌ Workspace membership failed:', membershipError);
    }

    // 10. UPDATE WORKSPACE OWNER
    await supabase
      .from('workspaces')
      .update({ owner_id: authUser.user.id })
      .eq('id', workspaceId);

    // 11. INITIALIZE TENANT USAGE TRACKING
    console.log('📊 Initializing usage tracking...');
    const currentMonth = new Date();
    const periodStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const periodEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const usageMetrics = ['campaigns_created', 'emails_sent', 'prospects_added', 'storage_used'];
    for (const metric of usageMetrics) {
      await supabase
        .from('tenant_usage_tracking')
        .insert({
          organization_id: organizationId,
          workspace_id: workspaceId,
          metric_type: metric,
          metric_value: 0,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0]
        });
    }

    // 12. AUDIT LOG THE ONBOARDING
    await supabase
      .from('tenant_isolation_audit')
      .insert({
        event_type: 'tenant_onboarding_completed',
        user_id: session.user.id,
        workspace_id: workspaceId,
        details: {
          organization_id: organizationId,
          organization_name: tenantData.organizationName,
          tenant_type: tenantData.tenantType,
          admin_email: tenantData.adminEmail,
          onboarded_by: session.user.email,
          isolation_level: 'complete'
        }
      });

    // 13. SEND WELCOME EMAIL
    if (tenantData.tenantType === 'client') {
      await sendWelcomeEmail(tenantData, organizationId, workspaceId);
    }

    console.log('✅ Tenant onboarding completed successfully');

    return NextResponse.json({
      success: true,
      message: `Tenant '${tenantData.organizationName}' onboarded successfully`,
      tenant: {
        organizationId,
        workspaceId,
        adminUserId: authUser.user.id,
        organizationName: tenantData.organizationName,
        workspaceName,
        tenantType: tenantData.tenantType,
        emailSender: tenantConfig.email_sender_address,
        isolationLevel: 'complete'
      },
      nextSteps: [
        'Admin user can sign in with provided credentials',
        'Tenant has complete data isolation',
        'Usage tracking is initialized',
        'Email configuration is ready',
        'All RLS policies automatically apply'
      ]
    });

  } catch (error) {
    console.error('❌ Tenant onboarding failed:', error);
    return NextResponse.json(
      { error: 'Tenant onboarding failed', details: error.message },
      { status: 500 }
    );
  }
}

// =====================================================================================
// VALIDATION AND HELPER FUNCTIONS
// =====================================================================================

function validateTenantData(data: TenantOnboardingRequest): string[] {
  const errors: string[] = [];

  if (!data.organizationName?.trim()) {
    errors.push('Organization name is required');
  }

  if (!data.organizationSlug?.trim()) {
    errors.push('Organization slug is required');
  } else if (!/^[a-z0-9-]+$/.test(data.organizationSlug)) {
    errors.push('Organization slug must contain only lowercase letters, numbers, and hyphens');
  }

  if (!['infrastructure_owner', 'client'].includes(data.tenantType)) {
    errors.push('Tenant type must be either "infrastructure_owner" or "client"');
  }

  if (data.tenantType === 'client' && !data.parentInfrastructure) {
    errors.push('Parent infrastructure is required for client tenants');
  }

  if (!data.adminEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminEmail)) {
    errors.push('Valid admin email is required');
  }

  if (!data.adminFirstName?.trim()) {
    errors.push('Admin first name is required');
  }

  if (!data.adminLastName?.trim()) {
    errors.push('Admin last name is required');
  }

  if (!data.adminPassword || data.adminPassword.length < 8) {
    errors.push('Admin password must be at least 8 characters');
  }

  return errors;
}

function buildOrganizationSettings(data: TenantOnboardingRequest) {
  const parentInfraMap = {
    'innovareai': 'aa111111-1111-1111-1111-111111111111',
    '3cubed': 'bb222222-2222-2222-2222-222222222222'
  };

  return {
    tenant_type: data.tenantType,
    parent_infrastructure: data.parentInfrastructure || null,
    parent_infrastructure_id: data.parentInfrastructure ? parentInfraMap[data.parentInfrastructure] : null,
    email_sender: data.emailSender,
    email_sender_name: data.emailSenderName,
    postmark_api_key_env: data.customPostmarkKey,
    billing_responsible: data.tenantType === 'infrastructure_owner',
    data_residency: data.dataResidency || 'US',
    compliance_requirements: data.complianceRequirements || [],
    client_domain: data.clientDomain,
    created_via: 'automated_onboarding',
    isolation_level: 'complete'
  };
}

function buildTenantConfiguration(
  data: TenantOnboardingRequest, 
  organizationId: string, 
  workspaceId: string
) {
  // Determine email configuration based on tenant type and parent
  let emailSender = data.emailSender;
  let emailSenderName = data.emailSenderName;
  let postmarkEnv = data.customPostmarkKey;

  if (data.tenantType === 'client') {
    if (data.parentInfrastructure === 'innovareai') {
      emailSender = emailSender || 'sp@innovareai.com';
      emailSenderName = emailSenderName || 'Sarah Powell';
      postmarkEnv = postmarkEnv || 'POSTMARK_INNOVAREAI_API_KEY';
    } else if (data.parentInfrastructure === '3cubed') {
      emailSender = emailSender || 'sophia@3cubed.ai';
      emailSenderName = emailSenderName || 'Sophia Caldwell';
      postmarkEnv = postmarkEnv || 'POSTMARK_3CUBEDAI_API_KEY';
    }
  }

  return {
    organization_id: organizationId,
    workspace_id: workspaceId,
    tenant_type: data.tenantType,
    email_sender_address: emailSender,
    email_sender_name: emailSenderName,
    postmark_server_token_env: postmarkEnv,
    parent_infrastructure_org: data.tenantType === 'client' ? 
      (data.parentInfrastructure === 'innovareai' ? 'aa111111-1111-1111-1111-111111111111' : 'bb222222-2222-2222-2222-222222222222') : 
      null,
    billing_responsible: data.tenantType === 'infrastructure_owner',
    data_residency: data.dataResidency || 'US',
    client_domain: data.clientDomain,
    usage_limits: data.usageLimits || {
      campaigns_per_month: data.tenantType === 'client' ? 50 : null,
      prospects_per_campaign: data.tenantType === 'client' ? 1000 : null,
      emails_per_month: data.tenantType === 'client' ? 5000 : null,
      storage_gb: data.tenantType === 'client' ? 10 : null
    },
    allowed_ip_ranges: data.allowedIpRanges || [],
    require_2fa: data.require2FA || false
  };
}

async function sendWelcomeEmail(
  data: TenantOnboardingRequest,
  organizationId: string,
  workspaceId: string
) {
  try {
    const parentInfra = data.parentInfrastructure || 'innovareai';
    const postmarkHelper = createPostmarkHelper(
      parentInfra === 'innovareai' ? 'InnovareAI' : '3cubedai'
    );

    if (postmarkHelper) {
      await postmarkHelper.sendEmailSafely({
        To: data.adminEmail,
        Subject: `Welcome to SAM AI - ${data.organizationName} Tenant Setup Complete`,
        HtmlBody: `
          <h2>Welcome to SAM AI!</h2>
          <p>Your organization <strong>${data.organizationName}</strong> has been successfully set up with complete tenant isolation.</p>
          <h3>Your Tenant Details:</h3>
          <ul>
            <li><strong>Organization:</strong> ${data.organizationName}</li>
            <li><strong>Workspace:</strong> ${data.organizationName} Workspace</li>
            <li><strong>Tenant Type:</strong> ${data.tenantType}</li>
            <li><strong>Admin Email:</strong> ${data.adminEmail}</li>
          </ul>
          <p>You can now sign in and start using your completely isolated SAM AI environment.</p>
        `,
        TextBody: `Welcome to SAM AI! Your organization ${data.organizationName} is ready with complete tenant isolation.`
      });
    }
  } catch (error) {
    console.error('⚠️ Welcome email failed:', error);
  }
}

// GET endpoint to list all tenants
export async function GET(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    // Get comprehensive tenant report
    const { data: separationReport } = await supabase.rpc('get_tenant_separation_report');
    const { data: isolationStatus } = await supabase.rpc('verify_multi_tenant_isolation');

    return NextResponse.json({
      tenantSeparationReport: separationReport,
      tenantIsolationStatus: isolationStatus,
      onboardingEndpoint: '/api/admin/tenant-onboarding',
      message: 'Complete tenant isolation system ready for new organizations'
    });

  } catch (error) {
    console.error('❌ Tenant status check failed:', error);
    return NextResponse.json(
      { error: 'Failed to get tenant status' },
      { status: 500 }
    );
  }
}
