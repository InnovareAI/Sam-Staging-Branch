import type { Config, Context } from '@netlify/functions';

/**
 * Netlify Scheduled Function: Send Approved Follow-Up Drafts
 *
 * Runs every 15 minutes to send follow-up drafts
 * that have been approved via the HITL workflow.
 *
 * Schedule: Every 15 minutes (0, 15, 30, 45)
 */

export default async (req: Request, context: Context) => {
  console.log('⏰ Scheduled: send-approved-follow-ups');

  const baseUrl = process.env.URL || 'https://app.meet-sam.com';

  try {
    const response = await fetch(`${baseUrl}/api/cron/send-approved-follow-ups`, {
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
  // Run every 15 minutes
  schedule: '*/15 * * * *'
};
