import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * Cron Job: System Health Monitor
 * 
 * Runs every 5-15 minutes to monitor system vitals:
 * 1. Supabase/Database connectivity
 * 2. Unipile API availability
 * 3. ReachInbox API availability
 * 
 * Logs results to system_health_logs table.
 */

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // Security: Verify cron secret
        const cronSecret = request.headers.get('x-cron-secret');
        if (cronSecret !== process.env.CRON_SECRET) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🩺 Starting System Health Monitor...');

        const healthResults = [];

        // 1. Check Database (Supabase)
        const dbStart = Date.now();
        try {
            const { data, error } = await supabase.from('workspaces').select('id').limit(1);
            const dbDuration = Date.now() - dbStart;

            await supabase.rpc('log_system_health', {
                p_component: 'database',
                p_status: error ? 'unhealthy' : 'healthy',
                p_response_time_ms: dbDuration,
                p_error_message: error ? error.message : null
            });

            healthResults.push({ component: 'database', status: error ? 'unhealthy' : 'healthy', time: dbDuration });
        } catch (dbError) {
            console.error('❌ DB Health Check failed:', dbError);
        }

        // 2. Check Unipile API
        const unipileStart = Date.now();
        try {
            const unipileResponse = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/ping`, {
                headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY || '' }
            });
            const unipileDuration = Date.now() - unipileStart;

            await supabase.rpc('log_system_health', {
                p_component: 'unipile',
                p_status: unipileResponse.ok ? 'healthy' : 'degraded',
                p_response_time_ms: unipileDuration,
                p_error_message: unipileResponse.ok ? null : `Status: ${unipileResponse.status}`
            });

            healthResults.push({ component: 'unipile', status: unipileResponse.ok ? 'healthy' : 'degraded', time: unipileDuration });
        } catch (unipileError) {
            await supabase.rpc('log_system_health', {
                p_component: 'unipile',
                p_status: 'unhealthy',
                p_error_message: String(unipileError)
            });
        }

        // 3. Check ReachInbox API
        const reachStart = Date.now();
        try {
            const reachResponse = await fetch(`https://api.reachinbox.ai/v1/health`, {
                headers: { 'Authorization': `Bearer ${process.env.REACHINBOX_API_KEY}` }
            });
            const reachDuration = Date.now() - reachStart;

            await supabase.rpc('log_system_health', {
                p_component: 'reachinbox',
                p_status: reachResponse.ok ? 'healthy' : 'degraded',
                p_response_time_ms: reachDuration,
                p_error_message: reachResponse.ok ? null : `Status: ${reachResponse.status}`
            });

            healthResults.push({ component: 'reachinbox', status: reachResponse.ok ? 'healthy' : 'degraded', time: reachDuration });
        } catch (reachError) {
            await supabase.rpc('log_system_health', {
                p_component: 'reachinbox',
                p_status: 'unhealthy',
                p_error_message: String(reachError)
            });
        }

        const totalDuration = Date.now() - startTime;
        console.log(`✅ Health check completed in ${totalDuration}ms`);

        return NextResponse.json({
            success: true,
            results: healthResults,
            total_duration_ms: totalDuration
        });

    } catch (error) {
        console.error('❌ Health monitor error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
