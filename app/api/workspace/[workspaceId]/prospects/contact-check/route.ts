import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { WorkspaceProspectManager } from '@/lib/workspace-prospect-manager'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const supabase = supabaseAdmin()
    const { workspaceId } = await params
    const body = await request.json()

    const { prospect_id, contact_method = 'any' } = body

    if (!prospect_id) {
      return NextResponse.json({
        success: false,
        error: 'prospect_id is required'
      }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({
        success: false,
        error: 'Access denied to this workspace'
      }, { status: 403 })
    }

    // Check if prospect can be contacted
    const eligibility = await WorkspaceProspectManager.canContactProspect(
      workspaceId,
      prospect_id,
      user.id,
      contact_method
    )

    // Get prospect details if contact is allowed
    let prospectDetails = null
    if (eligibility.can_contact) {
      const { data: prospect } = await supabase
        .from('workspace_prospects')
        .select(`
          *,
          assigned_user:auth.users!workspace_prospects_assigned_to_fkey(email),
          last_contacted_user:auth.users!workspace_prospects_last_contacted_by_fkey(email)
        `)
        .eq('id', prospect_id)
        .eq('workspace_id', workspaceId)
        .single()

      prospectDetails = prospect
    }

    // Get recent contact history for context
    const { data: recentContacts } = await supabase
      .from('prospect_contact_history')
      .select(`
        *,
        contacted_user:auth.users!prospect_contact_history_contacted_by_fkey(email)
      `)
      .eq('prospect_id', prospect_id)
      .eq('workspace_id', workspaceId)
      .order('contacted_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      eligibility,
      prospect: prospectDetails,
      recent_contacts: recentContacts || [],
      recommendations: generateContactRecommendations(eligibility, prospectDetails, recentContacts)
    })

  } catch (error) {
    console.error('Failed to check contact eligibility:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function generateContactRecommendations(
  eligibility: any,
  prospect: any,
  recentContacts: any[]
): string[] {
  const recommendations: string[] = []

  if (!eligibility.can_contact) {
    switch (eligibility.reason) {
      case 'assigned_to_other_user':
        recommendations.push('This prospect is assigned to another team member. Consider coordinating with them first.')
        recommendations.push('You can reassign the prospect to yourself if needed.')
        break
      case 'cooldown_period':
        recommendations.push(`Wait until ${new Date(eligibility.cooldown_expires_at).toLocaleString()} before contacting again.`)
        recommendations.push('Consider engaging with their content on social media instead.')
        break
      case 'max_contacts_reached':
        recommendations.push('This prospect has been contacted the maximum number of times.')
        recommendations.push('Focus on nurturing the relationship through other channels.')
        break
      case 'prospect_has_replied':
        recommendations.push('This prospect has already responded! Check the conversation history.')
        recommendations.push('Continue the existing conversation rather than starting a new outreach.')
        break
    }
  } else {
    // Provide positive recommendations
    if (eligibility.contact_count === 0) {
      recommendations.push('This is a fresh prospect - perfect for initial outreach!')
      recommendations.push('Consider starting with a personalized connection request or email.')
    } else {
      recommendations.push('This prospect has been contacted before. Review previous messages for context.')
      recommendations.push('Consider a different approach or channel for the follow-up.')
    }

    if (prospect?.company_name) {
      recommendations.push(`Research ${prospect.company_name} for recent news or updates to personalize your message.`)
    }

    if (recentContacts?.length > 0) {
      const lastContact = recentContacts[0]
      const daysSinceContact = Math.floor((new Date().getTime() - new Date(lastContact.contacted_at).getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysSinceContact > 7) {
        recommendations.push(`It's been ${daysSinceContact} days since last contact - good timing for a follow-up.`)
      } else {
        recommendations.push(`Last contact was only ${daysSinceContact} days ago. Consider waiting a bit longer.`)
      }
    }
  }

  return recommendations
}