import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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

    console.log(`🔧 Manual LinkedIn association for user: ${user.email}`)

    // Get the latest Thorsten Linz LinkedIn account from the request (created today)
    const thorstenLinkedInAccountId = 'isCX0_ZQStWs1xxqilsw5Q' // From Unipile accounts list
    const publicIdentifier = 'tvonlinz'
    const accountName = 'Thorsten Linz'

    // Check if association already exists
    const { data: existingAssociation, error: checkError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('unipile_account_id', thorstenLinkedInAccountId)
      .single()

    if (existingAssociation) {
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
        p_unipile_account_id: thorstenLinkedInAccountId,
        p_platform: 'LINKEDIN',
        p_account_name: accountName,
        p_account_email: null,
        p_linkedin_public_identifier: publicIdentifier,
        p_linkedin_profile_url: `https://linkedin.com/in/${publicIdentifier}`,
        p_connection_status: 'active'
      })

    if (insertError) {
      console.error('Error creating LinkedIn association:', insertError)
      return NextResponse.json({
        success: false,
        error: `Failed to create association: ${insertError.message}`,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    console.log(`✅ Successfully associated LinkedIn account ${accountName} with user ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'LinkedIn account successfully associated',
      association: newAssociation,
      account_details: {
        account_id: thorstenLinkedInAccountId,
        account_name: accountName,
        public_identifier: publicIdentifier,
        platform: 'LINKEDIN',
        status: 'active'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in manual LinkedIn association:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}