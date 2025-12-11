import type { Config, Context } from '@netlify/functions';

/**
 * Netlify Scheduled Function: Generate Follow-Up Drafts
 *
 * Runs every hour to find prospects due for follow-up
 * and generate AI-powered drafts for HITL approval.
 *
 * Schedule: Every hour at minute 15 (e.g., 9:15, 10:15, 11:15)
 */

export default async (req: Request, context: Context) => {
  console.log('⏰ Scheduled: generate-follow-up-drafts');

  const baseUrl = process.env.URL || 'https://app.meet-sam.com';

  try {
    const response = await fetch(`${baseUrl}/api/cron/generate-follow-up-drafts`, {
      method: 'POST',
      headers: {
        'x-cron-secret': process.env.CRON_SECRET || '',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('✅ Result:', JSON.stringify(data, null, 2));

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  // Run every hour at minute 15
  schedule: '15 * * * *'
};
