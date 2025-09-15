import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Admin endpoint to manually associate LinkedIn accounts with users
export async function POST(request: NextRequest) {
  try {
    const { user_email, unipile_account_id, account_name, linkedin_username, public_identifier } = await request.json()
    
    if (!user_email || !unipile_account_id) {
      return NextResponse.json({
        success: false,
        error: 'user_email and unipile_account_id are required'
      }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies: cookies })
    
    // Find the user by email
    const { data: users, error: userError } = await supabase
      .from('users') // Try users table first
      .select('id, email')
      .eq('email', user_email)
      .limit(1)

    let userId = users?.[0]?.id

    // If not found in users table, try auth.users view (if accessible)
    if (!userId) {
      console.log(`User not found in users table, searching by email: ${user_email}`)
      
      // Try to find user by getting all users and filtering (if we have any existing associations)
      const { data: existingAssociations, error: assocError } = await supabase
        .from('user_unipile_accounts')
        .select('user_id')
        .limit(1)
      
      if (existingAssociations?.length > 0) {
        // We have some user associations, so we know the table structure works
        // For now, we'll create a manual entry - you'll need to provide the actual user ID
        return NextResponse.json({
          success: false,
          error: `Cannot automatically find user ID for ${user_email}. Please provide the user_id directly.`,
          debug_info: {
            searched_email: user_email,
            found_in_users_table: !!users?.length,
            existing_associations_count: existingAssociations?.length || 0
          }
        }, { status: 404 })
      }
    }

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: `User not found with email: ${user_email}`
      }, { status: 404 })
    }

    console.log(`Creating LinkedIn association for user ${user_email} (${userId}) with account ${unipile_account_id}`)

    // Create the association
    const { data: association, error: insertError } = await supabase
      .from('user_unipile_accounts')
      .insert({
        user_id: userId,
        unipile_account_id: unipile_account_id,
        platform: 'LINKEDIN',
        account_name: account_name || 'LinkedIn Account',
        account_email: linkedin_username,
        linkedin_public_identifier: public_identifier,
        linkedin_profile_url: public_identifier ? `https://linkedin.com/in/${public_identifier}` : null,
        connection_status: 'active'
      })
      .select()

    if (insertError) {
      console.error('Error creating LinkedIn association:', insertError)
      return NextResponse.json({
        success: false,
        error: `Failed to create association: ${insertError.message}`,
        debug_info: {
          user_id: userId,
          unipile_account_id: unipile_account_id,
          insert_error: insertError
        }
      }, { status: 500 })
    }

    console.log(`✅ Successfully created LinkedIn association for ${user_email}`)

    return NextResponse.json({
      success: true,
      message: 'LinkedIn account successfully associated',
      association: association,
      user_info: {
        user_id: userId,
        user_email: user_email
      },
      account_info: {
        unipile_account_id: unipile_account_id,
        account_name: account_name,
        public_identifier: public_identifier,
        platform: 'LINKEDIN'
      }
    })

  } catch (error) {
    console.error('Manual LinkedIn association error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// GET method to check existing associations
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const user_email = url.searchParams.get('user_email')
    
    const supabase = createRouteHandlerClient({ cookies: cookies })
    
    if (user_email) {
      // Find user and their associations
      const { data: users } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', user_email)
        .limit(1)

      if (!users?.length) {
        return NextResponse.json({
          success: false,
          error: `User not found: ${user_email}`
        }, { status: 404 })
      }

      const userId = users[0].id

      const { data: associations } = await supabase
        .from('user_unipile_accounts')
        .select('*')
        .eq('user_id', userId)

      return NextResponse.json({
        success: true,
        user: users[0],
        associations: associations || []
      })
    } else {
      // Get all associations
      const { data: associations } = await supabase
        .from('user_unipile_accounts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      return NextResponse.json({
        success: true,
        associations: associations || []
      })
    }

  } catch (error) {
    console.error('Error checking associations:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}