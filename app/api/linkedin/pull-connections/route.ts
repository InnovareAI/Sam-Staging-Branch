import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Pull LinkedIn Connections via Unipile API
 * Used by SAM to test LinkedIn integration and show real connections
 */

async function callUnipileAPI(endpoint: string, accountId?: string) {
  const unipileDsn = process.env.UNIPILE_DSN
  const unipileApiKey = process.env.UNIPILE_API_KEY

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured')
  }

  const url = accountId
    ? `https://${unipileDsn}/api/v1/${endpoint}?account_id=${accountId}`
    : `https://${unipileDsn}/api/v1/${endpoint}`

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': unipileApiKey,
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Unipile API error: ${response.status} ${response.statusText} - ${text}`)
  }

  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const user = session.user
    const body = await request.json()
    const { count = 10 } = body

    // Get user's workspace
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found. Please select a workspace first.'
      }, { status: 404 })
    }

    const workspaceId = profile.current_workspace_id

    // Get user's LinkedIn accounts
    const { data: workspaceAccounts } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, connection_status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')

    if (!workspaceAccounts || workspaceAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No LinkedIn accounts connected. Please connect a LinkedIn account first.',
        help: 'Go to Settings → LinkedIn Integration to connect your account'
      }, { status: 404 })
    }

    // Use the first connected account
    const primaryAccount = workspaceAccounts[0]
    const accountId = primaryAccount.unipile_account_id

    if (!accountId) {
      return NextResponse.json({
        success: false,
        error: 'LinkedIn account not properly linked'
      }, { status: 400 })
    }

    // Call Unipile to get recent messages (which includes connections)
    // Note: Unipile doesn't have a direct "get connections" endpoint
    // We need to use the messages/chats endpoint to see who the user has connections with
    let connectionsData
    try {
      connectionsData = await callUnipileAPI(`chats`, accountId)
    } catch (error) {
      console.error('Failed to fetch LinkedIn chats:', error)
      return NextResponse.json({
        success: false,
        error: `Failed to connect to LinkedIn: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: 'The LinkedIn account may need re-authentication or Unipile API may be unavailable'
      }, { status: 500 })
    }

    // Format connections data
    const chats = Array.isArray(connectionsData)
      ? connectionsData
      : (connectionsData.items || connectionsData.chats || [])

    const connections = chats.slice(0, count).map((chat: any, index: number) => {
      const attendee = chat.attendees?.[0] || {}
      return {
        position: index + 1,
        name: attendee.name || 'Unknown',
        title: attendee.title || 'N/A',
        company: attendee.company || 'N/A',
        linkedinUrl: attendee.linkedin_url || null,
        profilePicture: attendee.profile_picture_url || null,
        lastMessage: chat.last_message?.text?.slice(0, 100) || 'No recent messages',
        lastMessageAt: chat.last_message_at || chat.updated_at
      }
    })

    if (connections.length === 0) {
      return NextResponse.json({
        success: true,
        connections: [],
        count: 0,
        message: 'LinkedIn account is connected but has no conversation history yet. Try messaging some connections first!'
      })
    }

    return NextResponse.json({
      success: true,
      connections,
      count: connections.length,
      requested: count,
      accountName: primaryAccount.connection_status,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Pull LinkedIn connections error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pull LinkedIn connections',
      technical_details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
