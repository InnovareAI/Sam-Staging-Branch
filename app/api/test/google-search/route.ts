/**
 * Test endpoint for Google Search MCP integration
 * Tests real LinkedIn search and company research capabilities
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleSearchMCPServer } from '@/lib/mcp/google-search-mcp'

export async function GET(request: NextRequest) {
  try {
    // Initialize Google Search MCP with environment variables
    const googleSearchServer = new GoogleSearchMCPServer({
      googleApiKey: process.env.GOOGLE_API_KEY!,
      googleCseId: process.env.GOOGLE_CSE_ID!,
      organizationId: process.env.ORGANIZATION_ID || 'innovareai',
      userId: process.env.USER_ID || 'sam-ai-platform'
    })

    const { searchParams } = new URL(request.url)
    const testType = searchParams.get('test') || 'linkedin'

    let testResult

    switch (testType) {
      case 'linkedin':
        // Test LinkedIn prospect search
        testResult = await googleSearchServer.callTool({
          method: 'tools/call',
          params: {
            name: 'boolean_linkedin_search',
            arguments: {
              query: '"VP Sales" OR "Vice President Sales" SaaS site:linkedin.com/in/',
              location: 'United States',
              maxResults: 5
            }
          }
        })
        break

      case 'company':
        // Test company research
        testResult = await googleSearchServer.callTool({
          method: 'tools/call',
          params: {
            name: 'company_research_search',
            arguments: {
              companyName: 'Salesforce',
              searchType: 'overview',
              maxResults: 5
            }
          }
        })
        break

      case 'icp':
        // Test ICP discovery
        testResult = await googleSearchServer.callTool({
          method: 'tools/call',
          params: {
            name: 'icp_prospect_discovery',
            arguments: {
              jobTitles: ['VP Sales', 'Chief Revenue Officer'],
              industries: ['SaaS', 'Technology'],
              companySize: 'medium',
              maxResults: 5
            }
          }
        })
        break

      case 'quota':
        // Test quota check
        testResult = await googleSearchServer.callTool({
          method: 'tools/call',
          params: {
            name: 'verify_search_quota',
            arguments: {
              service: 'all'
            }
          }
        })
        break

      default:
        return NextResponse.json({
          error: 'Invalid test type. Use ?test=linkedin|company|icp|quota'
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      testType,
      timestamp: new Date().toISOString(),
      result: testResult,
      environment: {
        hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
        hasGoogleCseId: !!process.env.GOOGLE_CSE_ID,
        organizationId: process.env.ORGANIZATION_ID,
        userId: process.env.USER_ID
      }
    })

  } catch (error) {
    console.error('Google Search MCP test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: {
        hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
        hasGoogleCseId: !!process.env.GOOGLE_CSE_ID,
        organizationId: process.env.ORGANIZATION_ID,
        userId: process.env.USER_ID
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { toolName, arguments: args } = body

    const googleSearchServer = new GoogleSearchMCPServer({
      googleApiKey: process.env.GOOGLE_API_KEY!,
      googleCseId: process.env.GOOGLE_CSE_ID!,
      organizationId: process.env.ORGANIZATION_ID || 'innovareai',
      userId: process.env.USER_ID || 'sam-ai-platform'
    })

    const result = await googleSearchServer.callTool({
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    })

    return NextResponse.json({
      success: true,
      toolName,
      timestamp: new Date().toISOString(),
      result
    })

  } catch (error) {
    console.error('Google Search MCP POST test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}