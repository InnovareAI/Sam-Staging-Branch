import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaignId, workspaceId } = await request.json()

    if (!campaignId || !workspaceId) {
      return NextResponse.json(
        { error: 'campaignId and workspaceId are required' },
        { status: 400 }
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
      return NextResponse.json(
        { error: 'Unauthorized - not a member of this workspace' },
        { status: 403 }
      )
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Check if campaign is in inactive status
    if (campaign.status !== 'inactive') {
      return NextResponse.json(
        { error: `Campaign is already ${campaign.status}. Only inactive campaigns can be activated.` },
        { status: 400 }
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
      console.error('Failed to activate campaign:', updateError)
      return NextResponse.json(
        { error: 'Failed to activate campaign' },
        { status: 500 }
      )
    }

    // Execute the campaign based on campaign type
    try {
      // Determine execution endpoint based on campaign type
      let executeEndpoint = '/api/campaigns/linkedin/execute-direct' // Default for messenger campaigns

      if (campaign.campaign_type === 'connector') {
        // Connector campaigns send connection requests (for 2nd/3rd degree)
        executeEndpoint = '/api/campaigns/linkedin/execute-live'
      } else if (campaign.campaign_type === 'email') {
        executeEndpoint = '/api/campaigns/email/execute'
      }

      console.log(`Executing ${campaign.campaign_type || 'messenger'} campaign via ${executeEndpoint}`)

      const executeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${executeEndpoint}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId,
            workspaceId
          })
        }
      )

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json().catch(() => ({}))
        console.error('Campaign execution failed:', errorData)

        // CRITICAL: Rollback campaign status to inactive
        await supabase
          .from('campaigns')
          .update({
            status: 'inactive',
            activated_at: null
          })
          .eq('id', campaignId)

        console.log('⚠️ Campaign rolled back to inactive due to execution failure')

        // Return error with correct status
        return NextResponse.json({
          success: false,
          error: `Campaign execution failed: ${errorData.error || 'Unknown error'}`,
          details: 'Campaign has been rolled back to inactive status. Please check your LinkedIn account connection and try again.',
          campaign: {
            id: campaign.id,
            name: campaign.name,
            status: 'inactive'
          }
        }, { status: 500 })
      }
    } catch (executeError) {
      console.error('Campaign execution error:', executeError)

      // CRITICAL: Rollback campaign status to inactive
      await supabase
        .from('campaigns')
        .update({
          status: 'inactive',
          activated_at: null
        })
        .eq('id', campaignId)

      console.log('⚠️ Campaign rolled back to inactive due to execution error')

      return NextResponse.json({
        success: false,
        error: `Campaign execution failed: ${executeError instanceof Error ? executeError.message : 'Unknown error'}`,
        details: 'Campaign has been rolled back to inactive status. Please check your configuration and try again.',
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: 'inactive'
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign activated successfully',
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: 'active'
      }
    })

  } catch (error) {
    console.error('Activation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
