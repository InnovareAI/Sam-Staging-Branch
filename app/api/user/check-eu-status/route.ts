import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

// Countries requiring DPA: EU + EEA + UK + Switzerland
const DPA_REQUIRED_COUNTRIES = [
  // EU 27
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA (non-EU): Iceland, Liechtenstein, Norway
  'IS', 'LI', 'NO',
  // UK (post-Brexit GDPR)
  'GB', 'UK',
  // Switzerland (similar data protection laws)
  'CH'
]

/**
 * GET /api/user/check-eu-status
 *
 * Check if user is from EU and if they need to sign DPA
 * Used during signup and upgrade flows
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's country from profile
    const { data: profile } = await supabase
      .from('users')
      .select('profile_country')
      .eq('id', user.id)
      .single()

    const isEu = profile?.profile_country &&
                 DPA_REQUIRED_COUNTRIES.includes(profile.profile_country.toUpperCase())

    // Check if DPA already signed for this workspace
    let hasSignedDpa = false
    if (isEu && workspaceId) {
      const { data: dpa } = await supabase
        .from('workspace_dpa_agreements')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'signed')
        .single()

      hasSignedDpa = !!dpa
    }

    return NextResponse.json({
      isEu,
      hasSignedDpa,
      country: profile?.profile_country
    })

  } catch (error) {
    console.error('EU status check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
