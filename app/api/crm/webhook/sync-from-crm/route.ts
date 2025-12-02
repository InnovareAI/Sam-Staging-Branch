/**
 * CRM → SAM Sync Webhook
 * Receives contact updates from N8N after fetching from CRM
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Contact {
  crm_id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  lastModified?: string;
}

interface SyncFromCRMRequest {
  workspace_id: string;
  crm_type: string;
  contacts: Contact[];
  sync_type: 'scheduled' | 'manual';
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

    const body: SyncFromCRMRequest = await request.json();
    const { workspace_id, crm_type, contacts, sync_type } = body;

    if (!workspace_id || !crm_type || !contacts) {
      return NextResponse.json(
        { error: 'Missing required fields: workspace_id, crm_type, contacts' },
        { status: 400 }
      );
    }

    // Get CRM connection to map crm_id to sam contact_id
    const { data: connection } = await supabase
      .from('crm_connections')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('crm_type', crm_type)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'CRM connection not found' },
        { status: 404 }
      );
    }

    let successCount = 0;
    let failureCount = 0;
    const errors: any[] = [];

    // Process each contact
    for (const contact of contacts) {
      try {
        // Check if contact already exists in SAM (by crm_id mapping)
        const { data: existingMapping } = await supabase
          .from('crm_contact_mappings')
          .select('sam_contact_id, sam_updated_at')
          .eq('workspace_id', workspace_id)
          .eq('crm_type', crm_type)
          .eq('crm_contact_id', contact.crm_id)
          .single();

        if (existingMapping) {
          // Contact exists - check for conflicts
          const { data: samContact } = await supabase
            .from('contacts')
            .select('updated_at')
            .eq('id', existingMapping.sam_contact_id)
            .single();

          const crmUpdatedAt = new Date(contact.lastModified || 0);
          const samUpdatedAt = new Date(samContact?.updated_at || 0);
          const lastSyncedAt = new Date(existingMapping.sam_updated_at || 0);

          // Check if both were updated since last sync (conflict)
          if (samUpdatedAt > lastSyncedAt && crmUpdatedAt > lastSyncedAt) {
            // Conflict detected - trigger conflict resolution workflow
            await fetch(`${process.env.N8N_WEBHOOK_BASE_URL}/webhook/crm-conflict-resolution`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                workspace_id,
                crm_type,
                entity_type: 'contact',
                entity_id: contact.crm_id,
                crm_record_id: contact.crm_id,
                sam_record_id: existingMapping.sam_contact_id,
                crm_data: contact,
                sam_data: samContact
              })
            });

            successCount++;
            continue;
          }

          // No conflict - CRM is newer, update SAM contact
          const { error: updateError } = await supabase
            .from('contacts')
            .update({
              first_name: contact.firstName,
              last_name: contact.lastName,
              email: contact.email,
              phone: contact.phone,
              company: contact.company,
              job_title: contact.jobTitle,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingMapping.sam_contact_id);

          if (updateError) throw updateError;

          // Update mapping timestamp
          await supabase
            .from('crm_contact_mappings')
            .update({
              crm_updated_at: contact.lastModified,
              sam_updated_at: new Date().toISOString()
            })
            .eq('workspace_id', workspace_id)
            .eq('crm_contact_id', contact.crm_id);

          successCount++;
        } else {
          // New contact - create in SAM
          const { data: newContact, error: createError } = await supabase
            .from('contacts')
            .insert({
              workspace_id,
              first_name: contact.firstName,
              last_name: contact.lastName,
              email: contact.email,
              phone: contact.phone,
              company: contact.company,
              job_title: contact.jobTitle,
              source: `crm_${crm_type}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (createError) throw createError;

          // Create CRM mapping
          await supabase
            .from('crm_contact_mappings')
            .insert({
              workspace_id,
              crm_type,
              crm_contact_id: contact.crm_id,
              sam_contact_id: newContact.id,
              crm_updated_at: contact.lastModified,
              sam_updated_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            });

          successCount++;
        }
      } catch (contactError) {
        failureCount++;
        errors.push({
          contact_id: contact.crm_id,
          error: contactError instanceof Error ? contactError.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      workspace_id,
      crm_type,
      sync_type,
      records_processed: contacts.length,
      records_succeeded: successCount,
      records_failed: failureCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ CRM → SAM sync webhook error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
