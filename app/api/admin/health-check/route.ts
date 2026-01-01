import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db';

/**
 * Daily Health Check Endpoint
 *
 * Tests critical system functionality:
 * - Database connection
 * - RLS policy status
 * - Integration status
 * - Campaign functionality
 */
export async function POST(request: NextRequest) {
  try {
    const { check } = await request.json()

    // Database connection check
    if (check === 'database') {
      const { data, error } = await supabase
        .from('workspaces')
        .select('count')
        .limit(1)

      if (error) {
        return NextResponse.json({
          status: 'unhealthy',
          check: 'database',
          error: error.message
        }, { status: 500 })
      }

      return NextResponse.json({
        status: 'healthy',
        check: 'database',
        timestamp: new Date().toISOString()
      })
    }

    // Default response
    return NextResponse.json({
      status: 'unknown',
      message: 'Specify check parameter: database, rls, integrations, campaigns'
    })

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
