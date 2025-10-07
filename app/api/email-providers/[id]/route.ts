import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Provider ID is required'
      }, { status: 400 })
    }

    // Get current user - use the same pattern as other routes
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session || !session.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    const user = session.user

    // Delete the email provider (RLS will ensure user owns it)
    const { error: deleteError } = await supabase
      .from('email_providers')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this provider

    if (deleteError) {
      console.error('❌ Failed to delete email provider:', deleteError)
      return NextResponse.json({
        success: false,
        error: 'Failed to delete provider'
      }, { status: 500 })
    }

    console.log(`✅ Deleted email provider: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Email provider deleted successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to delete email provider:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
