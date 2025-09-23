import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Helper function to check for duplicate LinkedIn accounts
async function checkAndHandleDuplicateAccounts(userId: string, newAccountData: any) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Get all existing LinkedIn accounts for this user
    const { data: existingAccounts, error } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'LINKEDIN')
      .eq('connection_status', 'active')
    
    if (error) {
      console.error('Error checking for duplicates:', error)
      return { isDuplicate: false, existingAccount: null }
    }
    
    if (!existingAccounts || existingAccounts.length === 0) {
      return { isDuplicate: false, existingAccount: null }
    }
    
    // Check if this account is a duplicate based on LinkedIn profile info
    const connectionParams = newAccountData.connection_params?.im || {}
    const newProfileId = connectionParams.publicIdentifier || connectionParams.email
    
    for (const existing of existingAccounts) {
      // If same Unipile account ID, it's the same account (reconnect case)
      if (existing.unipile_account_id === newAccountData.id) {
        return { isDuplicate: false, existingAccount: existing }
      }
      
      // If same LinkedIn profile, it's a duplicate
      if (existing.linkedin_public_identifier === newProfileId ||
          existing.account_email === connectionParams.email) {
        return { isDuplicate: true, existingAccount: existing }
      }
    }
    
    return { isDuplicate: false, existingAccount: null }
  } catch (error) {
    console.error('Exception checking for duplicates:', error)
    return { isDuplicate: false, existingAccount: null }
  }
}

// Helper function to delete duplicate account from Unipile
async function deleteDuplicateUnipileAccount(accountId: string) {
  try {
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY
    
    if (!unipileDsn || !unipileApiKey) {
      console.error('Missing Unipile credentials for account deletion')
      return false
    }
    
    const response = await fetch(`https://${unipileDsn}/api/v1/accounts/${accountId}`, {
      method: 'DELETE',
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    })
    
    if (response.ok) {
      console.log(`✅ Successfully deleted duplicate account ${accountId} from Unipile`)
      return true
    } else {
      const errorText = await response.text()
      console.error(`❌ Failed to delete duplicate account: ${response.status} ${errorText}`)
      return false
    }
  } catch (error) {
    console.error('Exception deleting duplicate account:', error)
    return false
  }
}

// Helper function to store user account association
async function storeUserAccountAssociation(userId: string, unipileAccount: any) {
  try {
    console.log(`🔗 Starting association storage for user ${userId} and account ${unipileAccount.id}`)
    
    const supabase = createRouteHandlerClient({ cookies })
    
    const connectionParams = unipileAccount.connection_params?.im || {}
    
    // Use the robust RPC function that bypasses schema cache issues
    const { data, error } = await supabase.rpc('create_user_association', {
      p_user_id: userId,
      p_unipile_account_id: unipileAccount.id,
      p_platform: unipileAccount.type,
      p_account_name: unipileAccount.name,
      p_account_email: connectionParams.email || connectionParams.username,
      p_linkedin_public_identifier: connectionParams.publicIdentifier,
      p_linkedin_profile_url: connectionParams.publicIdentifier ? 
        `https://www.linkedin.com/in/${connectionParams.publicIdentifier}` : null,
      p_connection_status: 'active'
    })
    
    if (error) {
      console.error('❌ Failed to store user account association via RPC:', error)
      
      // Fallback: Try direct insert as a last resort
      console.log('🔄 Attempting fallback direct insert...')
      const fallbackData = {
        user_id: userId,
        unipile_account_id: unipileAccount.id,
        platform: unipileAccount.type,
        account_name: unipileAccount.name,
        account_email: connectionParams.email || connectionParams.username,
        connection_status: 'active'
      }
      
      const { data: fallbackResult, error: fallbackError } = await supabase
        .from('user_unipile_accounts')
        .upsert(fallbackData, { 
          onConflict: 'unipile_account_id',
          ignoreDuplicates: false 
        })
        .select()
      
      if (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError)
        return false
      }
      
      console.log(`✅ Fallback association successful:`, fallbackResult)
      return true
    }
    
    console.log(`✅ Stored user account association successfully via RPC:`, {
      userId,
      unipileAccountId: unipileAccount.id,
      accountName: unipileAccount.name,
      platform: unipileAccount.type,
      data: data
    })
    
    return true
  } catch (error) {
    console.error('💥 Exception in storing user account association:', error)
    return false
  }
}

// GET - Handle hosted auth callback from Unipile
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const accountId = searchParams.get('account_id')
    const status = searchParams.get('status')
    const error = searchParams.get('error')
    const userContext = searchParams.get('user_context')

    console.log('🔄 Hosted auth callback received:', {
      sessionId,
      accountId,
      status,
      error,
      userContext
    })

    // Parse user context if available
    let parsedUserContext
    try {
      parsedUserContext = userContext ? JSON.parse(decodeURIComponent(userContext)) : null
    } catch (parseError) {
      console.error('Failed to parse user context:', parseError)
    }

    // Handle error cases
    if (error || status === 'error') {
      const errorMessage = error || 'Authentication failed'
      console.error('❌ Hosted auth failed:', errorMessage)
      
      // Redirect to LinkedIn integration page with error
      const redirectUrl = `/linkedin-integration?error=${encodeURIComponent(errorMessage)}`
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Handle successful authentication
    if (status === 'success' && accountId) {
      console.log('✅ Hosted auth successful for account:', accountId)

      // If we have user context, store the association
      if (parsedUserContext?.user_id) {
        try {
          // Fetch account details from Unipile to store association
          const unipileDsn = process.env.UNIPILE_DSN
          const unipileApiKey = process.env.UNIPILE_API_KEY

          if (unipileDsn && unipileApiKey) {
            const accountResponse = await fetch(`https://${unipileDsn}/api/v1/accounts/${accountId}`, {
              headers: {
                'X-API-KEY': unipileApiKey,
                'Accept': 'application/json'
              }
            })

            if (accountResponse.ok) {
              const accountData = await accountResponse.json()
              
              // Check for duplicates before storing
              const duplicateCheck = await checkAndHandleDuplicateAccounts(
                parsedUserContext.user_id,
                accountData
              )
              
              if (duplicateCheck.isDuplicate) {
                console.log(`🔄 Duplicate LinkedIn account detected, cleaning up: ${accountData.id}`)
                // Delete the duplicate account from Unipile to avoid billing
                await deleteDuplicateUnipileAccount(accountData.id)
                console.log(`✅ Duplicate account cleaned up successfully`)
              } else {
                // Store the association
                const associationStored = await storeUserAccountAssociation(
                  parsedUserContext.user_id, 
                  accountData
                )
                
                if (associationStored) {
                  console.log(`✅ Successfully stored association for user ${parsedUserContext.user_email}`)
                } else {
                  console.log(`❌ Failed to store association for account ${accountId}`)
                }
              }
            }
          }
        } catch (associationError) {
          console.error('❌ Error storing account association:', associationError)
          // Don't fail the whole flow, just log the error
        }
      }

      // Redirect to LinkedIn integration page with success
      const redirectUrl = `/linkedin-integration?success=true&account_id=${accountId}`
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Handle pending/in-progress status
    if (status === 'pending' || status === 'in_progress') {
      console.log('⏳ Authentication still in progress')
      const redirectUrl = `/linkedin-integration?status=pending&session_id=${sessionId}`
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Default case - redirect with unknown status
    console.warn('⚠️ Unknown callback status:', status)
    const redirectUrl = `/linkedin-integration?status=unknown`
    return NextResponse.redirect(new URL(redirectUrl, request.url))

  } catch (error) {
    console.error('💥 Hosted auth callback error:', error)
    
    // Redirect to LinkedIn integration page with callback error
    const errorMessage = 'Authentication callback failed'
    const redirectUrl = `/linkedin-integration?error=${encodeURIComponent(errorMessage)}`
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }
}

// POST - Handle webhook callbacks from Unipile (alternative to GET for some implementations)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('🔄 Hosted auth webhook received:', body)

    const { session_id, account_id, status, error, user_context } = body

    // Handle the same logic as GET but return JSON response instead of redirect
    if (error || status === 'error') {
      return NextResponse.json({
        success: false,
        error: error || 'Authentication failed',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    if (status === 'success' && account_id) {
      // If we have user context, store the association
      if (user_context?.user_id) {
        try {
          // Fetch account details and store association (same logic as GET)
          const unipileDsn = process.env.UNIPILE_DSN
          const unipileApiKey = process.env.UNIPILE_API_KEY

          if (unipileDsn && unipileApiKey) {
            const accountResponse = await fetch(`https://${unipileDsn}/api/v1/accounts/${account_id}`, {
              headers: {
                'X-API-KEY': unipileApiKey,
                'Accept': 'application/json'
              }
            })

            if (accountResponse.ok) {
              const accountData = await accountResponse.json()
              
              const associationStored = await storeUserAccountAssociation(
                user_context.user_id, 
                accountData
              )
              
              console.log(`Association result for webhook: ${associationStored}`)
            }
          }
        } catch (associationError) {
          console.error('❌ Webhook association error:', associationError)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Authentication successful',
        account_id,
        session_id,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received',
      status,
      session_id,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('💥 Hosted auth webhook error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      debug_info: {
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_type: error instanceof Error ? error.constructor.name : typeof error
      },
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}