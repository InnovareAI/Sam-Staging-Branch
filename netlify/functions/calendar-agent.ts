/**
 * Netlify Scheduled Function: Calendar Agent
 *
 * Full meeting lifecycle: booking, reminders, no-show handling, follow-ups
 *
 * Runs every 2 hours
 * Schedule: "0 *\/2 * * *" (see netlify.toml)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
    console.log('📅 Netlify scheduled function triggered: calendar-agent');
    console.log(`   Time: ${new Date().toISOString()}`);

    try {
        const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error('❌ CRON_SECRET not set in environment');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'CRON_SECRET not configured' })
            };
        }

        console.log(`📧 Calling: ${apiUrl}/api/cron/calendar-agent`);

        const response = await fetch(`${apiUrl}/api/cron/calendar-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': cronSecret,
                'x-netlify-scheduled': 'true'
            }
        });

        const result = await response.json();

        console.log('✅ Calendar agent result:', {
            status: response.status,
            followUpTriggersProcessed: result.followUpTriggersProcessed,
            prospectCalendarsProcessed: result.prospectCalendarsProcessed,
            message: result.message
        });

        return {
            statusCode: response.status,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('❌ Calendar agent scheduled function error:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Calendar agent failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};

export { handler };
