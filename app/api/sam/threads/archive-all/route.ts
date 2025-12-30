import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const supabase = createRouteHandlerClient({ cookies: cookies })
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({
                success: false,
                error: 'Authentication required'
            }, { status: 401 })
        }

        const { error } = await supabase
            .from('sam_conversation_threads')
            .update({ status: 'archived' })
            .eq('user_id', user.id)
            .eq('status', 'active')

        if (error) {
            console.error('Failed to archive all threads:', error)
            return NextResponse.json({
                success: false,
                error: 'Failed to archive threads'
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'All active threads archived'
        })

    } catch (error) {
        console.error('Archive all API error:', error)
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 })
    }
}
