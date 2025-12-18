import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase';
import { MESSAGE_HARD_LIMITS } from '@/lib/anti-detection/message-variance';
import { normalizeCompanyName } from '@/lib/prospect-normalization';

/**
 * PATCH /api/prospect-approval/sessions/update-campaign
 * Update campaign for an approval session
 *
 * IMPORTANT: When campaign_id is set and session has approved prospects,
 * this endpoint will transfer those prospects to campaign_prospects table.
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Use @supabase/ssr createServerClient (matches browser client)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const { session_id, campaign_name, campaign_id } = await request.json();

    if (!session_id) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 });
    }

    if (!campaign_name && !campaign_id) {
      return NextResponse.json({
        success: false,
        error: 'Campaign name or campaign ID required'
      }, { status: 400 });
    }

    // Get user's workspace using admin client to bypass RLS
    const adminClient = supabaseAdmin();
    const { data: userProfile } = await adminClient
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 404 });
    }

    // Verify session belongs to user's workspace
    const { data: session } = await supabase
      .from('prospect_approval_sessions')
      .select('workspace_id')
      .eq('id', session_id)
      .single();

    if (!session || session.workspace_id !== workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'Session not found or access denied'
      }, { status: 403 });
    }

    // Build update object with provided fields
    const updateData: { campaign_name?: string; campaign_id?: string } = {};
    if (campaign_name) updateData.campaign_name = campaign_name;
    if (campaign_id) updateData.campaign_id = campaign_id;

    // Update session
    const { error: updateError } = await supabase
      .from('prospect_approval_sessions')
      .update(updateData)
      .eq('id', session_id);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to update session'
      }, { status: 500 });
    }

    console.log(`✅ Updated session ${session_id}:`, updateData);

    // AUTO-TRANSFER: If campaign_id was just set, transfer any already-approved prospects
    let transferredCount = 0;
    let queuedCount = 0;

    if (campaign_id) {
      console.log(`📦 Checking for approved prospects to transfer to campaign ${campaign_id}`);

      // Get all approved decisions for this session
      const { data: approvedDecisions } = await adminClient
        .from('prospect_approval_decisions')
        .select('prospect_id')
        .eq('session_id', session_id)
        .eq('decision', 'approved');

      if (approvedDecisions && approvedDecisions.length > 0) {
        const approvedProspectIds = approvedDecisions.map(d => d.prospect_id);
        console.log(`📦 Found ${approvedProspectIds.length} approved prospects to transfer`);

        // Get the prospect data
        const { data: prospectData } = await adminClient
          .from('prospect_approval_data')
          .select('*')
          .in('prospect_id', approvedProspectIds);

        // Get existing prospects in campaign to avoid duplicates
        const { data: existingCampaignProspects } = await adminClient
          .from('campaign_prospects')
          .select('linkedin_url')
          .eq('campaign_id', campaign_id);

        const existingUrls = new Set(
          (existingCampaignProspects || [])
            .map(p => p.linkedin_url?.toLowerCase())
            .filter(Boolean)
        );

        // Prepare new campaign prospects
        const newCampaignProspects = [];
        for (const p of prospectData || []) {
          const linkedinUrl = p.contact?.linkedin_url;
          if (!linkedinUrl) continue;
          if (existingUrls.has(linkedinUrl.toLowerCase())) continue;

          const nameParts = (p.name || '').split(' ');
          newCampaignProspects.push({
            campaign_id: campaign_id,
            workspace_id: workspaceId,
            first_name: nameParts[0] || 'Unknown',
            last_name: nameParts.slice(1).join(' ') || '',
            title: p.title || '',
            company_name: p.company?.name || '',
            linkedin_url: linkedinUrl,
            linkedin_user_id: linkedinUrl,
            email: p.contact?.email || null,
            status: 'approved'
          });
        }

        // Insert in batches
        if (newCampaignProspects.length > 0) {
          for (let i = 0; i < newCampaignProspects.length; i += 50) {
            const batch = newCampaignProspects.slice(i, i + 50);
            const { error: insertError } = await adminClient
              .from('campaign_prospects')
              .insert(batch);

            if (insertError) {
              console.error('Error inserting campaign prospects batch:', insertError.message);
            } else {
              transferredCount += batch.length;
            }
          }
          console.log(`✅ Transferred ${transferredCount} prospects to campaign_prospects`);

          // AUTO-QUEUE: Get campaign template and add to send_queue if campaign is active
          const { data: campaign } = await adminClient
            .from('campaigns')
            .select('message_templates, status, linkedin_account_id')
            .eq('id', campaign_id)
            .single();

          if (campaign?.status === 'active' && campaign?.linkedin_account_id) {
            const connectionMessage = campaign.message_templates?.connection_request || '';

            if (connectionMessage) {
              // Get newly inserted prospects
              const { data: insertedProspects } = await adminClient
                .from('campaign_prospects')
                .select('id, first_name, company_name, title, linkedin_url, linkedin_user_id')
                .eq('campaign_id', campaign_id)
                .eq('status', 'approved');

              // Get existing queue to avoid duplicates
              const { data: existingQueue } = await adminClient
                .from('send_queue')
                .select('prospect_id')
                .eq('campaign_id', campaign_id);

              const queuedProspectIds = new Set((existingQueue || []).map(q => q.prospect_id));
              const prospectsToQueue = (insertedProspects || []).filter(p => !queuedProspectIds.has(p.id));

              if (prospectsToQueue.length > 0) {
                let currentTime = new Date();
                currentTime.setMinutes(currentTime.getMinutes() + 30); // Start 30 min from now

                const gapMinutes = MESSAGE_HARD_LIMITS.MIN_CR_GAP_MINUTES;

                const queueRecords = prospectsToQueue.map((p, idx) => {
                  // FIX (Dec 18): Normalize company names before personalization
                  const normalizedCompany = normalizeCompanyName(p.company_name || '') || p.company_name || '';
                  const message = connectionMessage
                    .replace(/\{first_name\}/gi, p.first_name || '')
                    .replace(/\{company_name\}/gi, normalizedCompany)
                    .replace(/\{title\}/gi, p.title || '');

                  const scheduledFor = new Date(currentTime.getTime() + idx * gapMinutes * 60 * 1000);

                  return {
                    campaign_id: campaign_id,
                    prospect_id: p.id,
                    linkedin_user_id: p.linkedin_user_id || p.linkedin_url,
                    message,
                    scheduled_for: scheduledFor.toISOString(),
                    status: 'pending',
                    message_type: 'connection_request'
                  };
                });

                // Insert queue in batches
                for (let i = 0; i < queueRecords.length; i += 50) {
                  const batch = queueRecords.slice(i, i + 50);
                  const { error: queueError } = await adminClient
                    .from('send_queue')
                    .insert(batch);

                  if (queueError) {
                    console.error('Error inserting queue batch:', queueError.message);
                  } else {
                    queuedCount += batch.length;
                  }
                }
                console.log(`✅ Queued ${queuedCount} prospects for sending`);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      campaign_name,
      campaign_id,
      transferred: transferredCount,
      queued: queuedCount
    });

  } catch (error) {
    console.error('Update campaign name error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
