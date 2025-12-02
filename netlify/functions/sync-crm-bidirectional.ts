/**
 * Netlify Scheduled Function: Bi-directional CRM Sync
 *
 * Runs every 15 minutes to sync data between SAM and connected CRMs
 * - Fetches updates from CRMs (HubSpot, ActiveCampaign, Airtable, etc.)
 * - Syncs to SAM database
 * - Detects and resolves conflicts
 * - Uses N8N MCP workflows for actual API calls
 *
 * Schedule: every 15 minutes (cron: 0,15,30,45 * * * *)
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('🔄 CRM Bi-directional Sync scheduled function triggered');
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const apiUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not set');
      return { statusCode: 500, body: JSON.stringify({ error: 'CRON_SECRET not configured' }) };
    }

    console.log(`📨 Calling: ${apiUrl}/api/cron/sync-crm-bidirectional`);

    const response = await fetch(`${apiUrl}/api/cron/sync-crm-bidirectional`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret
      }
    });

    const result = await response.json();

    console.log('✅ CRM Sync result:', {
      status: response.status,
      workspacesProcessed: result.workspacesProcessed,
      contactsSynced: result.contactsSynced,
      conflictsResolved: result.conflictsResolved,
      errors: result.errors?.length || 0,
      duration_ms: result.duration_ms
    });

    return { statusCode: response.status, body: JSON.stringify(result) };

  } catch (error) {
    console.error('❌ CRM Sync error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'CRM Sync failed',
        details: error instanceof Error ? error.message : 'Unknown'
      })
    };
  }
};

export { handler };
