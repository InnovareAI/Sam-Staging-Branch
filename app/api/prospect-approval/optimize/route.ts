import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, workspace_id, prospects_data, optimization_mode = 'filter' } = body

    if (!user_id || !workspace_id || !prospects_data) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: user_id, workspace_id, prospects_data'
      }, { status: 400 })
    }

    // Get the user's learning model
    const { data: learningModel, error: modelError } = await supabase
      .from('sam_learning_models')
      .select('*')
      .eq('user_id', user_id)
      .eq('workspace_id', workspace_id)
      .eq('model_type', 'prospect_approval')
      .single()

    if (modelError || !learningModel) {
      // No learning model exists - return unfiltered data with message
      return NextResponse.json({
        success: true,
        optimized_prospects: prospects_data,
        optimization_applied: false,
        message: 'No learning model available. Complete at least one approval session to enable optimization.',
        stats: {
          input_count: prospects_data.length,
          output_count: prospects_data.length,
          filtered_out: 0
        }
      })
    }

    // Apply optimization based on learned preferences
    const optimizedProspects = await optimizeProspectsWithModel(prospects_data, learningModel, optimization_mode)

    // Generate optimization insights
    const insights = generateOptimizationInsights(prospects_data, optimizedProspects, learningModel)

    return NextResponse.json({
      success: true,
      optimized_prospects: optimizedProspects,
      optimization_applied: true,
      optimization_mode,
      model_accuracy: learningModel.accuracy_score,
      insights,
      stats: {
        input_count: prospects_data.length,
        output_count: optimizedProspects.length,
        filtered_out: prospects_data.length - optimizedProspects.length,
        improvement_score: calculateImprovementScore(insights)
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Prospect optimization error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function optimizeProspectsWithModel(prospects: any[], learningModel: any, mode: string) {
  const weights = learningModel.feature_weights
  const preferences = learningModel.learned_preferences.preferences

  if (!weights || !preferences) {
    return prospects // Return original if no valid model data
  }

  // Score each prospect based on learned preferences
  const scoredProspects = prospects.map(prospect => ({
    ...prospect,
    sam_ai_score: calculateProspectScore(prospect, weights),
    optimization_factors: getOptimizationFactors(prospect, preferences)
  }))

  switch (mode) {
    case 'filter':
      // Filter prospects based on minimum score threshold
      const threshold = Math.max(0.3, learningModel.accuracy_score * 0.7)
      return scoredProspects
        .filter(p => p.sam_ai_score >= threshold)
        .sort((a, b) => b.sam_ai_score - a.sam_ai_score)

    case 'rank':
      // Return all prospects but ranked by score
      return scoredProspects.sort((a, b) => b.sam_ai_score - a.sam_ai_score)

    case 'balanced':
      // Keep top performers + some diversity
      const topThreshold = 0.7
      const mediumThreshold = 0.4
      
      const topProspects = scoredProspects.filter(p => p.sam_ai_score >= topThreshold)
      const mediumProspects = scoredProspects.filter(p => p.sam_ai_score >= mediumThreshold && p.sam_ai_score < topThreshold)
      
      // Take all top prospects + 30% of medium prospects for diversity
      const mediumSample = mediumProspects
        .sort(() => Math.random() - 0.5) // Shuffle
        .slice(0, Math.ceil(mediumProspects.length * 0.3))
      
      return [...topProspects, ...mediumSample]
        .sort((a, b) => b.sam_ai_score - a.sam_ai_score)

    default:
      return scoredProspects.sort((a, b) => b.sam_ai_score - a.sam_ai_score)
  }
}

function calculateProspectScore(prospect: any, weights: any): number {
  let score = 0
  let factors = 0

  // Company size factor
  if (prospect.company?.size && weights.company_size?.[prospect.company.size]) {
    score += weights.company_size[prospect.company.size]
    factors++
  }

  // Industry factor  
  if (prospect.company?.industry && weights.industry?.[prospect.company.industry]) {
    score += weights.industry[prospect.company.industry]
    factors++
  }

  // Connection degree factor
  if (prospect.connection_degree !== null && weights.connection_degree?.[prospect.connection_degree]) {
    score += weights.connection_degree[prospect.connection_degree]
    factors++
  }

  // Enrichment score factor
  if (prospect.enrichment_score !== null && prospect.enrichment_score >= weights.enrichment_score_threshold) {
    score += 0.8
    factors++
  }

  // Contact requirements
  if (prospect.contact?.email && weights.contact_requirements?.email_weight) {
    score += weights.contact_requirements.email_weight
    factors++
  }

  if (prospect.contact?.phone && weights.contact_requirements?.phone_weight) {
    score += weights.contact_requirements.phone_weight
    factors++
  }

  // Title keywords
  if (prospect.title && weights.title_keywords) {
    const words = prospect.title.toLowerCase().split(/\s+/)
    let titleScore = 0
    let titleFactors = 0

    words.forEach(word => {
      if (weights.title_keywords[word]) {
        titleScore += weights.title_keywords[word]
        titleFactors++
      }
    })

    if (titleFactors > 0) {
      score += titleScore / titleFactors
      factors++
    }
  }

  return factors > 0 ? score / factors : 0.5
}

function getOptimizationFactors(prospect: any, preferences: any) {
  const factors = {
    preferred_company_size: preferences.preferred_company_sizes?.includes(prospect.company?.size),
    preferred_industry: preferences.preferred_industries?.includes(prospect.company?.industry),
    preferred_connection_degree: preferences.preferred_connection_degrees?.includes(prospect.connection_degree),
    meets_email_requirement: preferences.requires_email ? !!prospect.contact?.email : true,
    meets_phone_preference: preferences.prefers_phone ? !!prospect.contact?.phone : true,
    meets_score_threshold: prospect.enrichment_score >= (preferences.min_enrichment_score || 0)
  }

  return factors
}

function generateOptimizationInsights(originalProspects: any[], optimizedProspects: any[], learningModel: any) {
  const preferences = learningModel.learned_preferences.preferences
  
  const insights = {
    model_confidence: learningModel.accuracy_score,
    sessions_trained_on: learningModel.sessions_trained_on,
    filtering_effectiveness: {
      original_count: originalProspects.length,
      optimized_count: optimizedProspects.length,
      filtering_rate: ((originalProspects.length - optimizedProspects.length) / originalProspects.length) * 100
    },
    quality_improvements: {
      avg_score_before: calculateAverageScore(originalProspects),
      avg_score_after: calculateAverageScore(optimizedProspects),
      email_coverage: optimizedProspects.filter(p => p.contact?.email).length / optimizedProspects.length,
      phone_coverage: optimizedProspects.filter(p => p.contact?.phone).length / optimizedProspects.length
    },
    applied_preferences: {
      preferred_company_sizes: preferences.preferred_company_sizes || [],
      preferred_industries: preferences.preferred_industries || [],
      email_requirement: preferences.requires_email || false,
      phone_preference: preferences.prefers_phone || false,
      min_score_threshold: preferences.min_enrichment_score || 0
    },
    recommendations: generateOptimizationRecommendations(optimizedProspects, preferences)
  }

  return insights
}

function calculateAverageScore(prospects: any[]): number {
  if (prospects.length === 0) return 0
  
  const scores = prospects
    .map(p => p.sam_ai_score || p.enrichment_score || 0)
    .filter(score => score > 0)
    
  return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
}

function generateOptimizationRecommendations(prospects: any[], preferences: any): string[] {
  const recommendations = []

  // Check email coverage
  const emailCoverage = prospects.filter(p => p.contact?.email).length / prospects.length
  if (emailCoverage < 0.5) {
    recommendations.push('Consider requiring email addresses to improve contact success rates')
  }

  // Check connection degree distribution
  const connectionDegrees = prospects.map(p => p.connection_degree).filter(d => d !== null)
  const avgConnectionDegree = connectionDegrees.reduce((sum, degree) => sum + degree, 0) / connectionDegrees.length
  
  if (avgConnectionDegree > 2) {
    recommendations.push('Focus on closer connections (1st and 2nd degree) for better response rates')
  }

  // Check industry diversity
  const industries = [...new Set(prospects.map(p => p.company?.industry).filter(Boolean))]
  if (industries.length > 10) {
    recommendations.push('Consider narrowing industry focus based on your highest approval rates')
  }

  // Check company size distribution
  const companySizes = [...new Set(prospects.map(p => p.company?.size).filter(Boolean))]
  if (companySizes.length > 5) {
    recommendations.push('Focus on company sizes that have shown higher approval rates in past sessions')
  }

  if (recommendations.length === 0) {
    recommendations.push('Prospect quality looks good based on your historical preferences')
  }

  return recommendations
}

function calculateImprovementScore(insights: any): number {
  let score = 0
  
  // Score improvement based on average quality increase
  const qualityImprovement = insights.quality_improvements.avg_score_after - insights.quality_improvements.avg_score_before
  score += qualityImprovement * 100
  
  // Bonus for good email coverage
  if (insights.quality_improvements.email_coverage > 0.7) {
    score += 20
  }
  
  // Bonus for model confidence
  score += insights.model_confidence * 30
  
  return Math.max(0, Math.min(100, score))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id') || 'default-user'
    const workspaceId = searchParams.get('workspace_id') || 'default-workspace'

    // Get optimization statistics
    const { data: model } = await supabase
      .from('sam_learning_models')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspace_id)
      .eq('model_type', 'prospect_approval')
      .single()

    const optimizationStats = {
      has_learning_model: !!model,
      model_accuracy: model?.accuracy_score || 0,
      sessions_trained: model?.sessions_trained_on || 0,
      last_updated: model?.updated_at || null,
      learned_preferences: model?.learned_preferences || {},
      available_modes: ['filter', 'rank', 'balanced'],
      recommendation: !model ? 
        'Complete at least one approval session to enable prospect optimization' :
        model.accuracy_score > 0.7 ? 
          'Model is highly accurate - optimization will significantly improve prospect quality' :
          'Model is still learning - optimization will provide moderate improvements'
    }

    return NextResponse.json({
      success: true,
      optimization_stats: optimizationStats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Optimization stats error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}