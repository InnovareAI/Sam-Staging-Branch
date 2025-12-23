import { NextRequest, NextResponse } from 'next/server';

/**
 * Cron Job: Extract Conversation Insights
 * 
 * Periodically reviews recent SAM conversations and extracts business insights
 * (knowledge gaps, competitors, customer pain points) to update the Knowledge Base.
 * 
 * Runs via: GET /api/cron/extract-conversation-insights
 * Header: x-cron-secret
 */

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Security check
        const cronSecret = request.headers.get('x-cron-secret');
        if (cronSecret !== process.env.CRON_SECRET) {
            console.error('❌ Invalid cron secret for insight extraction');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🤖 Starting automated conversation insight extraction...');

        // Call the internal bulk analysis endpoint
        // We use the full URL to ensure it reaches the correct environment
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const insightApiUrl = `${baseUrl}/api/knowledge-base/extract-conversation-insights?limit=20`;

        const response = await fetch(insightApiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Optional: pass the secret if the target endpoint also checks it
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Insight extraction API failed:', errorText);
            throw new Error(`API failed: ${response.status} ${response.statusText}`);
        }

        const results = await response.json();
        const duration = Date.now() - startTime;

        console.log(`✅ Insight extraction completed in ${duration}ms. Processed: ${results.processedCount || 0}`);

        return NextResponse.json({
            success: true,
            processed_count: results.processedCount || 0,
            details: results.results || [],
            execution_time_ms: duration
        });

    } catch (error) {
        console.error('❌ Cron insight extraction failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
