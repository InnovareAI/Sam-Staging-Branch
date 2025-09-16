import { NextRequest, NextResponse } from 'next/server'
import { n8nClient, checkN8NConfiguration } from '@/lib/n8n-client'

// GET - Check N8N health and configuration
export async function GET(request: NextRequest) {
  try {
    // Check configuration
    const config = checkN8NConfiguration()
    
    // Check N8N health
    const healthCheck = await n8nClient.healthCheck()
    
    // List workflows (if possible)
    let workflowCount = 0
    let workflowsError = null
    
    try {
      const workflows = await n8nClient.listWorkflows()
      workflowCount = Array.isArray(workflows) ? workflows.length : 0
    } catch (error) {
      workflowsError = error instanceof Error ? error.message : 'Unknown error'
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      configuration: {
        base_url: config.baseUrl,
        has_api_key: config.hasApiKey,
        mode: config.mode,
        is_configured: config.isConfigured
      },
      health: healthCheck,
      workflows: {
        count: workflowCount,
        error: workflowsError
      },
      recommendations: generateRecommendations(config, healthCheck)
    })

  } catch (error) {
    console.error('N8N health check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

function generateRecommendations(config: any, health: any): string[] {
  const recommendations = []

  if (!config.hasApiKey) {
    recommendations.push('Set N8N_API_KEY environment variable for production functionality')
  }

  if (config.baseUrl === 'https://workflows.innovareai.com' && !config.hasApiKey) {
    recommendations.push('Verify N8N instance URL is correct: workflows.innovareai.com')
  }

  if (health.status === 'error') {
    recommendations.push('Check N8N instance connectivity and API access')
  }

  if (health.status === 'simulation') {
    recommendations.push('Currently running in simulation mode - no actual N8N integration')
  }

  if (recommendations.length === 0) {
    recommendations.push('N8N integration is properly configured and healthy')
  }

  return recommendations
}