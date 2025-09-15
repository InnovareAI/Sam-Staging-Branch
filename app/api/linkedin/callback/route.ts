import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// LinkedIn connection callback with duplicate detection and cleanup
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const body = await request.json()
    
    const { account_id, user_id, provider, status, connection_params } = body

    console.log(`🔄 LinkedIn callback received:`, {
      account_id,
      user_id,
      provider,
      status,
      timestamp: new Date().toISOString()
    })

    if (status !== 'connected' || provider !== 'LINKEDIN') {
      console.log(`❌ LinkedIn connection failed or wrong provider: ${status}, ${provider}`)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?linkedin=failed&reason=${status}`)
    }

    // Get Unipile configuration
    const unipileDsn = process.env.UNIPILE_DSN
    const unipileApiKey = process.env.UNIPILE_API_KEY

    if (!unipileDsn || !unipileApiKey) {
      console.error('❌ Unipile configuration missing')
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?linkedin=error&reason=config`)
    }

    // Verify user exists in our system
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.id !== user_id) {
      console.error('❌ User verification failed:', { authError, expected: user_id, actual: user?.id })
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?linkedin=error&reason=auth`)
    }

    // Fetch account details from Unipile
    const baseUrl = `https://${unipileDsn}/api/v1`
    let accountDetails
    try {
      const response = await fetch(`${baseUrl}/accounts/${account_id}`, {
        headers: { 'X-API-KEY': unipileApiKey }
      })
      
      if (!response.ok) {
        throw new Error(`Unipile API error: ${response.status}`)
      }
      
      accountDetails = await response.json()
      console.log(`📋 Fetched account details from Unipile:`, {
        id: accountDetails.id,
        name: accountDetails.name || accountDetails.connection_params?.im?.username,
        status: accountDetails.status
      })
    } catch (error) {
      console.error('❌ Failed to fetch account details from Unipile:', error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?linkedin=error&reason=fetch`)
    }

    // Check for existing associations for this user (for duplicate detection)
    const { data: existingAssociations } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id, account_name, created_at')
      .eq('user_id', user_id)
      .eq('platform', 'LINKEDIN')

    console.log(`🔍 Found ${existingAssociations?.length || 0} existing LinkedIn associations`)

    // Determine LinkedIn experience type from connection params
    let linkedinExperience = 'classic' // default
    if (accountDetails.connection_params?.product_type) {
      const productType = accountDetails.connection_params.product_type.toLowerCase()
      if (productType.includes('sales')) {
        linkedinExperience = 'sales_navigator'
      } else if (productType.includes('recruiter')) {
        linkedinExperience = 'recruiter'
      }
    }

    // Store new association using enhanced RPC function
    const { data: newAssociation, error: insertError } = await supabase.rpc('create_user_association', {
      p_user_id: user_id,
      p_unipile_account_id: account_id,
      p_platform: 'LINKEDIN',
      p_account_name: accountDetails.name || accountDetails.connection_params?.im?.username || 'LinkedIn Account',
      p_account_email: accountDetails.connection_params?.im?.email,
      p_linkedin_public_identifier: accountDetails.connection_params?.im?.public_identifier,
      p_linkedin_profile_url: accountDetails.connection_params?.im?.profile_url || 
        (accountDetails.connection_params?.im?.public_identifier ? 
          `https://linkedin.com/in/${accountDetails.connection_params.im.public_identifier}` : null),
      p_connection_status: 'active',
      p_connection_method: 'hosted_auth',
      p_linkedin_experience: linkedinExperience
    })

    if (insertError) {
      console.error('❌ Failed to store association:', insertError)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?linkedin=error&reason=storage`)
    }

    console.log(`✅ Successfully stored LinkedIn association`)

    // CRITICAL: Duplicate detection and cleanup (Arnaud's guidance)
    if (existingAssociations && existingAssociations.length > 0) {
      console.log(`🔍 Performing duplicate detection for ${existingAssociations.length} existing associations`)
      
      try {
        // Get all LinkedIn accounts from Unipile for this user
        const unipileResponse = await fetch(`${baseUrl}/accounts`, {
          headers: { 'X-API-KEY': unipileApiKey }
        })
        
        if (unipileResponse.ok) {
          const allUnipileAccounts = await unipileResponse.json()
          const userLinkedInAccounts = allUnipileAccounts.filter((acc: any) => 
            acc.type === 'LINKEDIN' && 
            (existingAssociations.some(ea => ea.unipile_account_id === acc.id) || acc.id === account_id)
          )
          
          // If we have more than one account, delete duplicates (keeping the newest)
          if (userLinkedInAccounts.length > 1) {
            console.log(`🗑️ Found ${userLinkedInAccounts.length} LinkedIn accounts, cleaning up duplicates`)
            
            const accountsToDelete = userLinkedInAccounts
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(1) // Keep the first (newest), delete the rest
            
            for (const accountToDelete of accountsToDelete) {
              if (accountToDelete.id !== account_id) { // Don't delete the account we just created
                console.log(`🗑️ Deleting duplicate account: ${accountToDelete.id}`)
                
                // Delete from Unipile (note: this is still invoiced according to Arnaud)
                await fetch(`${baseUrl}/accounts/${accountToDelete.id}`, {
                  method: 'DELETE',
                  headers: { 'X-API-KEY': unipileApiKey }
                }).catch(err => console.error(`Failed to delete from Unipile: ${err.message}`))
                
                // Remove from local database
                await supabase
                  .from('user_unipile_accounts')
                  .delete()
                  .eq('unipile_account_id', accountToDelete.id)
              }
            }
            
            console.log(`✅ Duplicate cleanup completed`)
          }
        }
      } catch (error) {
        console.error('❌ Error during duplicate cleanup:', error)
        // Don't fail the entire process if cleanup fails
      }
    }

    console.log(`✅ LinkedIn connection successful for user ${user_id}`)
    
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?linkedin=connected&experience=${linkedinExperience}`)

  } catch (error) {
    console.error('❌ Error in LinkedIn callback:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?linkedin=error&reason=unexpected`)
  }
}

// GET method for webhook verification or status checks
export async function GET(request: NextRequest) {
  try {
    // Basic webhook verification endpoint
    const { searchParams } = new URL(request.url)
    const challenge = searchParams.get('challenge')
    
    if (challenge) {
      // Webhook verification
      return NextResponse.json({ challenge })
    }
    
    // Status endpoint
    return NextResponse.json({
      success: true,
      endpoint: 'linkedin_callback',
      timestamp: new Date().toISOString(),
      ready: true
    })

  } catch (error) {
    console.error('Error in LinkedIn callback GET:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}