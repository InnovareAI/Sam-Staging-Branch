import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw apiError.unauthorized()
    }

    const { campaignId, workspaceId } = await request.json()

    if (!campaignId || !workspaceId) {
      throw apiError.validation(
        'Missing required fields',
        'campaignId and workspaceId are required'
      )
    }

    // Verify user has access to this workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      throw apiError.forbidden('Not a member of this workspace')
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .single()

    if (campaignError || !campaign) {
      throw apiError.notFound('Campaign')
    }

    // Check if campaign can be activated (draft or inactive status)
    if (campaign.status !== 'inactive' && campaign.status !== 'draft') {
      throw apiError.validation(
        `Campaign is already ${campaign.status}`,
        'Only draft or inactive campaigns can be activated'
      )
    }

    // Update campaign status to active
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'active',
        activated_at: new Date().toISOString()
      })
      .eq('id', campaignId)

    if (updateError) {
      throw apiError.database('campaign activation', updateError)
    }

    // Execute the campaign based on campaign type
    try {
      // Determine execution endpoint based on campaign type
      // Dec 5 FIX: connector = LinkedIn connection requests, NOT email!
      let executeEndpoint = '/api/campaigns/direct/send-connection-requests-fast' // Queue-based Unipile for LinkedIn campaigns

      if (campaign.campaign_type === 'email') {
        // Queue-based email sending with compliance (40/day, 8-5, no weekends/holidays)
        executeEndpoint = '/api/campaigns/email/send-emails-queued'
      } else if (campaign.campaign_type === 'connector' || campaign.campaign_type === 'linkedin' || campaign.campaign_type === 'messenger') {
        // LinkedIn campaigns: connector, messenger, linkedin (legacy)
        executeEndpoint = '/api/campaigns/direct/send-connection-requests-fast'
      }

      console.log(`Executing ${campaign.campaign_type || 'messenger'} campaign via ${executeEndpoint}`)

      const executeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${executeEndpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Dec 5 FIX: Pass internal trigger to bypass auth in execution endpoint
            // User is already authenticated above, so we can trust this internal call
            'x-internal-trigger': 'campaign-activation'
          },
          body: JSON.stringify({
            campaignId
          })
        }
      )

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json().catch(() => ({}))
        console.error('Campaign execution failed:', errorData)

        // CRITICAL: Rollback campaign status to inactive
        const { error: rollbackError } = await supabase
          .from('campaigns')
          .update({
            status: 'inactive',
            activated_at: null
          })
          .eq('id', campaignId)

        if (rollbackError) {
          console.error('⚠️ Failed to rollback campaign status:', rollbackError)
        } else {
          console.log('⚠️ Campaign rolled back to inactive due to execution failure')
        }

        // Throw standardized error
        throw apiError.internal(
          'Campaign execution failed',
          `${errorData.error || 'Unknown error'}. Campaign has been rolled back to inactive status. Please check your LinkedIn account connection and try again.`
        )
      }
    } catch (executeError) {
      // If it's already an ApiError, re-throw it
      if (executeError instanceof Error && executeError.name === 'ApiError') {
        throw executeError
      }

      console.error('Campaign execution error:', executeError)

      // CRITICAL: Rollback campaign status to inactive
      const { error: rollbackError } = await supabase
        .from('campaigns')
        .update({
          status: 'inactive',
          activated_at: null
        })
        .eq('id', campaignId)

      if (rollbackError) {
        console.error('⚠️ Failed to rollback campaign status:', rollbackError)
      } else {
        console.log('⚠️ Campaign rolled back to inactive due to execution error')
      }

      throw apiError.internal(
        'Campaign execution failed',
        `${executeError instanceof Error ? executeError.message : 'Unknown error'}. Campaign has been rolled back to inactive status. Please check your configuration and try again.`
      )
    }

    return apiSuccess({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: 'active'
      }
    }, 'Campaign activated successfully')

  } catch (error) {
    return handleApiError(error, 'campaign_activation')
  }
}
