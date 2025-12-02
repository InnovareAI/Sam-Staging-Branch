/**
 * CRM Bi-directional Sync Cron Endpoint
 *
 * Called by Netlify scheduled function every 15 minutes
 * Syncs data between SAM and connected CRMs (HubSpot, ActiveCampaign, Airtable, etc.)
 * Uses N8N MCP workflows for actual API routing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Maximum duration for this endpoint (Netlify functions can run up to 10 seconds on free tier)
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.error('❌ Invalid CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting CRM bi-directional sync');

    // Get all active CRM connections
    const { data: connections, error: connectionsError } = await supabase
      .from('crm_connections')
      .select('id, workspace_id, crm_type, status, last_synced_at')
      .eq('status', 'active');

    if (connectionsError) {
      throw new Error(`Failed to fetch CRM connections: ${connectionsError.message}`);
    }

    if (!connections || connections.length === 0) {
      console.log('ℹ️  No active CRM connections found');
      return NextResponse.json({
        success: true,
        message: 'No active CRM connections',
        workspacesProcessed: 0,
        contactsSynced: 0,
        duration_ms: Date.now() - startTime
      });
    }

    console.log(`📊 Found ${connections.length} active CRM connections`);

    let totalContactsSynced = 0;
    let totalConflictsResolved = 0;
    const errors: any[] = [];

    // Process each workspace connection
    for (const connection of connections) {
      try {
        // Calculate since_timestamp (fetch contacts updated since last sync or last 1 hour)
        const lastSyncedAt = connection.last_synced_at
          ? new Date(connection.last_synced_at)
          : new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

        const sinceTimestamp = lastSyncedAt.toISOString();

        console.log(`🔄 Syncing workspace ${connection.workspace_id} (${connection.crm_type}) since ${sinceTimestamp}`);

        // Call N8N MCP workflow to fetch from CRM and sync to SAM
        // The N8N workflow will:
        // 1. Use HTTP Request + Switch to route to correct CRM API
        // 2. Fetch updated contacts
        // 3. Call SAM webhook /api/crm/webhook/sync-from-crm
        // 4. SAM webhook handles conflict detection and resolution
        const syncResponse = await fetch(
          `${process.env.N8N_WEBHOOK_BASE_URL}/webhook/mcp/crm-sync-from-crm`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-N8N-API-KEY': process.env.N8N_API_KEY || ''
            },
            body: JSON.stringify({
              workspace_id: connection.workspace_id,
              crm_type: connection.crm_type,
              since_timestamp: sinceTimestamp
            })
          }
        );

        if (!syncResponse.ok) {
          throw new Error(`N8N sync failed: ${syncResponse.status} ${syncResponse.statusText}`);
        }

        const syncResult = await syncResponse.json();

        // Update last_synced_at timestamp
        await supabase
          .from('crm_connections')
          .update({
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id);

        totalContactsSynced += syncResult.contacts_synced || 0;
        totalConflictsResolved += syncResult.conflicts_resolved || 0;

        console.log(`✅ Synced ${syncResult.contacts_synced || 0} contacts for ${connection.crm_type}`);

      } catch (workspaceError) {
        console.error(`❌ Error syncing workspace ${connection.workspace_id}:`, workspaceError);
        errors.push({
          workspace_id: connection.workspace_id,
          crm_type: connection.crm_type,
          error: workspaceError instanceof Error ? workspaceError.message : 'Unknown error'
        });

        // Update connection status to error
        await supabase
          .from('crm_connections')
          .update({
            status: 'error',
            error_message: workspaceError instanceof Error ? workspaceError.message : 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`✅ CRM sync complete: ${totalContactsSynced} contacts synced, ${totalConflictsResolved} conflicts resolved, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      workspacesProcessed: connections.length,
      contactsSynced: totalContactsSynced,
      conflictsResolved: totalConflictsResolved,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ CRM sync error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration
      },
      { status: 500 }
    );
  }
}
