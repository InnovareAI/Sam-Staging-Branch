/**
 * Workspace Tier Configuration API
 * Manage workspace tier settings and limits
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { z } from 'zod'

const supabase = supabaseAdmin()

interface RouteParams {
  params: {
    workspaceId: string
  }
}

// Validation schema for tier configuration
const TierConfigSchema = z.object({
  tier: z.enum(['startup', 'sme', 'enterprise'], {
    errorMap: () => ({ message: 'Tier must be startup, sme, or enterprise' })
  }),
  monthly_email_limit: z.number().min(0),
  monthly_linkedin_limit: z.number().min(0),
  daily_email_limit: z.number().min(0).optional(),
  daily_linkedin_limit: z.number().min(0).optional(),
  hitl_approval_required: z.boolean().optional(),
  integration_config: z.object({
    unipile_instance_url: z.string().url().optional(),
    reachinbox_api_key: z.string().optional(),
    openai_api_key: z.string().optional(),
    postmark_api_key: z.string().optional()
  }).optional(),
  tier_features: z.object({
    ai_message_generation: z.boolean().optional(),
    advanced_analytics: z.boolean().optional(),
    priority_support: z.boolean().optional(),
    custom_integrations: z.boolean().optional(),
    white_label: z.boolean().optional()
  }).optional()
}).strict()

// GET - Get workspace tier configuration
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = params

    // Get workspace with tier information
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select(`
        id,
        name,
        workspace_tiers (
          tier,
          monthly_email_limit,
          monthly_linkedin_limit,
          daily_email_limit,
          daily_linkedin_limit,
          hitl_approval_required,
          integration_config,
          tier_features,
          created_at,
          updated_at
        )
      `)
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({
        success: false,
        error: 'Workspace not found'
      }, { status: 404 })
    }

    // Get current usage stats
    const { data: usageStats } = await supabase
      .from('campaign_execution_logs')
      .select('channel, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

    const currentUsage = {
      monthly_email_sent: usageStats?.filter(log => log.channel === 'email').length || 0,
      monthly_linkedin_sent: usageStats?.filter(log => log.channel === 'linkedin').length || 0
    }

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        tier_config: workspace.workspace_tiers?.[0] || null,
        current_usage: currentUsage
      }
    })

  } catch (error) {
    console.error('Workspace tier fetch failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Update workspace tier configuration
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = params
    const body = await request.json()

    // Validate request body
    const validation = TierConfigSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid tier configuration',
        details: validation.error.issues
      }, { status: 400 })
    }

    const config = validation.data

    // Verify workspace exists
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({
        success: false,
        error: 'Workspace not found'
      }, { status: 404 })
    }

    // Set tier-specific defaults based on tier
    const tierDefaults = {
      startup: {
        daily_email_limit: Math.floor(config.monthly_email_limit / 30),
        daily_linkedin_limit: Math.floor(config.monthly_linkedin_limit / 30),
        hitl_approval_required: true,
        tier_features: {
          ai_message_generation: true,
          advanced_analytics: false,
          priority_support: false,
          custom_integrations: false,
          white_label: false
        }
      },
      sme: {
        daily_email_limit: Math.floor(config.monthly_email_limit / 30),
        daily_linkedin_limit: Math.floor(config.monthly_linkedin_limit / 30),
        hitl_approval_required: false,
        tier_features: {
          ai_message_generation: true,
          advanced_analytics: true,
          priority_support: true,
          custom_integrations: false,
          white_label: false
        }
      },
      enterprise: {
        daily_email_limit: Math.floor(config.monthly_email_limit / 30),
        daily_linkedin_limit: Math.floor(config.monthly_linkedin_limit / 30),
        hitl_approval_required: false,
        tier_features: {
          ai_message_generation: true,
          advanced_analytics: true,
          priority_support: true,
          custom_integrations: true,
          white_label: true
        }
      }
    }

    const tierConfig = {
      ...tierDefaults[config.tier],
      ...config,
      workspace_id: workspaceId
    }

    // Upsert tier configuration
    const { data: tierData, error: tierError } = await supabase
      .from('workspace_tiers')
      .upsert(tierConfig, {
        onConflict: 'workspace_id'
      })
      .select()
      .single()

    if (tierError) {
      throw tierError
    }

    return NextResponse.json({
      success: true,
      tier_config: tierData,
      message: `Workspace tier updated to ${config.tier}`
    })

  } catch (error) {
    console.error('Workspace tier update failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE - Remove tier configuration (reset to default)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = params

    // Verify workspace exists
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({
        success: false,
        error: 'Workspace not found'
      }, { status: 404 })
    }

    // Delete tier configuration
    const { error: deleteError } = await supabase
      .from('workspace_tiers')
      .delete()
      .eq('workspace_id', workspaceId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Workspace tier configuration reset to default'
    })

  } catch (error) {
    console.error('Workspace tier deletion failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}