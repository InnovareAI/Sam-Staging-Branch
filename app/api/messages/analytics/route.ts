import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'overview'
    const workspaceId = searchParams.get('workspace_id')
    const platform = searchParams.get('platform')
    const days = parseInt(searchParams.get('days') || '30')

    let response: any = {}

    switch (view) {
      case 'overview':
        // Unified message overview with optional filtering
        let overviewQuery = supabase
          .from('unified_message_overview')
          .select('*')
          .order('sent_at', { ascending: false })
          .limit(100)

        if (workspaceId) {
          overviewQuery = overviewQuery.eq('workspace_id', workspaceId)
        }
        if (platform) {
          overviewQuery = overviewQuery.eq('platform', platform)
        }
        if (days > 0) {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - days)
          overviewQuery = overviewQuery.gte('sent_at', cutoffDate.toISOString())
        }

        const { data: overview, error: overviewError } = await overviewQuery
        if (overviewError) throw overviewError
        response.overview = overview
        break

      case 'analytics':
        // Response analytics dashboard
        let analyticsQuery = supabase
          .from('response_analytics_dashboard')
          .select('*')
          .order('total_messages_sent', { ascending: false })

        if (workspaceId) {
          analyticsQuery = analyticsQuery.eq('workspace_id', workspaceId)
        }
        if (platform) {
          analyticsQuery = analyticsQuery.eq('platform', platform)
        }

        const { data: analytics, error: analyticsError } = await analyticsQuery
        if (analyticsError) throw analyticsError
        response.analytics = analytics
        break

      case 'activity':
        // Recent activity feed
        let activityQuery = supabase
          .from('recent_activity_feed')
          .select('*')
          .order('activity_timestamp', { ascending: false })
          .limit(50)

        if (workspaceId) {
          activityQuery = activityQuery.eq('workspace_id', workspaceId)
        }
        if (platform) {
          activityQuery = activityQuery.eq('platform', platform)
        }
        if (days > 0) {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - days)
          activityQuery = activityQuery.gte('activity_timestamp', cutoffDate.toISOString())
        }

        const { data: activity, error: activityError } = await activityQuery
        if (activityError) throw activityError
        response.activity = activity
        break

      case 'platform_comparison':
        // Platform performance comparison
        const { data: platformComparison, error: platformError } = await supabase
          .from('platform_performance_comparison')
          .select('*')
          .order('total_messages', { ascending: false })

        if (platformError) throw platformError
        response.platform_comparison = platformComparison
        break

      case 'conversations':
        // Conversation threads
        let conversationsQuery = supabase
          .from('conversation_threads')
          .select('*')
          .order('last_activity_at', { ascending: false })
          .limit(100)

        if (workspaceId) {
          conversationsQuery = conversationsQuery.eq('workspace_id', workspaceId)
        }
        if (platform) {
          conversationsQuery = conversationsQuery.eq('platform', platform)
        }

        const { data: conversations, error: conversationsError } = await conversationsQuery
        if (conversationsError) throw conversationsError
        response.conversations = conversations
        break

      case 'trends':
        // Daily message trends
        let trendsQuery = supabase
          .from('daily_message_trends')
          .select('*')
          .order('message_date', { ascending: false })
          .limit(days > 0 ? days : 30)

        if (workspaceId) {
          trendsQuery = trendsQuery.eq('workspace_id', workspaceId)
        }
        if (platform) {
          trendsQuery = trendsQuery.eq('platform', platform)
        }

        const { data: trends, error: trendsError } = await trendsQuery
        if (trendsError) throw trendsError
        response.trends = trends
        break

      case 'summary':
        // Get all key metrics in one response for dashboard
        const [overviewRes, analyticsRes, activityRes, trendsRes] = await Promise.all([
          supabase
            .from('unified_message_overview')
            .select('*')
            .order('sent_at', { ascending: false })
            .limit(10)
            .then(res => res.data || []),
          
          supabase
            .from('response_analytics_dashboard')
            .select('*')
            .order('total_messages_sent', { ascending: false })
            .then(res => res.data || []),
          
          supabase
            .from('recent_activity_feed')
            .select('*')
            .order('activity_timestamp', { ascending: false })
            .limit(20)
            .then(res => res.data || []),
          
          supabase
            .from('daily_message_trends')
            .select('*')
            .order('message_date', { ascending: false })
            .limit(7)
            .then(res => res.data || [])
        ])

        response = {
          recent_messages: overviewRes,
          analytics_summary: analyticsRes,
          recent_activity: activityRes,
          weekly_trends: trendsRes
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid view parameter. Use: overview, analytics, activity, platform_comparison, conversations, trends, or summary'
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      view: view,
      data: response,
      filters: {
        workspace_id: workspaceId,
        platform: platform,
        days: days
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Message analytics API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint for generating custom analytics queries
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { query_type, filters = {}, date_range = {} } = body

    const {
      workspace_id,
      campaign_id,
      platform,
      status,
      sentiment
    } = filters

    const {
      start_date,
      end_date,
      days_back = 30
    } = date_range

    let response: any = {}

    switch (query_type) {
      case 'campaign_performance':
        // Get detailed campaign performance metrics
        let campaignQuery = supabase
          .from('campaign_performance_summary')
          .select('*')
          .order('reply_rate_percent', { ascending: false })

        if (workspace_id) {
          // Note: campaign_performance_summary view needs workspace_id added
          // For now, we'll use a different approach
          const { data: campaigns } = await supabase
            .from('campaigns')
            .select('id')
            .eq('workspace_id', workspace_id)
          
          const campaignIds = campaigns?.map(c => c.id) || []
          if (campaignIds.length > 0) {
            campaignQuery = campaignQuery.in('campaign_id', campaignIds)
          }
        }

        if (campaign_id) {
          campaignQuery = campaignQuery.eq('campaign_id', campaign_id)
        }

        const { data: campaignPerformance, error: campaignError } = await campaignQuery
        if (campaignError) throw campaignError
        response.campaign_performance = campaignPerformance
        break

      case 'response_analysis':
        // Detailed response analysis
        let responseQuery = supabase
          .from('campaign_replies')
          .select(`
            *,
            campaigns:campaign_id(name, campaign_type),
            campaign_messages:campaign_message_id(recipient_name, subject_line)
          `)
          .order('received_at', { ascending: false })
          .limit(100)

        if (workspace_id) {
          responseQuery = responseQuery.eq('workspace_id', workspace_id)
        }
        if (platform) {
          responseQuery = responseQuery.eq('platform', platform)
        }
        if (sentiment) {
          responseQuery = responseQuery.eq('reply_sentiment', sentiment)
        }
        if (start_date) {
          responseQuery = responseQuery.gte('received_at', start_date)
        }
        if (end_date) {
          responseQuery = responseQuery.lte('received_at', end_date)
        }

        const { data: responses, error: responseError } = await responseQuery
        if (responseError) throw responseError
        response.responses = responses
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid query_type. Use: campaign_performance, response_analysis'
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      query_type: query_type,
      data: response,
      filters: filters,
      date_range: date_range,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Custom analytics API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}