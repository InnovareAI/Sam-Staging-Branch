import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAuth(request);
        if (!auth.isAuthenticated || !auth.user) {
            return NextResponse.json({
                success: false,
                error: 'Authentication required'
            }, { status: 401 })
        }

        const user = auth.user;

        const res = await pool.query(
            'UPDATE sam_conversation_threads SET status = $1 WHERE user_id = $2 AND status = $3',
            ['archived', user.uid, 'active']
        );

        return NextResponse.json({
            success: true,
            count: res.rowCount,
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
