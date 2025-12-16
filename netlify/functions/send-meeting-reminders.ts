/**
 * Netlify Scheduled Function: Send Meeting Reminders
 * Runs every 5 minutes to send 24h, 1h, 15m reminders
 */

import type { Config, Context } from '@netlify/functions';

export const config: Config = {
  schedule: '*/5 * * * *', // Every 5 minutes
};

export default async function handler(req: Request, context: Context) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';
  const CRON_SECRET = process.env.CRON_SECRET;

  try {
    const response = await fetch(`${APP_URL}/api/cron/send-meeting-reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET || '',
      },
    });

    const result = await response.json();

    console.log('Meeting reminders result:', result);

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error sending meeting reminders:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
