import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'

const SAM_PROJECT_ROOT = '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7'

interface QAAgentResponse {
  session_id: string
  started_at: string
  uptime_minutes: number
  statistics: {
    issues_detected: number
    issues_fixed: number
    manual_intervention_required: number
    success_rate: number
  }
  configuration: {
    version: string
    environment: string
    autoFixEnabled: boolean
    backupEnabled: boolean
  }
  recent_fixes: Array<{
    issueId: string
    issueType: string
    file: string
    strategy: string
    fixes: string[]
    appliedAt: string
    success: boolean
  }>
}

interface QAScanResult {
  sessionId: string
  scope: string
  focus: string
  scanStarted: string
  scanCompleted: string
  issues: Array<{
    id: string
    type: string
    file: string
    severity: 'critical' | 'warning' | 'info'
    description: string
    autoFixable: boolean
    riskLevel: 'low' | 'medium' | 'high'
  }>
  fixesApplied: Array<{
    issueId: string
    issueType: string
    fixes: string[]
    backupPath: string
  }>
  summary: {
    totalIssues: number
    criticalIssues: number
    autoFixableIssues: number
    fixesApplied: number
    manualInterventionRequired: number
  }
}

async function callQAAgent(method: string, params: any = {}): Promise<any> {
  try {
    const qaAgentPath = path.join(SAM_PROJECT_ROOT, 'mcp-qa-agent.js')
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: method,
      params: params
    }
    
    const command = `echo '${JSON.stringify(request)}' | node ${qaAgentPath}`
    const result = execSync(command, { 
      encoding: 'utf8',
      timeout: 10000, // 10 second timeout
      cwd: SAM_PROJECT_ROOT
    })
    
    // Parse the JSON response
    const lines = result.trim().split('\n')
    const jsonLine = lines.find(line => line.startsWith('{'))
    
    if (jsonLine) {
      const response = JSON.parse(jsonLine)
      return response.result || response.content?.[0]?.text ? JSON.parse(response.content[0].text) : null
    }
    
    return null
  } catch (error) {
    console.error('Error calling QA Agent:', error)
    return null
  }
}

// GET - Get QA Agent status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'
    
    switch (action) {
      case 'status':
        const statusResult = await callQAAgent('tools/call', {
          name: 'qa_get_session_status',
          arguments: {}
        })
        
        return NextResponse.json({
          success: true,
          data: statusResult,
          timestamp: new Date().toISOString()
        })
        
      case 'scan':
        const scope = searchParams.get('scope') || 'quick'
        const focus = searchParams.get('focus') || 'all'
        const autoFix = searchParams.get('auto_fix') === 'true'
        
        const scanResult = await callQAAgent('tools/call', {
          name: 'qa_scan_project',
          arguments: {
            scope,
            focus,
            auto_fix: autoFix
          }
        })
        
        return NextResponse.json({
          success: true,
          data: scanResult,
          timestamp: new Date().toISOString()
        })
        
      case 'validate_environment':
        const checkType = searchParams.get('check_type') || 'all'
        const autoCorrect = searchParams.get('auto_correct') === 'true'
        
        const validateResult = await callQAAgent('tools/call', {
          name: 'qa_validate_environment',
          arguments: {
            check_type: checkType,
            auto_correct: autoCorrect
          }
        })
        
        return NextResponse.json({
          success: true,
          data: validateResult,
          timestamp: new Date().toISOString()
        })
        
      case 'fix_imports':
        const filePath = searchParams.get('file_path')
        const importType = searchParams.get('import_type') || 'all'
        
        const fixResult = await callQAAgent('tools/call', {
          name: 'qa_fix_imports',
          arguments: {
            file_path: filePath,
            import_type: importType,
            preserve_functionality: true
          }
        })
        
        return NextResponse.json({
          success: true,
          data: fixResult,
          timestamp: new Date().toISOString()
        })
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: status, scan, validate_environment, fix_imports'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('QA Status API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// POST - Execute QA Agent actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, parameters } = body
    
    if (!action) {
      return NextResponse.json({
        success: false,
        error: 'Action is required'
      }, { status: 400 })
    }
    
    let result
    
    switch (action) {
      case 'auto_fix_issue':
        if (!parameters?.issue_id) {
          return NextResponse.json({
            success: false,
            error: 'issue_id is required for auto_fix_issue action'
          }, { status: 400 })
        }
        
        result = await callQAAgent('tools/call', {
          name: 'qa_auto_fix_issue',
          arguments: {
            issue_id: parameters.issue_id,
            fix_strategy: parameters.fix_strategy || 'safe',
            backup: parameters.backup !== false
          }
        })
        break
        
      case 'rollback_fix':
        if (!parameters?.fix_id) {
          return NextResponse.json({
            success: false,
            error: 'fix_id is required for rollback_fix action'
          }, { status: 400 })
        }
        
        result = await callQAAgent('tools/call', {
          name: 'qa_rollback_fix',
          arguments: {
            fix_id: parameters.fix_id
          }
        })
        break
        
      case 'emergency_scan':
        result = await callQAAgent('tools/call', {
          name: 'qa_scan_project',
          arguments: {
            scope: 'full',
            focus: 'all',
            auto_fix: true
          }
        })
        break
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: auto_fix_issue, rollback_fix, emergency_scan'
        }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      action,
      data: result,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('QA Action API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}