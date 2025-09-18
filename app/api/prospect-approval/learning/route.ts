import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface LearningModelWeights {
  company_size: Record<string, number>
  industry: Record<string, number>
  connection_degree: Record<number, number>
  enrichment_score_threshold: number
  contact_requirements: {
    email_weight: number
    phone_weight: number
  }
  title_keywords: Record<string, number>
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const workspaceId = searchParams.get('workspace_id')
    
    if (!userId || !workspaceId) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_id and workspace_id are required' 
      }, { status: 400 });
    }

    // Get current learning model
    const { data: model, error } = await supabase
      .from('sam_learning_models')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('model_type', 'prospect_approval')
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return NextResponse.json({
      success: true,
      model: model || null,
      has_model: !!model,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Learning model fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, workspace_id, trigger_training = false } = body

    if (!user_id || !workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'user_id and workspace_id required'
      }, { status: 400 })
    }

    // Get all completed sessions for this user
    const { data: sessions, error: sessionsError } = await supabase
      .from('prospect_approval_sessions')
      .select('id, batch_number, learning_insights')
      .eq('user_id', user_id)
      .eq('workspace_id', workspace_id)
      .eq('status', 'completed')
      .order('batch_number', { ascending: true })

    if (sessionsError) throw sessionsError

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No completed approval sessions found for training'
      }, { status: 400 })
    }

    // Get all learning logs for analysis
    const sessionIds = sessions.map(s => s.id)
    const { data: learningLogs, error: logsError } = await supabase
      .from('prospect_learning_logs')
      .select('*')
      .in('session_id', sessionIds)

    if (logsError) throw logsError

    if (!learningLogs || learningLogs.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No learning data available for training'
      }, { status: 400 })
    }

    // Train the model
    const modelWeights = await trainLearningModel(learningLogs)
    const modelAccuracy = await calculateModelAccuracy(learningLogs, modelWeights)

    // Create or update learning model
    const { data: existingModel } = await supabase
      .from('sam_learning_models')
      .select('id')
      .eq('user_id', user_id)
      .eq('workspace_id', workspace_id)
      .eq('model_type', 'prospect_approval')
      .single()

    const modelData = {
      user_id,
      workspace_id,
      model_type: 'prospect_approval',
      model_version: (existingModel ? 1 : 1), // Increment version in real implementation
      learned_preferences: await generateLearnedPreferences(learningLogs),
      feature_weights: modelWeights,
      accuracy_score: modelAccuracy,
      sessions_trained_on: sessions.length,
      last_training_session: sessions[sessions.length - 1].id,
      updated_at: new Date().toISOString()
    }

    let savedModel
    if (existingModel) {
      const { data, error } = await supabase
        .from('sam_learning_models')
        .update(modelData)
        .eq('id', existingModel.id)
        .select()
        .single()
      
      if (error) throw error
      savedModel = data
    } else {
      const { data, error } = await supabase
        .from('sam_learning_models')
        .insert(modelData)
        .select()
        .single()
      
      if (error) throw error
      savedModel = data
    }

    return NextResponse.json({
      success: true,
      model: savedModel,
      training_data: {
        sessions_used: sessions.length,
        decisions_analyzed: learningLogs.length,
        accuracy_score: modelAccuracy
      },
      message: `SAM AI learning model ${existingModel ? 'updated' : 'created'} successfully`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Learning model training error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function trainLearningModel(learningLogs: any[]): Promise<LearningModelWeights> {
  const approved = learningLogs.filter(log => log.decision === 'approved')
  const rejected = learningLogs.filter(log => log.decision === 'rejected')

  // Calculate weights based on approval/rejection patterns
  const weights: LearningModelWeights = {
    company_size: {},
    industry: {},
    connection_degree: {},
    enrichment_score_threshold: 0,
    contact_requirements: {
      email_weight: 0,
      phone_weight: 0
    },
    title_keywords: {}
  }

  // Company size preferences
  const companySizeCounts = { approved: {}, rejected: {} }
  
  approved.forEach(log => {
    if (log.company_size) {
      companySizeCounts.approved[log.company_size] = (companySizeCounts.approved[log.company_size] || 0) + 1
    }
  })
  
  rejected.forEach(log => {
    if (log.company_size) {
      companySizeCounts.rejected[log.company_size] = (companySizeCounts.rejected[log.company_size] || 0) + 1
    }
  })

  // Calculate company size weights (approval rate)
  Object.keys(companySizeCounts.approved).forEach(size => {
    const approvedCount = companySizeCounts.approved[size] || 0
    const rejectedCount = companySizeCounts.rejected[size] || 0
    const totalCount = approvedCount + rejectedCount
    
    if (totalCount > 0) {
      weights.company_size[size] = approvedCount / totalCount
    }
  })

  // Industry preferences  
  const industryCounts = { approved: {}, rejected: {} }
  
  approved.forEach(log => {
    if (log.company_industry) {
      industryCounts.approved[log.company_industry] = (industryCounts.approved[log.company_industry] || 0) + 1
    }
  })
  
  rejected.forEach(log => {
    if (log.company_industry) {
      industryCounts.rejected[log.company_industry] = (industryCounts.rejected[log.company_industry] || 0) + 1
    }
  })

  Object.keys(industryCounts.approved).forEach(industry => {
    const approvedCount = industryCounts.approved[industry] || 0
    const rejectedCount = industryCounts.rejected[industry] || 0
    const totalCount = approvedCount + rejectedCount
    
    if (totalCount > 0) {
      weights.industry[industry] = approvedCount / totalCount
    }
  })

  // Connection degree preferences
  const connectionCounts = { approved: {}, rejected: {} }
  
  approved.forEach(log => {
    if (log.connection_degree !== null) {
      connectionCounts.approved[log.connection_degree] = (connectionCounts.approved[log.connection_degree] || 0) + 1
    }
  })
  
  rejected.forEach(log => {
    if (log.connection_degree !== null) {
      connectionCounts.rejected[log.connection_degree] = (connectionCounts.rejected[log.connection_degree] || 0) + 1
    }
  })

  Object.keys(connectionCounts.approved).forEach(degree => {
    const approvedCount = connectionCounts.approved[degree] || 0
    const rejectedCount = connectionCounts.rejected[degree] || 0
    const totalCount = approvedCount + rejectedCount
    
    if (totalCount > 0) {
      weights.connection_degree[parseInt(degree)] = approvedCount / totalCount
    }
  })

  // Enrichment score threshold
  const approvedScores = approved.map(log => log.enrichment_score).filter(score => score !== null)
  if (approvedScores.length > 0) {
    weights.enrichment_score_threshold = Math.min(...approvedScores)
  }

  // Contact requirements
  const approvedWithEmail = approved.filter(log => log.has_email).length
  const approvedWithPhone = approved.filter(log => log.has_phone).length
  
  weights.contact_requirements.email_weight = approved.length > 0 ? approvedWithEmail / approved.length : 0
  weights.contact_requirements.phone_weight = approved.length > 0 ? approvedWithPhone / approved.length : 0

  // Title keyword analysis
  const titleWords = {}
  approved.forEach(log => {
    if (log.prospect_title) {
      const words = log.prospect_title.toLowerCase().split(/\s+/)
      words.forEach(word => {
        if (word.length > 2) { // Skip short words
          titleWords[word] = (titleWords[word] || 0) + 1
        }
      })
    }
  })

  // Top keywords
  const sortedKeywords = Object.entries(titleWords)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 10)

  sortedKeywords.forEach(([keyword, count]) => {
    weights.title_keywords[keyword] = (count as number) / approved.length
  })

  return weights
}

async function calculateModelAccuracy(learningLogs: any[], weights: LearningModelWeights): Promise<number> {
  if (learningLogs.length === 0) return 0

  let correctPredictions = 0

  learningLogs.forEach(log => {
    const predictedScore = calculateProspectScore(log, weights)
    const threshold = 0.5 // Threshold for approval
    const predictedDecision = predictedScore >= threshold ? 'approved' : 'rejected'
    
    if (predictedDecision === log.decision) {
      correctPredictions++
    }
  })

  return correctPredictions / learningLogs.length
}

function calculateProspectScore(prospect: any, weights: LearningModelWeights): number {
  let score = 0
  let factors = 0

  // Company size factor
  if (prospect.company_size && weights.company_size[prospect.company_size]) {
    score += weights.company_size[prospect.company_size]
    factors++
  }

  // Industry factor
  if (prospect.company_industry && weights.industry[prospect.company_industry]) {
    score += weights.industry[prospect.company_industry]
    factors++
  }

  // Connection degree factor
  if (prospect.connection_degree !== null && weights.connection_degree[prospect.connection_degree]) {
    score += weights.connection_degree[prospect.connection_degree]
    factors++
  }

  // Enrichment score factor
  if (prospect.enrichment_score !== null && prospect.enrichment_score >= weights.enrichment_score_threshold) {
    score += 0.8 // High score for meeting threshold
    factors++
  }

  // Contact requirements
  if (prospect.has_email) {
    score += weights.contact_requirements.email_weight
    factors++
  }
  
  if (prospect.has_phone) {
    score += weights.contact_requirements.phone_weight
    factors++
  }

  // Title keywords
  if (prospect.prospect_title) {
    const words = prospect.prospect_title.toLowerCase().split(/\s+/)
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

async function generateLearnedPreferences(learningLogs: any[]) {
  const approved = learningLogs.filter(log => log.decision === 'approved')
  
  if (approved.length === 0) {
    return {
      total_sessions: 0,
      approval_rate: 0,
      preferences: {}
    }
  }

  const totalDecisions = learningLogs.length
  const approvalRate = approved.length / totalDecisions

  return {
    total_sessions: totalDecisions,
    approval_rate: approvalRate,
    preferences: {
      preferred_company_sizes: [...new Set(approved.map(log => log.company_size).filter(Boolean))],
      preferred_industries: [...new Set(approved.map(log => log.company_industry).filter(Boolean))],
      preferred_connection_degrees: [...new Set(approved.map(log => log.connection_degree).filter(d => d !== null))],
      requires_email: approved.filter(log => log.has_email).length / approved.length > 0.7,
      prefers_phone: approved.filter(log => log.has_phone).length / approved.length > 0.5,
      min_enrichment_score: Math.min(...approved.map(log => log.enrichment_score).filter(s => s !== null))
    }
  }
}