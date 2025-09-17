import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { AutoIPAssignmentService } from '@/lib/services/auto-ip-assignment'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { linkedinProfileLocation, forceRegenerate = false } = body

    const supabase = supabaseAdmin()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const autoIPService = new AutoIPAssignmentService()

    // Detect user location from request headers
    const userLocation = await autoIPService.detectUserLocation(request)
    console.log('🌍 Detected user location:', userLocation)

    // Generate optimal proxy configuration
    const proxyConfig = await autoIPService.generateOptimalProxyConfig(
      userLocation || undefined,
      linkedinProfileLocation
    )

    console.log('✅ Generated proxy config:', {
      country: proxyConfig.country,
      state: proxyConfig.state,
      confidence: proxyConfig.confidence,
      sessionId: proxyConfig.sessionId
    })

    // Store user's proxy preference in database
    const { error: insertError } = await supabase
      .from('user_proxy_preferences')
      .upsert({
        user_id: user.id,
        detected_location: userLocation ? `${userLocation.city}, ${userLocation.regionName}, ${userLocation.country}` : null,
        linkedin_location: linkedinProfileLocation,
        preferred_country: proxyConfig.country,
        preferred_state: proxyConfig.state,
        preferred_city: proxyConfig.city,
        confidence_score: proxyConfig.confidence,
        session_id: proxyConfig.sessionId,
        last_updated: new Date().toISOString()
      })

    if (insertError) {
      console.error('❌ Failed to store proxy preference:', insertError)
    }

    // Test proxy connectivity (optional)
    let connectivityTest = null
    try {
      connectivityTest = await autoIPService.testProxyConnectivity(proxyConfig)
    } catch (testError) {
      console.warn('⚠️ Connectivity test failed:', testError)
    }

    return NextResponse.json({
      success: true,
      proxyConfig: {
        country: proxyConfig.country,
        state: proxyConfig.state,
        city: proxyConfig.city,
        confidence: proxyConfig.confidence,
        sessionId: proxyConfig.sessionId
      },
      userLocation,
      connectivityTest,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Auto IP assignment failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get user's current proxy preferences
    const { data: preferences, error: fetchError } = await supabase
      .from('user_proxy_preferences')
      .select('*')
      .eq('user_id', user.id)
      .order('last_updated', { ascending: false })
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Failed to fetch proxy preferences:', fetchError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch preferences'
      }, { status: 500 })
    }

    // Get available locations
    const autoIPService = new AutoIPAssignmentService()
    const availableLocations = autoIPService.getAvailableLocations()

    return NextResponse.json({
      success: true,
      currentPreferences: preferences || null,
      availableLocations,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to get proxy preferences:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { country, state, city } = body

    if (!country) {
      return NextResponse.json({
        success: false,
        error: 'Country is required'
      }, { status: 400 })
    }

    const supabase = supabaseAdmin()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const autoIPService = new AutoIPAssignmentService()

    // Generate session ID for new manual selection
    const sessionId = `manual_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`

    // Build proxy username with manual selection
    let username = `brd-customer-${process.env.BRIGHT_DATA_CUSTOMER_ID}-zone-residential`
    username += `-country-${country}`
    
    if (state) {
      username += `-state-${state}`
    }
    
    if (city) {
      username += `-city-${city}`
    }
    
    username += `-session-${sessionId}`

    const proxyConfig = {
      host: 'brd.superproxy.io',
      port: 22225,
      username,
      password: process.env.BRIGHT_DATA_RESIDENTIAL_PASSWORD!,
      country,
      state,
      city,
      sessionId,
      confidence: 1.0 // Manual selection has highest confidence
    }

    // Update user's proxy preference
    const { error: updateError } = await supabase
      .from('user_proxy_preferences')
      .upsert({
        user_id: user.id,
        preferred_country: country,
        preferred_state: state,
        preferred_city: city,
        confidence_score: 1.0,
        session_id: sessionId,
        is_manual_selection: true,
        last_updated: new Date().toISOString()
      })

    if (updateError) {
      console.error('❌ Failed to update proxy preference:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to save preferences'
      }, { status: 500 })
    }

    // Test connectivity for manual selection
    let connectivityTest = null
    try {
      connectivityTest = await autoIPService.testProxyConnectivity(proxyConfig)
    } catch (testError) {
      console.warn('⚠️ Connectivity test failed:', testError)
    }

    console.log(`✅ Manual proxy location updated: ${country}${state ? `/${state}` : ''}${city ? `/${city}` : ''}`)

    return NextResponse.json({
      success: true,
      proxyConfig: {
        country: proxyConfig.country,
        state: proxyConfig.state,
        city: proxyConfig.city,
        confidence: proxyConfig.confidence,
        sessionId: proxyConfig.sessionId
      },
      connectivityTest,
      message: `Proxy location manually set to ${country}${state ? ` (${state})` : ''}`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Manual proxy selection failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}