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

    // ============================================================
    // VALIDATION: Ensure campaign is properly configured before activation
    // Dec 8: Added to prevent silent failures during execution
    // ============================================================

    // 1. LinkedIn account must be configured for LinkedIn campaigns
    const isLinkedInCampaign = ['connector', 'linkedin', 'messenger'].includes(campaign.campaign_type || 'connector')
    if (isLinkedInCampaign && !campaign.linkedin_account_id) {
      throw apiError.validation(
        'LinkedIn account not configured',
        'Please select a LinkedIn account in campaign settings before activating. Go to Settings → LinkedIn Accounts to connect one.'
      )
    }

    // 2. Verify the LinkedIn account exists and is active
    if (campaign.linkedin_account_id) {
      const { data: linkedinAccount, error: accountError } = await supabase
        .from('workspace_accounts')
        .select('id, account_name, connection_status, is_active')
        .eq('id', campaign.linkedin_account_id)
        .single()

      if (accountError || !linkedinAccount) {
        throw apiError.validation(
          'LinkedIn account not found',
          'The configured LinkedIn account no longer exists. Please select a different account.'
        )
      }

      if (!linkedinAccount.is_active) {
        throw apiError.validation(
          'LinkedIn account is inactive',
          `The account "${linkedinAccount.account_name}" is inactive. Please reconnect it in Settings → LinkedIn Accounts.`
        )
      }

      if (linkedinAccount.connection_status !== 'connected') {
        throw apiError.validation(
          'LinkedIn account disconnected',
          `The account "${linkedinAccount.account_name}" is ${linkedinAccount.connection_status}. Please reconnect it in Settings → LinkedIn Accounts.`
        )
      }
    }

    // 3. Check for prospects ready to send
    const { count: prospectCount, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'approved'])
      .not('linkedin_url', 'is', null)

    if (prospectError) {
      console.error('Error checking prospects:', prospectError)
    }

    if (!prospectCount || prospectCount === 0) {
      throw apiError.validation(
        'No prospects ready to send',
        'Add and approve prospects before activating. Prospects must have LinkedIn URLs and be in pending or approved status.'
      )
    }

    // 4. Check connection message exists for connector campaigns
    if (campaign.campaign_type === 'connector' || !campaign.campaign_type) {
      const connectionMessage =
        campaign.message_templates?.connection_request ||
        campaign.connection_message ||
        (campaign.linkedin_config as any)?.connection_message ||
        (campaign.draft_data as any)?.connectionRequestMessage

      if (!connectionMessage) {
        throw apiError.validation(
          'Connection message not configured',
          'Please add a connection request message in the campaign builder before activating.'
        )
      }
    }

    console.log(`✅ Campaign validation passed: ${prospectCount} prospects ready, LinkedIn account configured`)

    // Update campaign status to active
    // Dec 5 FIX: Use launched_at instead of activated_at (column doesn't exist)
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'active',
        launched_at: new Date().toISOString()
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
            launched_at: null
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
