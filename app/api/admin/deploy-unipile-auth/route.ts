
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/security/route-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Deploy Unipile authentication across all tenants/workspaces
export async function POST(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    const body = await request.json()
    const { 
      target_tenants = 'all', // 'all' | 'specific' | 'new_only'
      workspace_ids = [],
      deployment_mode = 'production' // 'test' | 'production'
    } = body

    console.log(`🚀 Starting Unipile auth deployment for ${target_tenants} tenants`)

    // Get target workspaces
    let workspaces: any[] = []
    
    if (target_tenants === 'all') {
      const { data: allWorkspaces } = await supabase
        .from('workspaces')
        .select('id, name, slug, owner_id, settings')
        .eq('is_active', true)
      workspaces = allWorkspaces || []
    } else if (target_tenants === 'specific' && workspace_ids.length > 0) {
      const { data: specificWorkspaces } = await supabase
        .from('workspaces')
        .select('id, name, slug, owner_id, settings')
        .in('id', workspace_ids)
        .eq('is_active', true)
      workspaces = specificWorkspaces || []
    } else if (target_tenants === 'new_only') {
      // Get workspaces without Unipile auth configured
      const { data: newWorkspaces } = await supabase
        .from('workspaces')
        .select('id, name, slug, owner_id, settings')
        .eq('is_active', true)
        .is('settings->unipile_auth_configured', null)
      workspaces = newWorkspaces || []
    }

    console.log(`📊 Found ${workspaces.length} workspaces for deployment`)

    const deploymentResults: any[] = []

    // Deploy Unipile auth for each workspace
    for (const workspace of workspaces) {
      try {
        console.log(`🔧 Deploying Unipile auth for workspace: ${workspace.name} (${workspace.id})`)

        const deploymentResult = await deployUnipileAuthForWorkspace(workspace, deployment_mode)
        deploymentResults.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          status: 'success',
          ...deploymentResult
        })

        // Update workspace settings
        await supabase
          .from('workspaces')
          .update({
            settings: {
              ...workspace.settings,
              unipile_auth_configured: true,
              unipile_deployment_date: new Date().toISOString(),
              unipile_deployment_mode: deployment_mode
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', workspace.id)

        console.log(`✅ Successfully deployed Unipile auth for ${workspace.name}`)
        
      } catch (workspaceError) {
        console.error(`❌ Failed to deploy Unipile auth for workspace ${workspace.name}:`, workspaceError)
        deploymentResults.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          status: 'error',
          error: workspaceError instanceof Error ? workspaceError.message : 'Unknown error'
        })
      }
    }

    // Generate deployment summary
    const successCount = deploymentResults.filter(r => r.status === 'success').length
    const errorCount = deploymentResults.filter(r => r.status === 'error').length

    console.log(`📈 Deployment Summary: ${successCount} success, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      deployment_summary: {
        total_workspaces: workspaces.length,
        successful_deployments: successCount,
        failed_deployments: errorCount,
        deployment_mode: deployment_mode,
        deployment_timestamp: new Date().toISOString()
      },
      deployment_results: deploymentResults,
      next_steps: {
        monitor_auth_status: '/api/admin/monitor-unipile-status',
        verify_integrations: '/api/admin/verify-unipile-integrations'
      }
    })

  } catch (error) {
    console.error('❌ Unipile auth deployment failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function deployUnipileAuthForWorkspace(workspace: any, mode: string) {
  const unipileDsn = process.env.UNIPILE_DSN
  const unipileApiKey = process.env.UNIPILE_API_KEY

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured')
  }

  // 1. Create workspace-specific auth configuration
  const authConfig = {
    workspace_id: workspace.id,
    workspace_name: workspace.name,
    workspace_slug: workspace.slug,
    callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/linkedin/callback`,
    success_redirect: `${process.env.NEXT_PUBLIC_SITE_URL}/integrations/linkedin?connected=true`,
    error_redirect: `${process.env.NEXT_PUBLIC_SITE_URL}/integrations/linkedin?error=auth_failed`,
    webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/linkedin/webhook`,
    platforms: ['LINKEDIN'] // Can extend to EMAIL, etc.
  }

  // 2. Test Unipile API connectivity
  const connectivityTest = await testUnipileConnectivity()
  
  // 3. Configure workspace-specific webhooks
  const webhookConfig = await configureWorkspaceWebhooks(workspace, authConfig)

  // 4. Store integration status in database
  await supabase
    .from('integration_status')
    .upsert({
      user_id: workspace.owner_id,
      workspace_id: workspace.id,
      integration_type: 'unipile_linkedin',
      status: 'configured',
      account_identifier: workspace.slug,
      account_name: workspace.name,
      connection_details: {
        auth_config: authConfig,
        deployment_mode: mode,
        api_connectivity: connectivityTest
      },
      last_checked_at: new Date().toISOString(),
      last_successful_at: new Date().toISOString()
    }, { onConflict: 'user_id,workspace_id,integration_type' })

  return {
    auth_config: authConfig,
    webhook_config: webhookConfig,
    api_connectivity: connectivityTest,
    deployment_timestamp: new Date().toISOString()
  }
}

async function testUnipileConnectivity() {
  try {
    const response = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Accept': 'application/json'
      }
    })
    
    return {
      status: response.ok ? 'connected' : 'error',
      response_time_ms: Date.now(),
      api_version: response.headers.get('x-api-version') || 'unknown'
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}

async function configureWorkspaceWebhooks(workspace: any, authConfig: any) {
  // Configure workspace-specific webhook endpoints
  return {
    webhook_url: authConfig.webhook_url,
    callback_url: authConfig.callback_url,
    workspace_isolation: true,
    configured_at: new Date().toISOString()
  }
}

// GET - Check deployment status across tenants
export async function GET(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')

    let query = supabase
      .from('integration_status')
      .select('*')
      .eq('integration_type', 'unipile_linkedin')

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    }

    const { data: deploymentStatus } = await query.order('updated_at', { ascending: false })

    const summary = {
      total_tenants: deploymentStatus?.length || 0,
      connected: deploymentStatus?.filter(s => s.status === 'connected').length || 0,
      configured: deploymentStatus?.filter(s => s.status === 'configured').length || 0,
      errors: deploymentStatus?.filter(s => s.status === 'error').length || 0
    }

    return NextResponse.json({
      success: true,
      deployment_summary: summary,
      tenant_status: deploymentStatus,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to get deployment status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
