/**
 * Netlify Scheduled Function: Send Meeting Follow-ups
 * Runs every 15 minutes to send approved meeting follow-up drafts
 */

import type { Config, Context } from '@netlify/functions';

export const config: Config = {
  schedule: '*/15 * * * *', // Every 15 minutes
};

export default async function handler(req: Request, context: Context) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';
  const CRON_SECRET = process.env.CRON_SECRET;

  try {
    const response = await fetch(`${APP_URL}/api/cron/send-meeting-follow-ups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET || '',
      },
    });

    const result = await response.json();

    console.log('Meeting follow-ups result:', result);

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error sending meeting follow-ups:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
