import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { AutoIPAssignmentService } from '@/lib/services/auto-ip-assignment'

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

    // Auto-provision preference if missing
    let effectivePrefs = proxyPrefs
    if (!effectivePrefs) {
      try {
        const autoIP = new AutoIPAssignmentService()
        // Try to use profile country if available
        let profileCountry: string | undefined
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('profile_country')
            .eq('id', session.user.id)
            .maybeSingle()
          if (profile?.profile_country && typeof profile.profile_country === 'string') {
            profileCountry = profile.profile_country.toLowerCase()
          }
        } catch (e) {
          // ignore
        }

        const userLocation = profileCountry ? null : await autoIP.detectUserLocation()
        const proxyConfig = await autoIP.generateOptimalProxyConfig(
          userLocation || undefined,
          profileCountry || undefined
        )

        const { data: inserted, error: upsertError } = await supabase
          .from('user_proxy_preferences')
          .upsert({
            user_id: session.user.id,
            detected_location: userLocation ? `${userLocation.city}, ${userLocation.regionName}, ${userLocation.country}` : null,
            linkedin_location: null,
            preferred_country: proxyConfig.country,
            preferred_state: proxyConfig.state,
            preferred_city: proxyConfig.city,
            confidence_score: proxyConfig.confidence,
            session_id: proxyConfig.sessionId,
            is_auto_assigned: true,
            last_updated: new Date().toISOString()
          }, { onConflict: 'user_id' })
          .select()
          .single()

        if (upsertError) {
          console.error('❌ Failed to auto-provision proxy preferences:', upsertError)
        } else {
          effectivePrefs = inserted
        }
      } catch (e) {
        console.error('⚠️ Auto-provisioning proxy failed:', e)
      }
    }

    console.log('✅ Proxy preferences:', effectivePrefs)

    return NextResponse.json({
      success: true,
      preferences: effectivePrefs || null,
      has_preferences: !!effectivePrefs
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