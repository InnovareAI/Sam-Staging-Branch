/**
 * SAM Template Feedback and Learning API
 * Records performance data and user feedback for continuous SAM AI learning
 * Updated Dec 31, 2025: Migrated to verifyAuth and pool.query
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

interface FeedbackRequest {
  action: 'record_performance' | 'get_insights' | 'update_learning';
  template_id?: string;
  campaign_id?: string;
  performance_data?: {
    response_rate?: number;
    open_rate?: number;
    click_rate?: number;
    conversion_rate?: number;
    sent_count?: number;
    reply_count?: number;
    positive_replies?: number;
    negative_replies?: number;
    meeting_requests?: number;
  };
  user_feedback?: {
    rating: number; // 1-5 stars
    feedback_text?: string;
    improvements_suggested?: string[];
    would_use_again?: boolean;
  };
  context?: {
    industry?: string;
    target_audience?: string;
    campaign_type?: string;
    message_position?: number; // 1st message, 2nd follow-up, etc.
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = auth.user;
    const {
      action,
      template_id,
      campaign_id,
      performance_data,
      user_feedback,
      context
    }: FeedbackRequest = await req.json();

    switch (action) {
      case 'record_performance':
        return await recordTemplatePerformance(user.uid, {
          template_id,
          campaign_id,
          performance_data,
          context
        });

      case 'get_insights':
        return await getPerformanceInsights(user.uid, template_id);

      case 'update_learning':
        return await updateSamLearning(user.uid, {
          template_id,
          user_feedback,
          performance_data,
          context
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Template feedback error:', error);
    return NextResponse.json(
      { error: 'Feedback operation failed', details: error.message },
      { status: 500 }
    );
  }
}

async function recordTemplatePerformance(userId: string, data: any) {
  const userRes = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );
  const workspaceId = userRes.rows[0]?.current_workspace_id;

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  // Record performance data
  const res = await pool.query(
    `INSERT INTO template_performance_tracking (
      workspace_id, template_id, campaign_id, user_id, 
      performance_data, context, recorded_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *`,
    [
      workspaceId,
      data.template_id,
      data.campaign_id,
      userId,
      JSON.stringify(data.performance_data || {}),
      JSON.stringify(data.context || {})
    ]
  );
  const result = res.rows[0];

  // Update template usage statistics using safe function
  if (data.template_id) {
    try {
      await pool.query('SELECT increment_template_usage($1)', [data.template_id]);
    } catch (error) {
      console.error('Template usage update failed:', error);
      // Non-critical error - continue
    }
  }

  // Generate immediate insights
  const insights = await generateRealTimeInsights(data);

  return NextResponse.json({
    success: true,
    performance_record: result,
    insights,
    sam_learning: {
      patterns_detected: insights.patterns,
      optimization_suggestions: insights.suggestions,
      confidence_level: insights.confidence
    }
  });
}

async function getPerformanceInsights(userId: string, templateId?: string) {
  const userRes = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );
  const workspaceId = userRes.rows[0]?.current_workspace_id;

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  // Build optimized query
  let queryText = `
    SELECT 
      tpt.id, tpt.template_id, tpt.performance_data, tpt.context, tpt.recorded_at,
      stl.name, stl.type, stl.industry, stl.campaign_type
    FROM template_performance_tracking tpt
    INNER JOIN sam_template_library stl ON tpt.template_id = stl.id
    WHERE tpt.workspace_id = $1
  `;
  const queryParams: any[] = [workspaceId];

  if (templateId) {
    // Validate templateId format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID format' }, { status: 400 });
    }
    queryParams.push(templateId);
    queryText += ` AND tpt.template_id = $${queryParams.length}`;
  }

  queryText += ` ORDER BY tpt.recorded_at DESC LIMIT 50`;

  const res = await pool.query(queryText, queryParams);
  const performanceData = res.rows;

  // Analyze performance patterns
  const insights = analyzePerformancePatterns(performanceData);

  return NextResponse.json({
    success: true,
    insights,
    performance_data: performanceData,
    sam_recommendations: generateSamRecommendations(insights)
  });
}

async function updateSamLearning(userId: string, data: any) {
  const userRes = await pool.query(
    'SELECT current_workspace_id FROM users WHERE id = $1',
    [userId]
  );
  const workspaceId = userRes.rows[0]?.current_workspace_id;

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
  }

  const confidenceScore = calculateLearningConfidence(data);

  const res = await pool.query(
    `INSERT INTO sam_learning_feedback (
      workspace_id, user_id, template_id, user_feedback, 
      performance_context, context, learning_timestamp, confidence_score
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
    RETURNING *`,
    [
      workspaceId,
      userId,
      data.template_id,
      JSON.stringify(data.user_feedback || {}),
      JSON.stringify(data.performance_data || {}),
      JSON.stringify(data.context || {}),
      confidenceScore
    ]
  );
  const result = res.rows[0];

  // Generate updated recommendations based on learning
  const updatedRecommendations = await generateUpdatedRecommendations(data);

  return NextResponse.json({
    success: true,
    learning_record: result,
    updated_recommendations: updatedRecommendations,
    sam_improvements: {
      patterns_learned: updatedRecommendations.patterns,
      template_optimizations: updatedRecommendations.optimizations,
      next_suggestions: updatedRecommendations.suggestions
    }
  });
}

async function generateRealTimeInsights(data: any) {
  const insights: any = {
    patterns: [],
    suggestions: [],
    confidence: 0.7
  };

  // Analyze response rate patterns
  if (data.performance_data?.response_rate) {
    const responseRate = data.performance_data.response_rate;

    if (responseRate > 0.25) {
      insights.patterns.push('High response rate template');
      insights.suggestions.push('This template format is performing well - consider using similar structure');
      insights.confidence += 0.1;
    } else if (responseRate < 0.10) {
      insights.patterns.push('Low response rate detected');
      insights.suggestions.push('Consider A/B testing variations or adjusting call-to-action');
      insights.confidence += 0.05;
    }
  }

  // Analyze context patterns
  if (data.context?.industry && data.context?.target_audience) {
    insights.patterns.push(`${data.context.industry} + ${data.context.target_audience} combination`);
    insights.suggestions.push('Industry-specific language may improve performance');
  }

  // Message position insights
  if (data.context?.message_position) {
    const position = data.context.message_position;
    if (position === 1) {
      insights.suggestions.push('First message performance affects entire sequence');
    } else if (position > 3) {
      insights.suggestions.push('Late-sequence messages may benefit from urgency elements');
    }
  }

  return insights;
}

function analyzePerformancePatterns(performanceData: any[]) {
  const insights: any = {
    overall_performance: {
      avg_response_rate: 0,
      avg_open_rate: 0,
      total_campaigns: performanceData.length,
      best_performing_types: [],
      worst_performing_types: []
    },
    patterns: {
      high_performers: [],
      low_performers: [],
      industry_insights: [],
      timing_insights: []
    },
    recommendations: []
  };

  if (performanceData.length === 0) {
    return insights;
  }

  // Calculate averages
  const totalResponseRate = performanceData.reduce((sum, record) =>
    sum + (record.performance_data?.response_rate || 0), 0);
  insights.overall_performance.avg_response_rate = totalResponseRate / performanceData.length;

  const totalOpenRate = performanceData.reduce((sum, record) =>
    sum + (record.performance_data?.open_rate || 0), 0);
  insights.overall_performance.avg_open_rate = totalOpenRate / performanceData.length;

  // Find patterns
  const highPerformers = performanceData.filter(record =>
    (record.performance_data?.response_rate || 0) > insights.overall_performance.avg_response_rate * 1.2);

  const lowPerformers = performanceData.filter(record =>
    (record.performance_data?.response_rate || 0) < insights.overall_performance.avg_response_rate * 0.8);

  insights.patterns.high_performers = highPerformers.map(hp => ({
    type: hp.type,
    industry: hp.context?.industry,
    response_rate: hp.performance_data?.response_rate
  }));

  insights.patterns.low_performers = lowPerformers.map(lp => ({
    type: lp.type,
    industry: lp.context?.industry,
    response_rate: lp.performance_data?.response_rate
  }));

  // Generate recommendations
  if (highPerformers.length > 0) {
    insights.recommendations.push('Consider replicating successful patterns from high-performing templates');
  }

  if (lowPerformers.length > performanceData.length * 0.3) {
    insights.recommendations.push('Consider revising template strategy - significant performance issues detected');
  }

  return insights;
}

function generateSamRecommendations(insights: any) {
  const recommendations: any = {
    immediate_actions: [],
    strategic_changes: [],
    template_optimizations: [],
    learning_opportunities: []
  };

  // Immediate actions based on performance
  if (insights.overall_performance.avg_response_rate < 0.15) {
    recommendations.immediate_actions.push('Response rates below average - consider A/B testing subject lines and opening messages');
  }

  if (insights.patterns.high_performers.length > 0) {
    recommendations.immediate_actions.push('Replicate successful elements from high-performing templates');
  }

  // Strategic changes
  if (insights.patterns.industry_insights.length > 0) {
    recommendations.strategic_changes.push('Develop industry-specific template variations');
  }

  // Template optimizations
  recommendations.template_optimizations.push('Focus on personalization variables that correlate with higher response rates');
  recommendations.template_optimizations.push('Optimize call-to-action placement and language');

  // Learning opportunities
  recommendations.learning_opportunities.push('Track performance across different industries and roles');
  recommendations.learning_opportunities.push('Experiment with message timing and sequence length');

  return recommendations;
}

async function generateUpdatedRecommendations(data: any) {
  // This would analyze historical learning data and generate new recommendations
  const recommendations: any = {
    patterns: [],
    optimizations: [],
    suggestions: []
  };

  // Based on user feedback
  if (data.user_feedback?.rating >= 4) {
    recommendations.patterns.push('Positive user feedback pattern detected');
    recommendations.optimizations.push('Amplify successful template elements');
  } else if (data.user_feedback?.rating <= 2) {
    recommendations.patterns.push('User dissatisfaction pattern detected');
    recommendations.optimizations.push('Review template structure and messaging approach');
  }

  // Context-based suggestions
  if (data.context?.industry) {
    recommendations.suggestions.push(`Industry-specific optimization for ${data.context.industry}`);
  }

  return recommendations;
}

function calculateLearningConfidence(data: any): number {
  let confidence = 0.5; // Base confidence

  // Performance data quality
  if (data.performance_data?.sent_count && data.performance_data.sent_count > 50) {
    confidence += 0.2; // More data = higher confidence
  }

  // User feedback quality
  if (data.user_feedback?.feedback_text && data.user_feedback.feedback_text.length > 20) {
    confidence += 0.1; // Detailed feedback
  }

  // Context completeness
  if (data.context?.industry && data.context?.target_audience) {
    confidence += 0.1; // Complete context
  }

  return Math.min(1.0, confidence);
}