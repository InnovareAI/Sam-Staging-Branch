import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Authenticate with Firebase
    await verifyAuth(request)

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'overview'
    const workspaceId = searchParams.get('workspace_id')
    const platform = searchParams.get('platform')
    const days = parseInt(searchParams.get('days') || '30')

    let response: any = {}

    switch (view) {
      case 'overview': {
        // Unified message overview with optional filtering
        let query = 'SELECT * FROM unified_message_overview WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (workspaceId) {
          query += ` AND workspace_id = $${paramIndex++}`
          params.push(workspaceId)
        }
        if (platform) {
          query += ` AND platform = $${paramIndex++}`
          params.push(platform)
        }
        if (days > 0) {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - days)
          query += ` AND sent_at >= $${paramIndex++}`
          params.push(cutoffDate.toISOString())
        }
        query += ' ORDER BY sent_at DESC LIMIT 100'

        const { rows } = await pool.query(query, params)
        response.overview = rows
        break
      }

      case 'analytics': {
        // Response analytics dashboard
        let query = 'SELECT * FROM response_analytics_dashboard WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (workspaceId) {
          query += ` AND workspace_id = $${paramIndex++}`
          params.push(workspaceId)
        }
        if (platform) {
          query += ` AND platform = $${paramIndex++}`
          params.push(platform)
        }
        query += ' ORDER BY total_messages_sent DESC'

        const { rows } = await pool.query(query, params)
        response.analytics = rows
        break
      }

      case 'activity': {
        // Recent activity feed
        let query = 'SELECT * FROM recent_activity_feed WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (workspaceId) {
          query += ` AND workspace_id = $${paramIndex++}`
          params.push(workspaceId)
        }
        if (platform) {
          query += ` AND platform = $${paramIndex++}`
          params.push(platform)
        }
        if (days > 0) {
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - days)
          query += ` AND activity_timestamp >= $${paramIndex++}`
          params.push(cutoffDate.toISOString())
        }
        query += ' ORDER BY activity_timestamp DESC LIMIT 50'

        const { rows } = await pool.query(query, params)
        response.activity = rows
        break
      }

      case 'platform_comparison': {
        // Platform performance comparison
        const { rows } = await pool.query(
          'SELECT * FROM platform_performance_comparison ORDER BY total_messages DESC'
        )
        response.platform_comparison = rows
        break
      }

      case 'conversations': {
        // Conversation threads
        let query = 'SELECT * FROM conversation_threads WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (workspaceId) {
          query += ` AND workspace_id = $${paramIndex++}`
          params.push(workspaceId)
        }
        if (platform) {
          query += ` AND platform = $${paramIndex++}`
          params.push(platform)
        }
        query += ' ORDER BY last_activity_at DESC LIMIT 100'

        const { rows } = await pool.query(query, params)
        response.conversations = rows
        break
      }

      case 'trends': {
        // Daily message trends
        let query = 'SELECT * FROM daily_message_trends WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (workspaceId) {
          query += ` AND workspace_id = $${paramIndex++}`
          params.push(workspaceId)
        }
        if (platform) {
          query += ` AND platform = $${paramIndex++}`
          params.push(platform)
        }
        query += ` ORDER BY message_date DESC LIMIT $${paramIndex++}`
        params.push(days > 0 ? days : 30)

        const { rows } = await pool.query(query, params)
        response.trends = rows
        break
      }

      case 'summary': {
        // Get all key metrics in one response for dashboard
        const [overviewRes, analyticsRes, activityRes, trendsRes] = await Promise.all([
          pool.query('SELECT * FROM unified_message_overview ORDER BY sent_at DESC LIMIT 10'),
          pool.query('SELECT * FROM response_analytics_dashboard ORDER BY total_messages_sent DESC'),
          pool.query('SELECT * FROM recent_activity_feed ORDER BY activity_timestamp DESC LIMIT 20'),
          pool.query('SELECT * FROM daily_message_trends ORDER BY message_date DESC LIMIT 7')
        ])

        response = {
          recent_messages: overviewRes.rows,
          analytics_summary: analyticsRes.rows,
          recent_activity: activityRes.rows,
          weekly_trends: trendsRes.rows
        }
        break
      }

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
    // Authenticate with Firebase
    await verifyAuth(request)

    const body = await request.json()
    const { query_type, filters = {}, date_range = {} } = body

    const {
      workspace_id,
      campaign_id,
      platform,
      sentiment
    } = filters

    const {
      start_date,
      end_date
    } = date_range

    let response: any = {}

    switch (query_type) {
      case 'campaign_performance': {
        // Get detailed campaign performance metrics
        let query = 'SELECT * FROM campaign_performance_summary WHERE 1=1'
        const params: any[] = []
        let paramIndex = 1

        if (workspace_id) {
          // Get campaign IDs for this workspace first
          const { rows: campaigns } = await pool.query(
            'SELECT id FROM campaigns WHERE workspace_id = $1',
            [workspace_id]
          )
          const campaignIds = campaigns.map(c => c.id)
          if (campaignIds.length > 0) {
            query += ` AND campaign_id = ANY($${paramIndex++})`
            params.push(campaignIds)
          }
        }

        if (campaign_id) {
          query += ` AND campaign_id = $${paramIndex++}`
          params.push(campaign_id)
        }
        query += ' ORDER BY reply_rate_percent DESC'

        const { rows } = await pool.query(query, params)
        response.campaign_performance = rows
        break
      }

      case 'response_analysis': {
        // Detailed response analysis with joins
        let query = `
          SELECT cr.*,
            c.name as campaign_name, c.campaign_type,
            cm.recipient_name, cm.subject_line
          FROM campaign_replies cr
          LEFT JOIN campaigns c ON cr.campaign_id = c.id
          LEFT JOIN campaign_messages cm ON cr.campaign_message_id = cm.id
          WHERE 1=1
        `
        const params: any[] = []
        let paramIndex = 1

        if (workspace_id) {
          query += ` AND cr.workspace_id = $${paramIndex++}`
          params.push(workspace_id)
        }
        if (platform) {
          query += ` AND cr.platform = $${paramIndex++}`
          params.push(platform)
        }
        if (sentiment) {
          query += ` AND cr.reply_sentiment = $${paramIndex++}`
          params.push(sentiment)
        }
        if (start_date) {
          query += ` AND cr.received_at >= $${paramIndex++}`
          params.push(start_date)
        }
        if (end_date) {
          query += ` AND cr.received_at <= $${paramIndex++}`
          params.push(end_date)
        }
        query += ' ORDER BY cr.received_at DESC LIMIT 100'

        const { rows } = await pool.query(query, params)
        response.responses = rows
        break
      }

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