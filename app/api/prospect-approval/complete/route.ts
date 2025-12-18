import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Extract LinkedIn slug from URL or return as-is if already a slug
 * e.g., "https://www.linkedin.com/in/john-doe" -> "john-doe"
 */
function extractLinkedInSlug(urlOrSlug: string | null): string | null {
  if (!urlOrSlug) return null;
  // If it's already just a slug (no URL parts), return it
  if (!urlOrSlug.includes('/') && !urlOrSlug.includes('http')) return urlOrSlug;
  // Extract slug from URL like https://www.linkedin.com/in/john-doe/
  const match = urlOrSlug.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  return match ? match[1] : urlOrSlug;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, campaign_id, create_campaign } = body

    if (!session_id) {
      return NextResponse.json({
        success: false,
        error: 'Session ID required'
      }, { status: 400 })
    }

    const userId = request.headers.get('x-user-id') || 'default-user'

    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessionError) throw sessionError

    if (session.pending_count > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot complete session with ${session.pending_count} pending prospects`
      }, { status: 400 })
    }

    // Calculate learning insights
    const learningInsights = await calculateLearningInsights(session_id)

    // Mark session as completed
    const { error: updateError } = await supabase
      .from('prospect_approval_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        learning_insights: learningInsights
      })
      .eq('id', session_id)

    if (updateError) throw updateError

    // Generate final approved prospects list
    // FIX: Use approval_status directly instead of JOIN (no FK relationship exists)
    const { data: approvedProspects, error: approvedError } = await supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('session_id', session_id)
      .eq('approval_status', 'approved')

    if (approvedError) {
      console.error('Error fetching approved prospects:', approvedError);
    }

    console.log(`Found ${approvedProspects?.length || 0} approved prospects for session ${session_id}`);

    // Create final prospect export record
    const { data: exportRecord, error: exportError } = await supabase
      .from('prospect_exports')
      .insert({
        session_id,
        user_id: userId,
        workspace_id: session.workspace_id,
        prospect_count: approvedProspects?.length || 0,
        export_data: approvedProspects,
        export_format: 'json',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (exportError) throw exportError

    // CRITICAL FIX: Add approved prospects to campaign if campaign_id is specified
    // Priority: 1. campaign_id from request body, 2. session.campaign_id from database
    const targetCampaignId = campaign_id || session.campaign_id;
    let addedToCampaign = 0;

    if (targetCampaignId && approvedProspects && approvedProspects.length > 0) {
      console.log(`Adding ${approvedProspects.length} approved prospects to campaign ${targetCampaignId}`);

      // Update session with campaign_id if it wasn't set
      if (!session.campaign_id && campaign_id) {
        await supabase
          .from('prospect_approval_sessions')
          .update({ campaign_id: campaign_id })
          .eq('id', session_id);
        console.log(`✅ Linked session ${session_id} to campaign ${campaign_id}`);
      }

      // Transform prospects to campaign_prospects format
      const campaignProspects = approvedProspects.map((prospect: any) => {
        // Extract name parts
        const nameParts = prospect.name?.split(' ') || ['Unknown'];
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Extract email and LinkedIn URL from contact object
        const email = prospect.contact?.email || null;
        const linkedinUrl = prospect.contact?.linkedin_url || null;

        // Convert numeric connection_degree to string format for campaign_prospects
        let connectionDegreeStr: string | null = null;
        if (prospect.connection_degree === 1) connectionDegreeStr = '1st';
        else if (prospect.connection_degree === 2) connectionDegreeStr = '2nd';
        else if (prospect.connection_degree === 3) connectionDegreeStr = '3rd';
        else if (prospect.connection_degree) connectionDegreeStr = String(prospect.connection_degree);

        return {
          campaign_id: targetCampaignId,
          workspace_id: session.workspace_id,
          first_name: firstName,
          last_name: lastName,
          email: email,
          company_name: prospect.company?.name || '',
          title: prospect.title || '',
          location: prospect.location || null,
          linkedin_url: linkedinUrl,
          // CRITICAL FIX (Dec 10, Dec 18): linkedin_user_id must be slug, not full URL
          // Extract slug from URL to avoid "User ID does not match provider's expected format" errors
          linkedin_user_id: extractLinkedInSlug(prospect.linkedin_user_id || linkedinUrl),
          connection_degree: connectionDegreeStr,  // CRITICAL: Store connection degree for campaign type validation
          status: 'approved',  // FIX: These prospects were already approved in the workflow
          personalization_data: {
            source: 'csv_upload_approval',
            session_id: session_id,
            approved_at: new Date().toISOString()
          }
        };
      });

      // CRITICAL FIX (Dec 10): Insert prospects one by one to handle partial failures
      // Bulk insert fails ALL records if ANY has a constraint violation
      let successCount = 0;
      let errorCount = 0;
      const insertErrors: string[] = [];

      for (const prospect of campaignProspects) {
        const { error: singleInsertError } = await supabase
          .from('campaign_prospects')
          .insert(prospect);

        if (singleInsertError) {
          errorCount++;
          insertErrors.push(`${prospect.first_name} ${prospect.last_name}: ${singleInsertError.message}`);
          console.warn(`⚠️ Failed to add prospect ${prospect.first_name} ${prospect.last_name}:`, singleInsertError.message);
        } else {
          successCount++;
        }
      }

      addedToCampaign = successCount;
      console.log(`✅ Prospect insert complete: ${successCount} added, ${errorCount} failed`);

      if (errorCount > 0) {
        console.error(`⚠️ ${errorCount} prospects failed to insert:`, insertErrors.slice(0, 5));
      }

      if (successCount > 0) {
        console.log(`✅ Successfully added ${addedToCampaign} prospects to campaign`);

        // Mark prospects as transferred to campaign in approval database
        const prospectIds = approvedProspects.map((p: any) => p.prospect_id);
        await supabase
          .from('prospect_approval_data')
          .update({
            approval_status: 'transferred_to_campaign',
            transferred_at: new Date().toISOString(),
            transferred_to_campaign_id: targetCampaignId
          })
          .in('prospect_id', prospectIds)
          .eq('session_id', session_id);

        console.log(`✅ Marked ${prospectIds.length} prospects as transferred to campaign`);
      }
    }

    return NextResponse.json({
      success: true,
      session_completed: true,
      approved_prospects: approvedProspects?.length || 0,
      added_to_campaign: addedToCampaign,
      campaign_id: targetCampaignId,
      session_id: session_id,
      learning_insights: learningInsights,
      export_id: exportRecord.id,
      message: `Session completed with ${approvedProspects?.length || 0} approved prospects${addedToCampaign > 0 ? `, ${addedToCampaign} added to campaign` : ''}`
    })

  } catch (error) {
    console.error('Session completion error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function calculateLearningInsights(sessionId: string) {
  try {
    // Get all decisions for this session
    const { data: decisions } = await supabase
      .from('prospect_learning_logs')
      .select('*')
      .eq('session_id', sessionId)

    if (!decisions || decisions.length === 0) {
      return {
        approval_rate: 0,
        common_reject_reasons: [],
        preferred_criteria: {}
      }
    }

    const totalDecisions = decisions.length
    const approvedCount = decisions.filter(d => d.decision === 'approved').length
    const approvalRate = (approvedCount / totalDecisions) * 100

    // Analyze rejection reasons
    const rejectedDecisions = decisions.filter(d => d.decision === 'rejected' && d.reason)
    const reasonCounts = rejectedDecisions.reduce((acc: Record<string, number>, decision) => {
      const reason = decision.reason
      acc[reason] = (acc[reason] || 0) + 1
      return acc
    }, {})

    const commonRejectReasons = Object.entries(reasonCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([reason]) => reason)

    // Analyze preferred criteria from approved prospects
    const approvedDecisions = decisions.filter(d => d.decision === 'approved')
    const preferredCriteria: Record<string, any> = {}

    if (approvedDecisions.length > 0) {
      // Company sizes
      const companySizes = approvedDecisions.map(d => d.company_size).filter(Boolean)
      if (companySizes.length > 0) {
        preferredCriteria.company_sizes = [...new Set(companySizes)]
      }

      // Industries
      const industries = approvedDecisions.map(d => d.company_industry).filter(Boolean)
      if (industries.length > 0) {
        preferredCriteria.industries = [...new Set(industries)]
      }

      // Connection preferences
      const connectionDegrees = approvedDecisions.map(d => d.connection_degree).filter(d => d !== null)
      if (connectionDegrees.length > 0) {
        const avgConnectionDegree = connectionDegrees.reduce((sum, degree) => sum + degree, 0) / connectionDegrees.length
        preferredCriteria.preferred_connection_degree = Math.round(avgConnectionDegree)
      }

      // Contact info preferences
      const withEmail = approvedDecisions.filter(d => d.has_email).length
      const withPhone = approvedDecisions.filter(d => d.has_phone).length
      
      preferredCriteria.contact_preferences = {
        email_required: (withEmail / approvedDecisions.length) > 0.8,
        phone_preferred: (withPhone / approvedDecisions.length) > 0.5
      }

      // Score thresholds
      const scores = approvedDecisions.map(d => d.enrichment_score).filter(s => s !== null)
      if (scores.length > 0) {
        const minScore = Math.min(...scores)
        preferredCriteria.min_enrichment_score = minScore
      }
    }

    return {
      approval_rate: Math.round(approvalRate * 100) / 100,
      common_reject_reasons: commonRejectReasons,
      preferred_criteria: preferredCriteria
    }

  } catch (error) {
    console.error('Learning insights calculation error:', error)
    return {
      approval_rate: 0,
      common_reject_reasons: [],
      preferred_criteria: {}
    }
  }
}