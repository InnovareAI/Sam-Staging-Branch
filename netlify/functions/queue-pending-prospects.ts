import type { Config, Context } from '@netlify/functions';

/**
 * Netlify Scheduled Function - Queue Pending Prospects
 * Runs every 5 minutes to catch campaigns with unqueued prospects
 */

export default async (req: Request, context: Context) => {
  const cronSecret = process.env.CRON_SECRET;

  // Get production URL from environment or default
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

  console.log('🔄 Triggering queue-pending-prospects cron...');

  try {
    const response = await fetch(`${baseUrl}/api/cron/queue-pending-prospects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret || ''
      }
    });

    const result = await response.json();
    console.log('✅ Cron result:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('❌ Cron trigger failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Run every 5 minutes
export const config: Config = {
  schedule: '*/5 * * * *'
};
