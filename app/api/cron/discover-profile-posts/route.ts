/**
 * Cron Job: Discover posts from LinkedIn profiles
 * Recommended frequency: Twice daily
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const cronSecret = request.headers.get('x-cron-secret');
        if (cronSecret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('⏰ Starting scheduled profile post discovery...');

        // Trigger the discovery endpoint
        // We use the full URL if possible, or internal fetch
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/linkedin-commenting/discover-profile-posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Authentication is handled via supabaseAdmin inside the endpoint
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Discovery failed:', errorText);
            return NextResponse.json({ error: 'Discovery failed', details: errorText }, { status: 500 });
        }

        const data = await response.json();
        console.log('✅ Discovery complete:', data);

        return NextResponse.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('❌ Cron discovery error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
