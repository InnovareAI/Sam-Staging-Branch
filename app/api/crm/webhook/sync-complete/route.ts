/**
 * CRM Sync Complete Webhook
 * Receives completion status from N8N after syncing SAM → CRM
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SyncCompleteRequest {
  workspace_id: string;
  entity_type: 'contact' | 'company' | 'deal';
  entity_id: string;
  crm_type: string;
  status: 'success' | 'failed';
  crm_record_id?: string;
  error?: string;
  synced_at: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = request.headers.get('x-n8n-webhook-secret');
    if (webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SyncCompleteRequest = await request.json();
    const {
      workspace_id,
      entity_type,
      entity_id,
      crm_type,
      status,
      crm_record_id,
      error,
      synced_at
    } = body;

    if (!workspace_id || !entity_type || !entity_id || !crm_type || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create or update CRM mapping
    if (status === 'success' && crm_record_id) {
      const mappingData = {
        workspace_id,
        crm_type,
        sam_contact_id: entity_id,
        crm_contact_id: crm_record_id,
        sam_updated_at: synced_at,
        crm_updated_at: synced_at,
        last_sync_status: 'success',
        updated_at: new Date().toISOString()
      };

      // Upsert mapping
      const { error: mappingError } = await supabase
        .from('crm_contact_mappings')
        .upsert(mappingData, {
          onConflict: 'workspace_id,crm_type,sam_contact_id'
        });

      if (mappingError) {
        console.error('Error creating CRM mapping:', mappingError);
      }

      // Update contact with CRM sync status
      await supabase
        .from('contacts')
        .update({
          crm_synced: true,
          crm_sync_status: 'synced',
          crm_last_synced_at: synced_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', entity_id);
    } else if (status === 'failed') {
      // Update contact with error status
      await supabase
        .from('contacts')
        .update({
          crm_synced: false,
          crm_sync_status: 'error',
          crm_sync_error: error || 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', entity_id);

      // Update mapping status if it exists
      await supabase
        .from('crm_contact_mappings')
        .update({
          last_sync_status: 'failed',
          last_sync_error: error || 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('workspace_id', workspace_id)
        .eq('sam_contact_id', entity_id);
    }

    // Log the sync completion
    const { error: logError } = await supabase
      .from('crm_sync_logs')
      .insert({
        workspace_id,
        entity_type,
        operation: 'sync_to_crm',
        sync_type: 'webhook',
        status,
        records_processed: 1,
        records_succeeded: status === 'success' ? 1 : 0,
        records_failed: status === 'failed' ? 1 : 0,
        error_details: error ? { error } : null,
        completed_at: synced_at,
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging sync completion:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Sync completion recorded',
      workspace_id,
      entity_id,
      status
    });

  } catch (error) {
    console.error('❌ Sync complete webhook error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
