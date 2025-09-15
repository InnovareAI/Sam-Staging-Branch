import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // 🚨 SECURITY: Get user authentication for workspace filtering
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Create user client to get authenticated user
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } }
      }
    )

    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication'
      }, { status: 401 })
    }

    // Get user's organization/workspace
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!userOrg) {
      return NextResponse.json({
        success: false,
        error: 'User not associated with any workspace'
      }, { status: 403 })
    }

    // 🛡️ SECURITY: Only get sessions for user's workspace
    const { data: session, error } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('organization_id', userOrg.organization_id)
      .eq('status', 'active')
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return NextResponse.json({
      success: true,
      session: session || null
    })

  } catch (error) {
    console.error('Session fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { icp_criteria, prospect_source = 'unipile_linkedin_search' } = body
    
    // 🚨 SECURITY: Get user authentication for workspace filtering
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Create user client to get authenticated user
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } }
      }
    )

    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication'
      }, { status: 401 })
    }

    // Get user's organization/workspace
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    if (!userOrg) {
      return NextResponse.json({
        success: false,
        error: 'User not associated with any workspace'
      }, { status: 403 })
    }

    // Get next batch number for this workspace
    const { data: lastSession } = await supabase
      .from('prospect_approval_sessions')
      .select('batch_number')
      .eq('user_id', user.id)
      .eq('organization_id', userOrg.organization_id)
      .order('batch_number', { ascending: false })
      .limit(1)
      .single()

    const nextBatchNumber = (lastSession?.batch_number || 0) + 1

    // Create new approval session in user's workspace
    const { data: newSession, error } = await supabase
      .from('prospect_approval_sessions')
      .insert({
        batch_number: nextBatchNumber,
        user_id: user.id,
        organization_id: userOrg.organization_id,
        status: 'active',
        total_prospects: 0, // Will be updated when prospects are added
        approved_count: 0,
        rejected_count: 0,
        pending_count: 0,
        icp_criteria,
        prospect_source,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      session: newSession
    })

  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}