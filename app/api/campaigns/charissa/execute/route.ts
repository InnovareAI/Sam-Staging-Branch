/**
 * Charissa Campaign Execution API
 * Launches LinkedIn campaigns using existing N8N integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Launching Charissa LinkedIn campaign...')
    
    const body = await request.json()
    const { campaign_id, execution_preferences = {} } = body

    if (!campaign_id) {
      return NextResponse.json({
        success: false,
        error: 'Campaign ID required'
      }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        workspace_id,
        status,
        linkedin_config,
        channel_preferences
      `)
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      console.error('❌ Campaign not found:', campaignError)
      return NextResponse.json({
        success: false,
        error: 'Campaign not found'
      }, { status: 404 })
    }

    // Get campaign prospects
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        first_name,
        last_name,
        email,
        company_name,
        linkedin_url,
        linkedin_user_id,
        title,
        status
      `)
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending')
      .limit(100) // Start with first 100 prospects

    if (prospectsError) {
      console.error('❌ Error fetching prospects:', prospectsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch campaign prospects'
      }, { status: 500 })
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No pending prospects found for this campaign'
      }, { status: 400 })
    }

    console.log('👥 Found', prospects.length, 'prospects to process')

    // Prepare LinkedIn campaign data for existing execution endpoint
    const linkedinCampaignData = {
      campaign_id: campaign_id,
      linkedin_account_id: 'he3RXnROSLuhONxgNle7dw', // Charissa's account
      prospects: prospects.map(prospect => ({
        id: prospect.id,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        company_name: prospect.company_name,
        job_title: prospect.title || 'Professional',
        linkedin_user_id: prospect.linkedin_user_id || null, // May be null initially
        linkedin_url: prospect.linkedin_url,
        email: prospect.email,
        personalization_data: {
          first_name: prospect.first_name,
          last_name: prospect.last_name,
          company_name: prospect.company_name,
          title: prospect.title || 'Professional'
        }
      })),
      connection_message: campaign.linkedin_config?.connection_message || 
        'Hi {first_name}, I work for InnovareAI, an AI company known for its innovative workflow automation and AI agent solutions. I\'m always interested in connecting with like-minded individuals who want to learn all things AI. Would you be open to connecting?',
      follow_up_message: campaign.linkedin_config?.follow_up_message || null,
      execution_preferences: {
        batch_size: execution_preferences.batch_size || 20,
        delay_between_requests: execution_preferences.delay_between_requests || 30,
        max_daily_requests: execution_preferences.max_daily_requests || 50,
        start_immediately: execution_preferences.start_immediately !== false
      }
    }

    // Use N8N Sam AI Master Workflow for orchestrated messaging
    console.log('🔗 Executing campaign via N8N Sam AI Master Workflow...')
    
    const n8nPayload = {
      user_id: campaign.workspace_id,
      campaign_id: campaign_id,
      campaign_type: 'linkedin_outreach',
      campaign_data: {
        name: campaign.name,
        linkedin_account_id: 'he3RXnROSLuhONxgNle7dw',
        // Note: connection_message removed - using personalized_message per contact instead
        follow_up_message: campaign.linkedin_config?.follow_up_message || null
      },
      contacts: prospects.map(prospect => {
        // Helper function to personalize any text with prospect data
        const personalizeText = (text) => {
          if (!text) return text;
          return text
            .replace(/{first_name}/g, prospect.first_name || '')
            .replace(/{last_name}/g, prospect.last_name || '')
            .replace(/{company_name}/g, prospect.company_name || '')
            .replace(/{company}/g, prospect.company_name || '')
            .replace(/{title}/g, prospect.title || 'Professional')
            .replace(/{full_name}/g, `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim())
        }
        
        // Get base messages
        const baseConnectionMessage = campaign.linkedin_config?.connection_message || 
          'Hi {first_name}, I work for InnovareAI, an AI company known for its innovative workflow automation and AI agent solutions. I\'m always interested in connecting with like-minded individuals who want to learn all things AI. Would you be open to connecting?'
        
        const baseFollowUpMessage = campaign.linkedin_config?.follow_up_message || null
        
        return {
          id: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`,
          first_name: prospect.first_name,
          last_name: prospect.last_name,
          email: prospect.email,
          company: prospect.company_name,
          title: prospect.title || 'Professional',
          linkedin_url: prospect.linkedin_url,
          linkedin_id: prospect.linkedin_user_id,
          platforms: ['linkedin'],
          priority: 'medium',
          // Personalize ALL message fields
          connection_message: personalizeText(baseConnectionMessage),
          follow_up_message: personalizeText(baseFollowUpMessage),
          personalization_data: {
            first_name: prospect.first_name,
            last_name: prospect.last_name,
            company_name: prospect.company_name,
            title: prospect.title || 'Professional',
            full_name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
            context: 'LinkedIn founder outreach campaign'
          }
        }
      }),
      settings: {
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        webhook_url: `${request.nextUrl.origin}/api/campaigns/linkedin/webhook`,
        batch_size: execution_preferences.batch_size || 20,
        delay_between_requests: execution_preferences.delay_between_requests || 30,
        max_daily_requests: execution_preferences.max_daily_requests || 50
      }
    }
    
    const executionResponse = await fetch('https://workflows.innovareai.com/webhook/sam-charissa-messaging', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(n8nPayload)
    })

    const executionResult = await executionResponse.json()

    if (!executionResponse.ok || !executionResult.success) {
      console.error('❌ LinkedIn campaign execution failed:', executionResult)
      return NextResponse.json({
        success: false,
        error: 'Campaign execution failed',
        details: executionResult.error || 'LinkedIn execution failed'
      }, { status: 500 })
    }

    // Update campaign status
    await supabase
      .from('campaigns')
      .update({ 
        status: 'active',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign_id)

    // Update prospects status to 'processing'
    await supabase
      .from('campaign_prospects')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending')

    const response = {
      success: true,
      campaign_id: campaign_id,
      campaign_name: campaign.name,
      linkedin_account_id: 'he3RXnROSLuhONxgNle7dw',
      execution_details: {
        prospects_processed: prospects.length,
        batch_size: linkedinCampaignData.execution_preferences.batch_size,
        estimated_completion_time: calculateEstimatedCompletion(prospects.length, linkedinCampaignData.execution_preferences),
        execution_id: executionResult.execution_id || executionResult.campaign_id,
        linkedin_account_id: executionResult.linkedin_account_id || 'he3RXnROSLuhONxgNle7dw'
      },
      monitoring: {
        status_endpoint: `/api/campaigns/linkedin/status/${campaign_id}`,
        webhook_url: `${request.nextUrl.origin}/api/campaigns/linkedin/webhook`,
        dashboard_url: `${request.nextUrl.origin}/campaigns/${campaign_id}/monitor`,
        execution_status: executionResult.status || 'active'
      },
      next_steps: [
        '✅ Campaign launched successfully',
        '📊 Monitor progress via webhook updates',
        '🔗 LinkedIn connections will be sent automatically',
        '📈 Track responses in campaign dashboard'
      ]
    }

    console.log('🎉 Campaign launched successfully:')
    console.log('- Campaign ID:', campaign_id)
    console.log('- Prospects:', prospects.length)
    console.log('- LinkedIn Account: he3RXnROSLuhONxgNle7dw')
    console.log('- Status: Active')

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Campaign execution error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Server error during campaign execution'
    }, { status: 500 })
  }
}

function calculateEstimatedCompletion(prospectCount: number, preferences: any): string {
  const batchSize = preferences.batch_size || 20
  const delayBetweenRequests = preferences.delay_between_requests || 30
  const maxDailyRequests = preferences.max_daily_requests || 50
  
  const totalBatches = Math.ceil(prospectCount / batchSize)
  const requestsPerDay = Math.min(maxDailyRequests, prospectCount)
  const daysRequired = Math.ceil(prospectCount / requestsPerDay)
  
  const estimatedDate = new Date()
  estimatedDate.setDate(estimatedDate.getDate() + daysRequired)
  
  return estimatedDate.toISOString()
}