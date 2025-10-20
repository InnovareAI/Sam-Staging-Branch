import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    // Fetch all learned insights from global KB
    const { data: insights, error } = await supabaseAdmin
      .from('knowledge_base')
      .select('*')
      .eq('category', 'sam-learned-intelligence')
      .is('workspace_id', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate aggregated metrics
    const totalInsights = insights?.length || 0;
    
    const confidenceDistribution = {
      high: insights?.filter(i => (i.source_metadata?.confidence_score || 0) >= 0.75).length || 0,
      medium: insights?.filter(i => {
        const score = i.source_metadata?.confidence_score || 0;
        return score >= 0.65 && score < 0.75;
      }).length || 0,
      low: insights?.filter(i => (i.source_metadata?.confidence_score || 0) < 0.65).length || 0
    };

    // Group by insight type
    const byType: Record<string, number> = {};
    insights?.forEach(i => {
      const type = i.subcategory || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    // Group by industry
    const byIndustry: Record<string, number> = {};
    insights?.forEach(i => {
      const tags = i.tags || [];
      // Find industry tags (excluding meta tags like 'sam_learned', 'cross_workspace')
      const industryTags = tags.filter((t: string) => 
        !['sam_learned', 'cross_workspace', 'validated'].includes(t)
      );
      industryTags.forEach((industry: string) => {
        byIndustry[industry] = (byIndustry[industry] || 0) + 1;
      });
    });

    // Calculate validation metrics
    const totalValidations = insights?.reduce((sum, i) => 
      sum + (i.source_metadata?.validation_count || 0), 0
    ) || 0;

    const avgValidationsPerInsight = totalInsights > 0 
      ? (totalValidations / totalInsights).toFixed(1)
      : '0';

    const totalWorkspacesContributed = new Set(
      insights?.map(i => i.source_metadata?.originating_workspace).filter(Boolean)
    ).size;

    const crossIndustryInsights = insights?.filter(i => 
      i.source_metadata?.cross_industry_applicable === true
    ).length || 0;

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentInsights = insights?.filter(i => 
      new Date(i.created_at) >= sevenDaysAgo
    ).length || 0;

    const recentValidations = insights?.filter(i => 
      new Date(i.source_metadata?.last_validated || i.updated_at) >= sevenDaysAgo
    ).length || 0;

    // Top insights (highest confidence + validation count)
    const topInsights = insights
      ?.map(i => ({
        id: i.id,
        type: i.subcategory,
        content: i.content,
        confidence: i.source_metadata?.confidence_score || 0,
        validations: i.source_metadata?.validation_count || 0,
        workspaces: i.source_metadata?.source_workspaces_count || 0,
        industry: i.tags?.find((t: string) => !['sam_learned', 'cross_workspace', 'validated'].includes(t)) || 'unknown',
        crossIndustry: i.source_metadata?.cross_industry_applicable || false,
        created: i.created_at,
        lastValidated: i.source_metadata?.last_validated || i.updated_at
      }))
      .sort((a, b) => {
        // Sort by confidence * validations (quality score)
        const scoreA = a.confidence * a.validations;
        const scoreB = b.confidence * b.validations;
        return scoreB - scoreA;
      })
      .slice(0, 20) || [];

    return NextResponse.json({
      success: true,
      summary: {
        totalInsights,
        confidenceDistribution,
        totalValidations,
        avgValidationsPerInsight: parseFloat(avgValidationsPerInsight),
        totalWorkspacesContributed,
        crossIndustryInsights,
        recentInsights,
        recentValidations
      },
      distributions: {
        byType,
        byIndustry
      },
      topInsights,
      allInsights: insights || []
    });

  } catch (error) {
    console.error('Learning insights fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch learning insights'
      },
      { status: 500 }
    );
  }
}
