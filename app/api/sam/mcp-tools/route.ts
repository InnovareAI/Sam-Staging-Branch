import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { handleSamMCPRequest } from '@/lib/sam-mcp-handler'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { input, workspaceId, conversationContext } = body

    if (!input || !workspaceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: input and workspaceId'
        },
        { status: 400 }
      )
    }

    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await handleSamMCPRequest({
      input: input.trim(),
      workspaceId,
      conversationContext: conversationContext || {}
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('Sam MCP API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process Sam MCP request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}