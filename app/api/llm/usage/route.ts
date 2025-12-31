/**
 * LLM Usage Tracking API
 * GET: Fetch user's LLM usage statistics and costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import { getModelById } from '@/lib/llm/approved-models';

export async function GET(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId } = await verifyAuth(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || '30d'; // '24h', '7d', '30d', '90d', 'all'

    // Calculate time range
    let startDate = new Date();
    switch (timeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Fetch usage records
    const { rows: usageRecords } = await pool.query(
      `SELECT * FROM customer_llm_usage
       WHERE user_id = $1 AND created_at >= $2
       ORDER BY created_at DESC`,
      [userId, startDate.toISOString()]
    );

    // Calculate statistics
    const stats = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      byModel: {} as Record<string, {
        requests: number;
        tokens: number;
        cost: number;
        avgLatency: number;
      }>,
      byDay: [] as Array<{
        date: string;
        requests: number;
        tokens: number;
        cost: number;
      }>,
      errorRate: 0
    };

    const dailyStats: Record<string, { requests: number; tokens: number; cost: number }> = {};
    let errorCount = 0;

    usageRecords?.forEach(record => {
      // Overall stats
      stats.totalRequests++;
      stats.totalTokens += (record.prompt_tokens || 0) + (record.completion_tokens || 0);
      stats.totalCost += record.cost_usd || 0;

      if (record.event_type === 'error') {
        errorCount++;
      }

      // By model
      const modelId = record.model_used || 'unknown';
      if (!stats.byModel[modelId]) {
        stats.byModel[modelId] = {
          requests: 0,
          tokens: 0,
          cost: 0,
          avgLatency: 0
        };
      }
      stats.byModel[modelId].requests++;
      stats.byModel[modelId].tokens += (record.prompt_tokens || 0) + (record.completion_tokens || 0);
      stats.byModel[modelId].cost += record.cost_usd || 0;
      stats.byModel[modelId].avgLatency += record.latency_ms || 0;

      // By day
      const date = new Date(record.created_at).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { requests: 0, tokens: 0, cost: 0 };
      }
      dailyStats[date].requests++;
      dailyStats[date].tokens += (record.prompt_tokens || 0) + (record.completion_tokens || 0);
      dailyStats[date].cost += record.cost_usd || 0;
    });

    // Calculate average latency per model
    Object.keys(stats.byModel).forEach(modelId => {
      if (stats.byModel[modelId].requests > 0) {
        stats.byModel[modelId].avgLatency = stats.byModel[modelId].avgLatency / stats.byModel[modelId].requests;
      }
    });

    // Convert daily stats to array
    stats.byDay = Object.entries(dailyStats)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate error rate
    stats.errorRate = stats.totalRequests > 0 
      ? (errorCount / stats.totalRequests) * 100 
      : 0;

    // Enrich model info
    const enrichedByModel = Object.entries(stats.byModel).map(([modelId, data]) => {
      const modelInfo = getModelById(modelId);
      return {
        modelId,
        modelName: modelInfo?.name || modelId,
        provider: modelInfo?.provider || 'unknown',
        ...data
      };
    });

    // Get current preferences
    const { rows: prefsRows } = await pool.query(
      'SELECT selected_model, use_own_openrouter_key, use_custom_endpoint FROM customer_llm_preferences WHERE user_id = $1',
      [userId]
    );
    const prefs = prefsRows[0];

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        byModel: enrichedByModel
      },
      preferences: {
        currentModel: prefs?.selected_model || 'anthropic/claude-sonnet-4.5',
        isBYOK: prefs?.use_own_openrouter_key || false,
        isCustom: prefs?.use_custom_endpoint || false
      },
      timeRange,
      recordCount: usageRecords?.length || 0
    });
  } catch (error) {
    console.error('LLM usage API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
