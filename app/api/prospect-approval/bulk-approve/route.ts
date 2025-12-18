import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/app/lib/supabase'
import { MESSAGE_HARD_LIMITS } from '@/lib/anti-detection/message-variance'
import { personalizeMessage } from '@/lib/personalization'

/**
 * Extract LinkedIn slug from URL or return as-is if already a slug
 * e.g., "https://www.linkedin.com/in/john-doe" -> "john-doe"
 */
function extractLinkedInSlug(urlOrSlug: string): string {
  if (!urlOrSlug) return '';
  // If it's already just a slug (no URL parts), return it
  if (!urlOrSlug.includes('/') && !urlOrSlug.includes('http')) return urlOrSlug;
  // Extract slug from URL like https://www.linkedin.com/in/john-doe/
  const match = urlOrSlug.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  return match ? match[1] : urlOrSlug;
}

/**
 * POST /api/prospect-approval/bulk-approve
 * Bulk approve/reject prospects across all pages
 * Supports filtering by status for "approve all pending" scenarios
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, operation, status_filter, prospect_ids } = body

    if (!session_id) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 })
    }

    if (!operation || !['approve', 'reject'].includes(operation)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid operation. Must be "approve" or "reject"'
      }, { status: 400 })
    }

    // Authenticate user
    const cookieStore = await cookies()
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
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get user workspace
    const adminClient = supabaseAdmin()
    const { data: userProfile } = await adminClient
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single()

    const workspaceId = userProfile?.current_workspace_id

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 404 })
    }

    // Verify session belongs to workspace
    const { data: session } = await supabase
      .from('prospect_approval_sessions')
      .select('workspace_id')
      .eq('id', session_id)
      .single()

    if (!session || session.workspace_id !== workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 })
    }

    const decision = operation === 'approve' ? 'approved' : 'rejected'

    // If specific prospect IDs provided, use those
    if (prospect_ids && Array.isArray(prospect_ids) && prospect_ids.length > 0) {
      // Bulk decision for specific prospects
      const decisionRecords = prospect_ids.map(prospect_id => ({
        session_id,
        prospect_id,
        decision,
        decided_by: user.id,
        decided_at: new Date().toISOString()
      }))

      // Upsert decisions (update if exists, insert if not)
      const { error: decisionError } = await supabase
        .from('prospect_approval_decisions')
        .upsert(decisionRecords, {
          onConflict: 'session_id,prospect_id',
          ignoreDuplicates: false
        })

      if (decisionError) throw decisionError

      return NextResponse.json({
        success: true,
        count: prospect_ids.length,
        operation: decision
      })
    }

    // Otherwise, bulk approve/reject all (with optional status filter)
    // First, get all prospect IDs that match the criteria
    let query = supabase
      .from('prospect_approval_data')
      .select('prospect_id')
      .eq('session_id', session_id)

    // Apply status filter if provided (e.g., only pending)
    if (status_filter && status_filter !== 'all') {
      query = query.eq('approval_status', status_filter)
    }

    const { data: prospects, error: fetchError } = await query

    if (fetchError) throw fetchError

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        operation: decision,
        message: 'No prospects found matching criteria'
      })
    }

    // Create decision records for all prospects
    const decisionRecords = prospects.map(p => ({
      session_id,
      prospect_id: p.prospect_id,
      decision,
      decided_by: user.id,
      decided_at: new Date().toISOString()
    }))

    // Upsert in batches of 100 to avoid timeout
    const BATCH_SIZE = 100
    let processedCount = 0

    for (let i = 0; i < decisionRecords.length; i += BATCH_SIZE) {
      const batch = decisionRecords.slice(i, i + BATCH_SIZE)

      const { error: batchError } = await supabase
        .from('prospect_approval_decisions')
        .upsert(batch, {
          onConflict: 'session_id,prospect_id',
          ignoreDuplicates: false
        })

      if (batchError) throw batchError
      processedCount += batch.length
    }

    // Update session counts
    const { data: updatedCounts } = await supabase
      .from('prospect_approval_decisions')
      .select('decision')
      .eq('session_id', session_id)

    const approved = updatedCounts?.filter(d => d.decision === 'approved').length || 0
    const rejected = updatedCounts?.filter(d => d.decision === 'rejected').length || 0
    const totalProspects = prospects.length
    const pending = totalProspects - approved - rejected

    await supabase
      .from('prospect_approval_sessions')
      .update({
        approved_count: approved,
        rejected_count: rejected,
        pending_count: pending
      })
      .eq('id', session_id)

    console.log(`✅ Bulk ${operation}: ${processedCount} prospects in session ${session_id}`)

    // AUTO-TRANSFER: If approving and session has a campaign_id, transfer to campaign_prospects
    let transferredCount = 0
    let queuedCount = 0

    if (operation === 'approve') {
      // Get session details including campaign_id
      const { data: sessionData } = await adminClient
        .from('prospect_approval_sessions')
        .select('campaign_id, workspace_id')
        .eq('id', session_id)
        .single()

      if (sessionData?.campaign_id) {
        console.log(`📦 Auto-transferring approved prospects to campaign ${sessionData.campaign_id}`)

        // Get all approved prospect data for this session
        const approvedProspectIds = prospects?.map(p => p.prospect_id) || []
        const { data: prospectData } = await adminClient
          .from('prospect_approval_data')
          .select('*')
          .in('prospect_id', approvedProspectIds)

        // Get existing prospects in campaign to avoid duplicates
        const { data: existingCampaignProspects } = await adminClient
          .from('campaign_prospects')
          .select('linkedin_url')
          .eq('campaign_id', sessionData.campaign_id)

        const existingUrls = new Set(
          (existingCampaignProspects || [])
            .map(p => p.linkedin_url?.toLowerCase())
            .filter(Boolean)
        )

        // Prepare new campaign prospects
        const newCampaignProspects = []
        for (const p of prospectData || []) {
          const linkedinUrl = p.contact?.linkedin_url
          if (!linkedinUrl) continue
          if (existingUrls.has(linkedinUrl.toLowerCase())) continue

          const nameParts = (p.name || '').split(' ')
          newCampaignProspects.push({
            campaign_id: sessionData.campaign_id,
            workspace_id: sessionData.workspace_id,
            first_name: nameParts[0] || 'Unknown',
            last_name: nameParts.slice(1).join(' ') || '',
            title: p.title || '',
            company_name: p.company?.name || '',
            linkedin_url: linkedinUrl,
            linkedin_user_id: extractLinkedInSlug(linkedinUrl), // Extract slug, not full URL
            email: p.contact?.email || null,
            status: 'approved'
          })
        }

        // Insert in batches
        if (newCampaignProspects.length > 0) {
          for (let i = 0; i < newCampaignProspects.length; i += 50) {
            const batch = newCampaignProspects.slice(i, i + 50)
            const { error: insertError } = await adminClient
              .from('campaign_prospects')
              .insert(batch)

            if (insertError) {
              console.error('Error inserting campaign prospects batch:', insertError.message)
            } else {
              transferredCount += batch.length
            }
          }
          console.log(`✅ Transferred ${transferredCount} prospects to campaign_prospects`)

          // AUTO-QUEUE: Get campaign template and add to send_queue
          const { data: campaign } = await adminClient
            .from('campaigns')
            .select('message_templates, status, linkedin_account_id')
            .eq('id', sessionData.campaign_id)
            .single()

          if (campaign?.status === 'active' && campaign?.linkedin_account_id) {
            const connectionMessage = campaign.message_templates?.connection_request || ''

            if (connectionMessage) {
              // Get newly inserted prospects
              const { data: insertedProspects } = await adminClient
                .from('campaign_prospects')
                .select('id, first_name, company_name, title, linkedin_url, linkedin_user_id')
                .eq('campaign_id', sessionData.campaign_id)
                .eq('status', 'approved')

              // Get existing queue to avoid duplicates
              const { data: existingQueue } = await adminClient
                .from('send_queue')
                .select('prospect_id')
                .eq('campaign_id', sessionData.campaign_id)

              const queuedProspectIds = new Set((existingQueue || []).map(q => q.prospect_id))
              const prospectsToQueue = (insertedProspects || []).filter(p => !queuedProspectIds.has(p.id))

              if (prospectsToQueue.length > 0) {
                let currentTime = new Date()
                currentTime.setMinutes(currentTime.getMinutes() + 30) // Start 30 min from now

                // Use MIN_CR_GAP_MINUTES from anti-detection config (20 min minimum)
                const gapMinutes = MESSAGE_HARD_LIMITS.MIN_CR_GAP_MINUTES

                const queueRecords = prospectsToQueue.map((p, idx) => {
                  // Use universal personalization for message
                  const message = personalizeMessage(connectionMessage, {
                    first_name: p.first_name,
                    company_name: p.company_name,
                    title: p.title
                  });

                  const scheduledFor = new Date(currentTime.getTime() + idx * gapMinutes * 60 * 1000) // Using anti-detection gap

                  // Extract slug from URL for linkedin_user_id (not full URL)
                  const linkedinId = extractLinkedInSlug(p.linkedin_user_id || p.linkedin_url);

                  return {
                    campaign_id: sessionData.campaign_id,
                    prospect_id: p.id,
                    linkedin_user_id: linkedinId,
                    message,
                    scheduled_for: scheduledFor.toISOString(),
                    status: 'pending',
                    message_type: 'connection_request'
                  }
                })

                // Insert queue in batches
                for (let i = 0; i < queueRecords.length; i += 50) {
                  const batch = queueRecords.slice(i, i + 50)
                  const { error: queueError } = await adminClient
                    .from('send_queue')
                    .insert(batch)

                  if (queueError) {
                    console.error('Error inserting queue batch:', queueError.message)
                  } else {
                    queuedCount += batch.length
                  }
                }
                console.log(`✅ Queued ${queuedCount} prospects for sending`)
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: processedCount,
      operation: decision,
      counts: {
        approved,
        rejected,
        pending
      },
      transferred: transferredCount,
      queued: queuedCount
    })

  } catch (error) {
    console.error('Bulk approve error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
