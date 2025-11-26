/**
 * Netlify Scheduled Function: Poll Message Replies
 *
 * Backup for Unipile new_message webhook
 * Detects when prospects reply to stop follow-up sequences
 *
 * Runs every 2 hours (same as poll-accepted-connections)
 * Schedule: 0 */2 * * * (see netlify.toml)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('📨 Netlify scheduled function triggered: poll-message-replies');
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

    console.log(`📧 Calling: ${apiUrl}/api/cron/poll-message-replies`);

    const response = await fetch(`${apiUrl}/api/cron/poll-message-replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        'x-netlify-scheduled': 'true'
      }
    });

    const result = await response.json();

    console.log('✅ Poll message replies result:', {
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
    console.error('❌ Poll message replies scheduled function error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Poll message replies failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
