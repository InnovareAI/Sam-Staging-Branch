/**
 * MCP API Endpoints for SAM AI Platform
 * 
 * Provides REST API interface to MCP servers for prospect intelligence
 */

import { NextRequest, NextResponse } from 'next/server'
import { mcpRegistry, createMCPConfig } from '@/lib/mcp/mcp-registry'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Initialize MCP registry on first request
let mcpInitialized = false

async function initializeMCP() {
  if (mcpInitialized) return

  try {
    const config = createMCPConfig()
    const result = await mcpRegistry.initialize(config)
    
    if (result.success) {
      console.log('✅ MCP Registry initialized:', result.servers.join(', '))
      mcpInitialized = true
    } else {
      console.error('❌ MCP initialization failed:', result.message)
    }
  } catch (error) {
    console.error('❌ MCP initialization error:', error)
  }
}

// GET /api/mcp - List available MCP tools
export async function GET(request: NextRequest) {
  try {
    await initializeMCP()
    
    const tools = await mcpRegistry.listAllTools()
    const status = await mcpRegistry.getServerStatus()
    
    return NextResponse.json({
      success: true,
      tools: tools.tools,
      serverStatus: status,
      totalTools: tools.tools.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list MCP tools',
      tools: [],
      serverStatus: null
    }, { status: 500 })
  }
}

// POST /api/mcp - Call MCP tool
export async function POST(request: NextRequest) {
  try {
    await initializeMCP()
    
    // Get user authentication
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { toolName, arguments: toolArgs, server } = body

    if (!toolName) {
      return NextResponse.json({
        success: false,
        error: 'Tool name is required'
      }, { status: 400 })
    }

    // Call MCP tool
    const mcpRequest = {
      method: 'tools/call' as const,
      params: {
        name: toolName,
        arguments: toolArgs || {}
      },
      server
    }

    const result = await mcpRegistry.callTool(mcpRequest)
    
    // Log tool usage for analytics
    await logToolUsage(user.id, toolName, server || 'auto-detected', result.isError)

    return NextResponse.json({
      success: !result.isError,
      result: result.content,
      isError: result.isError,
      toolName,
      server: server || 'auto-detected',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('MCP tool call error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
      result: null
    }, { status: 500 })
  }
}

// Helper function to log tool usage
async function logToolUsage(userId: string, toolName: string, server: string, isError?: boolean) {
  try {
    // Could log to Supabase for analytics
    console.log(`📊 MCP Tool Usage: ${userId} used ${toolName} on ${server} - ${isError ? 'ERROR' : 'SUCCESS'}`)
  } catch (error) {
    // Logging failure shouldn't break the main request
    console.error('Failed to log tool usage:', error)
  }
}