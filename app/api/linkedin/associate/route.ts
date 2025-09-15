import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Production-ready LinkedIn association endpoint for any client
export async function POST(request: NextRequest) {
  try {
    // Authenticate user first
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    console.log(`🔗 LinkedIn association request from user: ${user.email}`)

    const body = await request.json()
    const { 
      unipile_account_id, 
      platform = 'LINKEDIN',
      account_name,
      account_email,
      linkedin_public_identifier,
      linkedin_profile_url,
      connection_status = 'active'
    } = body

    // Validate required fields
    if (!unipile_account_id) {
      return NextResponse.json({
        success: false,
        error: 'unipile_account_id is required',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    // Check if association already exists
    const { data: existingAssociation, error: checkError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('unipile_account_id', unipile_account_id)
      .single()

    if (existingAssociation && !checkError) {
      return NextResponse.json({
        success: true,
        message: 'LinkedIn account already associated',
        association: existingAssociation,
        timestamp: new Date().toISOString()
      })
    }

    // Create the association using the robust function that bypasses schema cache issues
    const { data: newAssociation, error: insertError } = await supabase
      .rpc('create_user_association', {
        p_user_id: user.id,
        p_unipile_account_id: unipile_account_id,
        p_platform: platform,
        p_account_name: account_name,
        p_account_email: account_email,
        p_linkedin_public_identifier: linkedin_public_identifier,
        p_linkedin_profile_url: linkedin_profile_url || (linkedin_public_identifier ? 
          `https://linkedin.com/in/${linkedin_public_identifier}` : null),
        p_connection_status: connection_status
      })

    if (insertError) {
      console.error('Error creating LinkedIn association via RPC:', insertError)
      
      // Fallback: Try direct insert without the problematic columns
      console.log('🔄 Attempting fallback association without LinkedIn-specific columns...')
      const { data: fallbackAssociation, error: fallbackError } = await supabase
        .from('user_unipile_accounts')
        .insert({
          user_id: user.id,
          unipile_account_id: unipile_account_id,
          platform: platform,
          account_name: account_name,
          account_email: account_email,
          connection_status: connection_status
        })
        .select()
        .single()

      if (fallbackError) {
        console.error('❌ Fallback association also failed:', fallbackError)
        return NextResponse.json({
          success: false,
          error: `Failed to create association: ${fallbackError.message}`,
          debug_info: {
            rpc_error: insertError.message,
            fallback_error: fallbackError.message
          },
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }

      console.log(`✅ Fallback association successful for user ${user.email}`)
      return NextResponse.json({
        success: true,
        message: 'LinkedIn account successfully associated (fallback method)',
        association: fallbackAssociation,
        has_linkedin: true,
        method: 'fallback',
        timestamp: new Date().toISOString()
      })
    }

    console.log(`✅ Successfully associated LinkedIn account with user ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'LinkedIn account successfully associated',
      association: newAssociation,
      has_linkedin: true,
      method: 'rpc',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in LinkedIn association:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// GET method to check association status
export async function GET(request: NextRequest) {
  try {
    // Authenticate user first
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // Get user's LinkedIn associations
    const { data: associations, error } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN')

    const hasLinkedIn = (associations && associations.length > 0)

    return NextResponse.json({
      success: true,
      has_linkedin: hasLinkedIn,
      associations: associations || [],
      count: associations?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error checking LinkedIn associations:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}