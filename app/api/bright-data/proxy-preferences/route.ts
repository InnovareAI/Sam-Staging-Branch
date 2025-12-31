import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'
import { AutoIPAssignmentService } from '@/lib/services/auto-ip-assignment'

export async function GET(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId } = await verifyAuth(request)

    console.log('🔍 Fetching proxy preferences for user:', userId)

    // Get user's proxy preferences
    const { rows: proxyRows } = await pool.query(
      'SELECT * FROM user_proxy_preferences WHERE user_id = $1',
      [userId]
    )

    let effectivePrefs = proxyRows[0] || null

    // Auto-provision preference if missing
    if (!effectivePrefs) {
      try {
        const autoIP = new AutoIPAssignmentService()
        // Try to use profile country if available
        let profileCountry: string | undefined
        try {
          const { rows: profileRows } = await pool.query(
            'SELECT profile_country FROM users WHERE id = $1',
            [userId]
          )
          if (profileRows[0]?.profile_country && typeof profileRows[0].profile_country === 'string') {
            profileCountry = profileRows[0].profile_country.toLowerCase()
          }
        } catch (e) {
          // ignore
        }

        const userLocation = profileCountry ? null : await autoIP.detectUserLocation()
        const proxyConfig = await autoIP.generateOptimalProxyConfig(
          userLocation || undefined,
          profileCountry || undefined
        )

        const { rows: insertedRows } = await pool.query(
          `INSERT INTO user_proxy_preferences (
            user_id, detected_location, linkedin_location, preferred_country,
            preferred_state, preferred_city, confidence_score, session_id, last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (user_id) DO UPDATE SET
            detected_location = EXCLUDED.detected_location,
            preferred_country = EXCLUDED.preferred_country,
            preferred_state = EXCLUDED.preferred_state,
            preferred_city = EXCLUDED.preferred_city,
            confidence_score = EXCLUDED.confidence_score,
            session_id = EXCLUDED.session_id,
            last_updated = EXCLUDED.last_updated
          RETURNING *`,
          [
            userId,
            userLocation ? `${userLocation.city}, ${userLocation.regionName}, ${userLocation.country}` : null,
            null,
            proxyConfig.country,
            proxyConfig.state,
            proxyConfig.city,
            proxyConfig.confidence,
            proxyConfig.sessionId,
            new Date().toISOString()
          ]
        )

        if (insertedRows[0]) {
          effectivePrefs = insertedRows[0]
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
    // Authenticate with Firebase
    const { userId } = await verifyAuth(request)

    const { preferred_country, preferred_state, preferred_city } = await request.json()

    const normalizedCountry = typeof preferred_country === 'string'
      ? preferred_country.toLowerCase()
      : null

    if (!normalizedCountry) {
      return NextResponse.json({ error: 'preferred_country is required' }, { status: 400 })
    }

    console.log('🌍 Updating proxy preferences for user:', userId, {
      preferred_country: normalizedCountry,
      preferred_state,
      preferred_city
    })

    // Generate new session ID for proxy rotation
    const sessionId = `${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`

    // Update or create proxy preferences
    const { rows } = await pool.query(
      `INSERT INTO user_proxy_preferences (
        user_id, preferred_country, preferred_state, preferred_city,
        session_id, is_manual_selection, is_auto_assigned, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO UPDATE SET
        preferred_country = EXCLUDED.preferred_country,
        preferred_state = EXCLUDED.preferred_state,
        preferred_city = EXCLUDED.preferred_city,
        session_id = EXCLUDED.session_id,
        is_manual_selection = EXCLUDED.is_manual_selection,
        is_auto_assigned = EXCLUDED.is_auto_assigned,
        last_updated = EXCLUDED.last_updated
      RETURNING *`,
      [
        userId,
        normalizedCountry,
        preferred_state ? String(preferred_state).toLowerCase() : null,
        preferred_city || null,
        sessionId,
        true,
        false,
        new Date().toISOString()
      ]
    )

    const updatedPrefs = rows[0]

    if (!updatedPrefs) {
      console.error('❌ Error updating proxy preferences')
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
