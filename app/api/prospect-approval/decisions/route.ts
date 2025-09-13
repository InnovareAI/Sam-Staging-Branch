import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 })
    }

    // Get decisions for this session
    const { data: decisions, error } = await supabase
      .from('prospect_approval_decisions')
      .select('*')
      .eq('session_id', sessionId)
      .order('decided_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      decisions: decisions || []
    })

  } catch (error) {
    console.error('Decisions fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}