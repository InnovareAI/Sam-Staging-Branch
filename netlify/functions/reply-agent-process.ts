import type { Config, Context } from '@netlify/functions';

const CRON_SECRET = process.env.CRON_SECRET || '792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0';

export default async (req: Request, context: Context) => {
  const baseUrl = process.env.URL || 'https://app.meet-sam.com';

  try {
    console.log('[reply-agent-process] Starting cron job...');

    const response = await fetch(`${baseUrl}/api/cron/reply-agent-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET
      }
    });

    const result = await response.json();
    console.log('[reply-agent-process] Result:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[reply-agent-process] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Run every 5 minutes to check for new replies
export const config: Config = {
  schedule: '*/5 * * * *'
};
