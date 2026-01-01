import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspace')
    const userId = searchParams.get('user')

    if (!workspaceId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: workspace, user' },
        { status: 400 }
      )
    }

    // Get or create quota record
    let { data: quota, error } = await supabase
      .from('data_scraping_quotas')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single()

    if (error && error.code === 'PGRST116') {
      // Quota doesn't exist, create it
      const newQuota = {
        user_id: userId,
        workspace_id: workspaceId,
        monthly_limit: 2000,
        current_usage: 0,
        reset_date: getNextMonthFirstDay(),
        overage_allowed: true,
        overage_cost_per_scrape: 0.05,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data: createdQuota, error: createError } = await supabase
        .from('data_scraping_quotas')
        .insert(newQuota)
        .select()
        .single()

      if (createError) {
        throw new Error(createError.message)
      }

      quota = createdQuota
    } else if (error) {
      throw new Error(error.message)
    }

    // Check if quota needs reset
    if (quota && new Date(quota.reset_date) <= new Date()) {
      const { error: resetError } = await supabase
        .from('data_scraping_quotas')
        .update({
          current_usage: 0,
          reset_date: getNextMonthFirstDay(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)

      if (!resetError) {
        quota.current_usage = 0
        quota.reset_date = getNextMonthFirstDay()
      }
    }

    // Get usage analytics
    const usageAnalytics = await getUsageAnalytics(userId, workspaceId)

    return NextResponse.json({
      success: true,
      quota,
      analytics: usageAnalytics,
      status: {
        percentage_used: quota ? (quota.current_usage / quota.monthly_limit) * 100 : 0,
        remaining: quota ? Math.max(0, quota.monthly_limit - quota.current_usage) : 2000,
        days_until_reset: quota ? Math.ceil((new Date(quota.reset_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0,
        overage_risk: quota ? quota.current_usage > quota.monthly_limit * 0.8 : false
      }
    })

  } catch (error) {
    console.error('Quota API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get quota' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      user_id,
      workspace_id,
      usage_delta,
      operation_type = 'enrichment',
      prospect_id
    } = body

    if (!user_id || !workspace_id || typeof usage_delta !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, workspace_id, usage_delta' },
        { status: 400 }
      )
    }

    // Get current quota
    const { data: quota, error: fetchError } = await supabase
      .from('data_scraping_quotas')
      .select('*')
      .eq('user_id', user_id)
      .eq('workspace_id', workspace_id)
      .single()

    if (fetchError) {
      throw new Error(fetchError.message)
    }

    // Check if update would exceed limit
    const newUsage = quota.current_usage + usage_delta
    if (newUsage > quota.monthly_limit && !quota.overage_allowed) {
      return NextResponse.json(
        { 
          error: 'Quota exceeded and overage not allowed',
          quota_status: quota,
          exceeded_by: newUsage - quota.monthly_limit
        },
        { status: 400 }
      )
    }

    // Update quota usage
    const { error: updateError } = await supabase
      .from('data_scraping_quotas')
      .update({
        current_usage: newUsage,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .eq('workspace_id', workspace_id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    // Log usage for analytics
    await supabase
      .from('quota_usage_logs')
      .insert({
        user_id,
        workspace_id,
        usage_delta,
        operation_type,
        prospect_id,
        timestamp: new Date().toISOString(),
        overage_charge: newUsage > quota.monthly_limit 
          ? (newUsage - quota.monthly_limit) * quota.overage_cost_per_scrape 
          : 0
      })

    return NextResponse.json({
      success: true,
      new_usage: newUsage,
      remaining: Math.max(0, quota.monthly_limit - newUsage),
      overage_amount: Math.max(0, newUsage - quota.monthly_limit),
      overage_cost: newUsage > quota.monthly_limit 
        ? Math.max(0, newUsage - quota.monthly_limit) * quota.overage_cost_per_scrape
        : 0
    })

  } catch (error) {
    console.error('Quota update API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update quota' },
      { status: 500 }
    )
  }
}

async function getUsageAnalytics(userId: string, workspaceId: string) {
  try {
    // Get usage over last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: usageLogs, error } = await supabase
      .from('quota_usage_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .gte('timestamp', thirtyDaysAgo)
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Usage analytics error:', error)
      return getEmptyAnalytics()
    }

    // Calculate daily usage
    const dailyUsage = usageLogs?.reduce((acc, log) => {
      const date = new Date(log.timestamp).toDateString()
      acc[date] = (acc[date] || 0) + log.usage_delta
      return acc
    }, {} as Record<string, number>) || {}

    // Calculate usage by operation type
    const usageByType = usageLogs?.reduce((acc, log) => {
      acc[log.operation_type] = (acc[log.operation_type] || 0) + log.usage_delta
      return acc
    }, {} as Record<string, number>) || {}

    // Calculate total overage charges
    const totalOverageCharges = usageLogs?.reduce((sum, log) => sum + (log.overage_charge || 0), 0) || 0

    const totalUsage = Object.values(dailyUsage).reduce((sum: number, usage) => sum + (usage as number), 0)
    const avgUsage = (totalUsage as number) / Math.max(Object.keys(dailyUsage).length, 1)
    
    const peakUsage = Object.entries(dailyUsage).reduce((max, [date, usage]) => {
      const numUsage = usage as number
      return numUsage > max.usage ? { date, usage: numUsage } : max
    }, { date: '', usage: 0 })

    return {
      daily_usage: dailyUsage,
      usage_by_type: usageByType,
      total_operations: usageLogs?.length || 0,
      total_overage_charges: totalOverageCharges,
      average_daily_usage: avgUsage,
      peak_usage_day: peakUsage
    }

  } catch (error) {
    console.error('Analytics calculation error:', error)
    return getEmptyAnalytics()
  }
}

function getEmptyAnalytics() {
  return {
    daily_usage: {},
    usage_by_type: {},
    total_operations: 0,
    total_overage_charges: 0,
    average_daily_usage: 0,
    peak_usage_day: { date: '', usage: 0 }
  }
}

function getNextMonthFirstDay(): string {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth.toISOString()
}