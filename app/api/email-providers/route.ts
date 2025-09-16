import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { EmailIntegrationService } from '@/lib/services/email-integration'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get user's email providers
    const { data: providers, error: fetchError } = await supabase
      .from('email_providers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('❌ Failed to fetch email providers:', fetchError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch providers'
      }, { status: 500 })
    }

    // Get supported providers
    const emailService = new EmailIntegrationService()
    const supportedProviders = emailService.getSupportedProviders()

    return NextResponse.json({
      success: true,
      providers: providers || [],
      supportedProviders,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to get email providers:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider_type, provider_name, email_address, config } = body

    if (!provider_type || !provider_name || !email_address) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: provider_type, provider_name, email_address'
      }, { status: 400 })
    }

    const supabase = createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Insert new email provider
    const { data: provider, error: insertError } = await supabase
      .from('email_providers')
      .insert({
        user_id: user.id,
        provider_type,
        provider_name,
        email_address,
        status: 'disconnected',
        config: config || {}
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to create email provider:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create provider'
      }, { status: 500 })
    }

    console.log(`✅ Created email provider: ${provider_type} (${email_address})`)

    return NextResponse.json({
      success: true,
      provider,
      message: 'Email provider created successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to create email provider:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}