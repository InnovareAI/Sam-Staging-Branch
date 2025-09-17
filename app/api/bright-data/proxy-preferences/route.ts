import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    
    // Get current user
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('🔍 Fetching proxy preferences for user:', session.user.id)

    // Get user's proxy preferences
    const { data: proxyPrefs, error: proxyError } = await supabase
      .from('user_proxy_preferences')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    if (proxyError && proxyError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Error fetching proxy preferences:', proxyError)
      return NextResponse.json({ error: 'Failed to fetch proxy preferences' }, { status: 500 })
    }

    console.log('✅ Proxy preferences:', proxyPrefs)

    return NextResponse.json({
      success: true,
      preferences: proxyPrefs,
      has_preferences: !!proxyPrefs
    })

  } catch (error) {
    console.error('❌ Error in proxy preferences API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies })
    
    // Get current user
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { preferred_country, preferred_state, preferred_city } = await request.json()

    console.log('🌍 Updating proxy preferences for user:', session.user.id, {
      preferred_country,
      preferred_state,
      preferred_city
    })

    // Generate new session ID for proxy rotation
    const sessionId = `${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`

    // Update or create proxy preferences
    const { data: updatedPrefs, error: updateError } = await supabase
      .from('user_proxy_preferences')
      .upsert({
        user_id: session.user.id,
        preferred_country,
        preferred_state,
        preferred_city,
        session_id: sessionId,
        is_auto_assigned: false, // User manually changed
        is_linkedin_based: false, // User overrode LinkedIn-based assignment
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating proxy preferences:', updateError)
      return NextResponse.json({ error: 'Failed to update proxy preferences' }, { status: 500 })
    }

    console.log('✅ Updated proxy preferences:', updatedPrefs)

    return NextResponse.json({
      success: true,
      preferences: updatedPrefs,
      message: 'Proxy location updated successfully'
    })

  } catch (error) {
    console.error('❌ Error updating proxy preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}