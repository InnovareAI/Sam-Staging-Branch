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

    // Execute the campaign (send to N8N or execute directly)
    try {
      const executeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/campaigns/linkedin/execute-direct`,
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
        console.warn('Campaign execution failed, but campaign is still activated')
      }
    } catch (executeError) {
      console.error('Campaign execution error:', executeError)
      // Don't fail the activation if execution fails - campaign is still activated
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
