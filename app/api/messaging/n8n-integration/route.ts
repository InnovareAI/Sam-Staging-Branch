/**
 * N8N Messaging Integration API
 * Connects SAM campaigns to N8N workflows at workflows.innovareai.com
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// N8N Configuration
const N8N_BASE_URL = 'https://workflows.innovareai.com'
const N8N_API_KEY = process.env.N8N_API_KEY || 'your-n8n-api-key'

interface N8NWorkflowTrigger {
  workflowId: string
  campaign_id: string
  workspace_id: string
  prospects: Array<{
    id: string
    first_name: string
    last_name: string
    email?: string
    company_name: string
    linkedin_url?: string
    linkedin_user_id?: string
  }>
  messaging_config: {
    connection_message: string
    follow_up_message?: string
    linkedin_account_id: string
  }
  execution_preferences: {
    batch_size: number
    delay_between_requests: number
    max_daily_requests: number
  }
}

interface N8NWorkflowResponse {
  executionId: string
  status: 'started' | 'completed' | 'failed'
  message: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 N8N Messaging Integration - Triggering workflow...')
    
    const body: N8NWorkflowTrigger = await request.json()
    const { 
      workflowId = 'SAM_LINKEDIN_MASTER_WORKFLOW',
      campaign_id, 
      workspace_id, 
      prospects, 
      messaging_config, 
      execution_preferences 
    } = body

    if (!campaign_id || !prospects?.length) {
      return NextResponse.json({
        success: false,
        error: 'Campaign ID and prospects required'
      }, { status: 400 })
    }

    console.log('📊 Processing:', {
      campaign_id,
      workspace_id,
      prospects: prospects.length,
      linkedin_account: messaging_config.linkedin_account_id
    })

    // Prepare N8N workflow payload
    const n8nPayload = {
      // Workflow identification
      workflow_id: workflowId,
      execution_source: 'SAM_AI_CAMPAIGN',
      
      // Campaign context
      campaign_context: {
        campaign_id,
        workspace_id,
        total_prospects: prospects.length,
        created_at: new Date().toISOString()
      },
      
      // LinkedIn account configuration
      linkedin_config: {
        account_id: messaging_config.linkedin_account_id,
        unipile_account_id: messaging_config.linkedin_account_id, // Same for now
        connection_message: messaging_config.connection_message,
        follow_up_message: messaging_config.follow_up_message,
        rate_limits: {
          max_connections_per_day: execution_preferences.max_daily_requests || 50,
          delay_between_requests: execution_preferences.delay_between_requests || 30,
          batch_size: execution_preferences.batch_size || 20
        }
      },
      
      // Prospect data for processing
      prospects: prospects.map(prospect => ({
        sam_prospect_id: prospect.id,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        full_name: `${prospect.first_name} ${prospect.last_name}`,
        email: prospect.email,
        company_name: prospect.company_name,
        linkedin_url: prospect.linkedin_url,
        linkedin_user_id: prospect.linkedin_user_id,
        personalization_data: {
          first_name: prospect.first_name,
          company_name: prospect.company_name,
          connection_message: messaging_config.connection_message
            .replace('{first_name}', prospect.first_name)
            .replace('{company_name}', prospect.company_name)
        }
      })),
      
      // Execution settings
      execution_settings: {
        start_immediately: true,
        batch_processing: true,
        batch_size: execution_preferences.batch_size,
        webhook_callback_url: `${request.nextUrl.origin}/api/campaigns/linkedin/webhook`,
        status_update_frequency: 'real_time'
      }
    }

    console.log('🚀 Triggering N8N workflow:', workflowId)

    // Call N8N workflow via webhook or API
    let n8nResponse: N8NWorkflowResponse
    
    try {
      // Method 1: Direct N8N API call
      const response = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': N8N_API_KEY,
          'User-Agent': 'SAM-AI-Platform/1.0'
        },
        body: JSON.stringify(n8nPayload)
      })

      if (!response.ok) {
        throw new Error(`N8N API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      n8nResponse = {
        executionId: data.id || data.executionId || `exec_${Date.now()}`,
        status: data.finished ? 'completed' : 'started',
        message: data.finished ? 'Workflow completed' : 'Workflow started successfully'
      }
      
      console.log('✅ N8N workflow triggered:', n8nResponse.executionId)
      
    } catch (error) {
      console.warn('⚠️  Direct N8N API failed, trying webhook method...')
      
      // Method 2: Webhook trigger (fallback)
      const webhookResponse = await fetch(`${N8N_BASE_URL}/webhook/sam-campaign-trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SAM-API-KEY': N8N_API_KEY
        },
        body: JSON.stringify(n8nPayload)
      })

      if (!webhookResponse.ok) {
        throw new Error(`N8N webhook error: ${webhookResponse.status}`)
      }

      const webhookData = await webhookResponse.json()
      n8nResponse = {
        executionId: webhookData.execution_id || `webhook_${Date.now()}`,
        status: 'started',
        message: 'Workflow triggered via webhook'
      }
      
      console.log('✅ N8N webhook triggered:', n8nResponse.executionId)
    }

    // Update campaign status in database
    const supabase = supabaseAdmin()
    
    // Record N8N execution
    await supabase
      .from('n8n_campaign_executions')
      .insert([{
        campaign_id,
        workspace_id,
        n8n_execution_id: n8nResponse.executionId,
        n8n_workflow_id: workflowId,
        status: 'started',
        workspace_config: {
          linkedin_config: messaging_config,
          execution_preferences
        },
        progress: {
          total_prospects: prospects.length,
          processed_prospects: 0,
          successful_outreach: 0,
          failed_outreach: 0
        },
        started_at: new Date().toISOString()
      }])

    // Update campaign status
    await supabase
      .from('campaigns')
      .update({
        status: 'active',
        n8n_execution_id: n8nResponse.executionId,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign_id)

    // Update prospects status
    const prospectIds = prospects.map(p => p.id)
    await supabase
      .from('campaign_prospects')
      .update({
        status: 'processing',
        n8n_execution_id: n8nResponse.executionId,
        updated_at: new Date().toISOString()
      })
      .in('id', prospectIds)

    const response = {
      success: true,
      n8n_execution_id: n8nResponse.executionId,
      workflow_id: workflowId,
      campaign_id,
      execution_details: {
        prospects_count: prospects.length,
        linkedin_account: messaging_config.linkedin_account_id,
        batch_size: execution_preferences.batch_size,
        estimated_duration: calculateEstimatedDuration(prospects.length, execution_preferences)
      },
      monitoring: {
        status_endpoint: `/api/campaigns/linkedin/status/${n8nResponse.executionId}`,
        webhook_url: `${request.nextUrl.origin}/api/campaigns/linkedin/webhook`,
        n8n_dashboard: `${N8N_BASE_URL}/workflow/${workflowId}/executions/${n8nResponse.executionId}`
      },
      next_steps: [
        '✅ N8N workflow started successfully',
        '🔗 LinkedIn connections will be sent automatically',
        '📊 Real-time progress updates via webhook',
        '📈 Monitor campaign progress in dashboard'
      ]
    }

    console.log('🎉 N8N messaging integration complete:', {
      execution_id: n8nResponse.executionId,
      prospects: prospects.length,
      status: 'active'
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ N8N messaging integration error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'N8N integration failed',
      details: 'Failed to trigger N8N workflow',
      troubleshooting: [
        'Check N8N instance availability at workflows.innovareai.com',
        'Verify N8N API key configuration',
        'Ensure workflow exists and is active',
        'Check network connectivity'
      ]
    }, { status: 500 })
  }
}

function calculateEstimatedDuration(prospectCount: number, preferences: any): string {
  const batchSize = preferences.batch_size || 20
  const delayBetweenRequests = preferences.delay_between_requests || 30 // seconds
  const maxDailyRequests = preferences.max_daily_requests || 50
  
  const totalBatches = Math.ceil(prospectCount / batchSize)
  const requestsPerDay = Math.min(maxDailyRequests, prospectCount)
  const daysRequired = Math.ceil(prospectCount / requestsPerDay)
  
  if (daysRequired === 1) {
    const totalTimeSeconds = totalBatches * delayBetweenRequests
    const hours = Math.floor(totalTimeSeconds / 3600)
    const minutes = Math.floor((totalTimeSeconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  } else {
    return `${daysRequired} days`
  }
}