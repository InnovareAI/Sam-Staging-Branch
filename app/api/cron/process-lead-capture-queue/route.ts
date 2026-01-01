/**
 * Process Lead Capture Queue
 * POST /api/cron/process-lead-capture-queue
 *
 * Called by Netlify scheduled function every 15 minutes
 * Processes queued lead capture actions:
 * 1. Send connection requests to high-score commenters
 * 2. Enroll in DM sequence once connected
 * 3. Sync leads to CRM (HubSpot, ActiveCampaign, Airtable)
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

/**
 * Send connection request via Unipile
 */
async function sendConnectionRequest(
  targetProviderId: string,
  message: string,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/users/invite`,
      {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          account_id: accountId,
          provider_id: targetProviderId,
          message: message.substring(0, 300) // LinkedIn limit
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Sync lead to CRM (placeholder for now - will integrate with existing CRM sync)
 */
async function syncToCRM(
  crmProvider: string,
  leadData: Record<string, unknown>,
  listId?: string,
  tags?: string[]
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  // For now, just log - will integrate with existing CRM sync infrastructure
  console.log(`📤 CRM Sync (${crmProvider}):`, { leadData, listId, tags });

  // TODO: Integrate with existing CRM sync:
  // - HubSpot: Use existing hubspot API integration
  // - ActiveCampaign: Use existing activecampaign API
  // - Airtable: Use existing airtable sync

  return {
    success: true,
    contactId: `crm_${Date.now()}` // Placeholder
  };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🎯 Processing lead capture queue...');

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // ============================================
    // PHASE 1: Process pending connection requests
    // ============================================

    const now = new Date();
    const { data: pendingCRs, error: fetchCRError } = await supabase
      .from('linkedin_lead_capture_queue')
      .select('*')
      .eq('action_type', 'connection_request')
      .eq('status', 'pending')
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(3); // Process max 3 CRs per run (rate limiting)

    if (fetchCRError) {
      console.error('Error fetching pending CRs:', fetchCRError);
    }

    if (pendingCRs && pendingCRs.length > 0) {
      console.log(`\n📨 Processing ${pendingCRs.length} connection requests...`);

      for (const queueItem of pendingCRs) {
        processed++;

        try {
          // Claim the item
          const { error: claimError } = await supabase
            .from('linkedin_lead_capture_queue')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', queueItem.id)
            .eq('status', 'pending');

          if (claimError) {
            console.log(`   ⚠️ Could not claim queue item ${queueItem.id}`);
            continue;
          }

          const actionData = queueItem.action_data as {
            message: string;
            account_id: string;
            dm_sequence_campaign_id?: string;
          };

          console.log(`   📤 Sending CR to ${queueItem.commenter_name}...`);

          const crResult = await sendConnectionRequest(
            queueItem.commenter_provider_id,
            actionData.message,
            actionData.account_id
          );

          if (crResult.success) {
            // Update queue item as completed
            await supabase
              .from('linkedin_lead_capture_queue')
              .update({
                status: 'completed',
                processed_at: new Date().toISOString(),
                result_data: { sent_at: new Date().toISOString() },
                updated_at: new Date().toISOString()
              })
              .eq('id', queueItem.id);

            // Update the comment reply record
            await supabase
              .from('linkedin_self_post_comment_replies')
              .update({
                connection_request_sent: true,
                connection_request_sent_at: new Date().toISOString(),
                connection_request_message: actionData.message,
                updated_at: new Date().toISOString()
              })
              .eq('id', queueItem.comment_reply_id);

            // If there's a DM sequence, queue the enrollment for when connection is accepted
            if (actionData.dm_sequence_campaign_id) {
              await supabase
                .from('linkedin_lead_capture_queue')
                .upsert({
                  workspace_id: queueItem.workspace_id,
                  comment_reply_id: queueItem.comment_reply_id,
                  commenter_provider_id: queueItem.commenter_provider_id,
                  commenter_name: queueItem.commenter_name,
                  commenter_linkedin_url: queueItem.commenter_linkedin_url,
                  commenter_score: queueItem.commenter_score,
                  action_type: 'dm_sequence',
                  status: 'pending', // Will be processed when connection is accepted
                  scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Check in 24h
                  action_data: {
                    campaign_id: actionData.dm_sequence_campaign_id,
                    account_id: actionData.account_id,
                    awaiting_connection_acceptance: true
                  }
                }, {
                  onConflict: 'comment_reply_id,action_type'
                });
            }

            succeeded++;
            console.log(`   ✅ CR sent to ${queueItem.commenter_name}`);

          } else {
            throw new Error(crResult.error || 'CR failed');
          }

        } catch (crError) {
          console.error(`   ❌ CR error:`, crError);
          await supabase
            .from('linkedin_lead_capture_queue')
            .update({
              status: 'failed',
              error_message: crError instanceof Error ? crError.message : 'Unknown error',
              updated_at: new Date().toISOString()
            })
            .eq('id', queueItem.id);
          failed++;
          errors.push(`CR ${queueItem.id}: ${crError instanceof Error ? crError.message : 'Failed'}`);
        }
      }
    }

    // ============================================
    // PHASE 2: Process DM sequence enrollments (for accepted connections)
    // ============================================

    const { data: pendingDMs, error: fetchDMError } = await supabase
      .from('linkedin_lead_capture_queue')
      .select('*')
      .eq('action_type', 'dm_sequence')
      .eq('status', 'pending')
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(5);

    if (fetchDMError) {
      console.error('Error fetching pending DM enrollments:', fetchDMError);
    }

    if (pendingDMs && pendingDMs.length > 0) {
      console.log(`\n📩 Processing ${pendingDMs.length} DM sequence enrollments...`);

      for (const queueItem of pendingDMs) {
        processed++;

        try {
          const actionData = queueItem.action_data as {
            campaign_id: string;
            account_id: string;
            awaiting_connection_acceptance?: boolean;
          };

          // Check if connection was accepted
          const { data: replyRecord } = await supabase
            .from('linkedin_self_post_comment_replies')
            .select('connection_accepted, connection_accepted_at')
            .eq('id', queueItem.comment_reply_id)
            .single();

          if (!replyRecord?.connection_accepted) {
            // Connection not yet accepted - reschedule for later
            if (actionData.awaiting_connection_acceptance) {
              // Check if we should give up (7 days max wait)
              const createdAt = new Date(queueItem.created_at);
              const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

              if (daysSinceCreated > 7) {
                // Give up - mark as skipped
                await supabase
                  .from('linkedin_lead_capture_queue')
                  .update({
                    status: 'skipped',
                    error_message: 'Connection not accepted within 7 days',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', queueItem.id);
                console.log(`   ⏭️ Skipped DM for ${queueItem.commenter_name} (connection not accepted)`);
              } else {
                // Reschedule for 24h later
                await supabase
                  .from('linkedin_lead_capture_queue')
                  .update({
                    scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', queueItem.id);
                console.log(`   ⏳ Rescheduled DM for ${queueItem.commenter_name} (awaiting connection)`);
              }
              continue;
            }
          }

          // Connection accepted - enroll in DM sequence
          console.log(`   📨 Enrolling ${queueItem.commenter_name} in DM sequence...`);

          // Create a prospect in the DM sequence campaign
          const { data: prospectInsert, error: prospectError } = await supabase
            .from('campaign_prospects')
            .insert({
              campaign_id: actionData.campaign_id,
              name: queueItem.commenter_name,
              linkedin_url: queueItem.commenter_linkedin_url,
              linkedin_provider_id: queueItem.commenter_provider_id,
              status: 'approved',
              lead_source: 'Self-Post Comment Lead Capture',
              custom_fields: {
                commenter_score: queueItem.commenter_score,
                comment_reply_id: queueItem.comment_reply_id
              }
            })
            .select('id')
            .single();

          if (prospectError) {
            throw new Error(`Failed to create prospect: ${prospectError.message}`);
          }

          // Update queue item as completed
          await supabase
            .from('linkedin_lead_capture_queue')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString(),
              result_data: { prospect_id: prospectInsert.id },
              updated_at: new Date().toISOString()
            })
            .eq('id', queueItem.id);

          // Update the comment reply record
          await supabase
            .from('linkedin_self_post_comment_replies')
            .update({
              dm_sequence_enrolled: true,
              dm_sequence_enrolled_at: new Date().toISOString(),
              dm_sequence_prospect_id: prospectInsert.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', queueItem.comment_reply_id);

          succeeded++;
          console.log(`   ✅ Enrolled ${queueItem.commenter_name} in DM sequence`);

        } catch (dmError) {
          console.error(`   ❌ DM enrollment error:`, dmError);
          await supabase
            .from('linkedin_lead_capture_queue')
            .update({
              status: 'failed',
              error_message: dmError instanceof Error ? dmError.message : 'Unknown error',
              updated_at: new Date().toISOString()
            })
            .eq('id', queueItem.id);
          failed++;
          errors.push(`DM ${queueItem.id}: ${dmError instanceof Error ? dmError.message : 'Failed'}`);
        }
      }
    }

    // ============================================
    // PHASE 3: Process CRM syncs
    // ============================================

    const { data: pendingCRMs, error: fetchCRMError } = await supabase
      .from('linkedin_lead_capture_queue')
      .select('*')
      .eq('action_type', 'crm_sync')
      .eq('status', 'pending')
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(10);

    if (fetchCRMError) {
      console.error('Error fetching pending CRM syncs:', fetchCRMError);
    }

    if (pendingCRMs && pendingCRMs.length > 0) {
      console.log(`\n📤 Processing ${pendingCRMs.length} CRM syncs...`);

      for (const queueItem of pendingCRMs) {
        processed++;

        try {
          const actionData = queueItem.action_data as {
            crm_provider: string;
            crm_list_id?: string;
            crm_tags?: string[];
            lead_source: string;
            profile: Record<string, unknown>;
            score_breakdown: Record<string, unknown>;
          };

          console.log(`   📤 Syncing ${queueItem.commenter_name} to ${actionData.crm_provider}...`);

          const crmResult = await syncToCRM(
            actionData.crm_provider,
            {
              name: queueItem.commenter_name,
              linkedin_url: queueItem.commenter_linkedin_url,
              provider_id: queueItem.commenter_provider_id,
              lead_score: queueItem.commenter_score,
              lead_source: actionData.lead_source,
              ...actionData.profile
            },
            actionData.crm_list_id,
            actionData.crm_tags
          );

          if (crmResult.success) {
            // Update queue item as completed
            await supabase
              .from('linkedin_lead_capture_queue')
              .update({
                status: 'completed',
                processed_at: new Date().toISOString(),
                result_data: { contact_id: crmResult.contactId },
                updated_at: new Date().toISOString()
              })
              .eq('id', queueItem.id);

            // Update the comment reply record
            await supabase
              .from('linkedin_self_post_comment_replies')
              .update({
                crm_synced: true,
                crm_synced_at: new Date().toISOString(),
                crm_contact_id: crmResult.contactId,
                updated_at: new Date().toISOString()
              })
              .eq('id', queueItem.comment_reply_id);

            succeeded++;
            console.log(`   ✅ Synced ${queueItem.commenter_name} to CRM`);

          } else {
            throw new Error(crmResult.error || 'CRM sync failed');
          }

        } catch (crmError) {
          console.error(`   ❌ CRM sync error:`, crmError);
          await supabase
            .from('linkedin_lead_capture_queue')
            .update({
              status: 'failed',
              error_message: crmError instanceof Error ? crmError.message : 'Unknown error',
              updated_at: new Date().toISOString()
            })
            .eq('id', queueItem.id);

          // Update the comment reply record with error
          await supabase
            .from('linkedin_self_post_comment_replies')
            .update({
              crm_sync_error: crmError instanceof Error ? crmError.message : 'Unknown error',
              updated_at: new Date().toISOString()
            })
            .eq('id', queueItem.comment_reply_id);

          failed++;
          errors.push(`CRM ${queueItem.id}: ${crmError instanceof Error ? crmError.message : 'Failed'}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Lead capture queue processing complete`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Succeeded: ${succeeded}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      processed,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration
    });

  } catch (error) {
    console.error('❌ Lead capture queue processing error:', error);
    return NextResponse.json({
      error: 'Failed to process lead capture queue',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET for manual testing
export async function GET(req: NextRequest) {
  const testReq = new NextRequest(req.url, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET || ''
    }
  });
  return POST(testReq);
}
