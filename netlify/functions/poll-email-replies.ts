/**
 * Netlify Scheduled Function: Poll Email Replies
 *
 * Backup for email reply detection
 * Detects when prospects reply to emails to stop follow-up sequences
 * Triggers SAM Reply Agent for AI-generated response drafts
 *
 * Runs every 15 minutes
 * Schedule: "*/15 * * * *" (see netlify.toml)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📧 Netlify scheduled function triggered: poll-email-replies');
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

    console.log(`📧 Calling: ${apiUrl}/api/cron/poll-email-replies`);

    const response = await fetch(`${apiUrl}/api/cron/poll-email-replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Poll email replies result:', {
      status: response.status,
      checked: result.checked,
      replies_found: result.replies_found,
      message: result.message
    });

    return {
      statusCode: response.status,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ Poll email replies scheduled function error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Poll email replies failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
