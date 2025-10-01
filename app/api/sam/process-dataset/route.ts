import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

interface ProcessDatasetRequest {
  session_id: string;
  action: 'validate' | 'assign_to_campaign' | 'auto_approve';
  campaign_id?: string;
  campaign_name?: string;
  approval_threshold?: number; // For auto-approve: 0-1 (e.g., 0.8 = 80%)
}

interface LinkedInProspectValidation {
  id: string;
  name: string;
  linkedin_url?: string;
  email?: string;
  company?: string;
  title?: string;
  validation_status: 'valid' | 'warning' | 'invalid';
  validation_issues: string[];
  quality_score: number;
  ready_for_campaign: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body: ProcessDatasetRequest = await request.json();
    const { session_id, action, campaign_id, campaign_name, approval_threshold = 0.8 } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get the data approval session
    const { data: approvalSession, error: sessionError } = await supabase
      .from('data_approval_sessions')
      .select('*')
      .eq('session_id', session_id)
      .eq('user_id', session.user.id)
      .single();

    if (sessionError || !approvalSession) {
      return NextResponse.json({ 
        error: 'Data approval session not found',
        details: sessionError?.message 
      }, { status: 404 });
    }

    const prospects = approvalSession.processed_data || [];

    // Action: Validate LinkedIn prospects
    if (action === 'validate') {
      const validatedProspects = prospects.map((prospect: any) => 
        validateLinkedInProspect(prospect)
      );

      const validCount = validatedProspects.filter((p: any) => p.validation_status === 'valid').length;
      const warningCount = validatedProspects.filter((p: any) => p.validation_status === 'warning').length;
      const invalidCount = validatedProspects.filter((p: any) => p.validation_status === 'invalid').length;
      const readyForCampaign = validatedProspects.filter((p: any) => p.ready_for_campaign).length;

      return NextResponse.json({
        success: true,
        action: 'validate',
        session_id,
        validation_summary: {
          total: prospects.length,
          valid: validCount,
          warnings: warningCount,
          invalid: invalidCount,
          ready_for_campaign: readyForCampaign,
          linkedin_profiles: validatedProspects.filter((p: any) => p.linkedin_url).length
        },
        validated_prospects: validatedProspects,
        recommendations: generateRecommendations(validatedProspects)
      });
    }

    // Action: Auto-approve prospects above threshold
    if (action === 'auto_approve') {
      const validatedProspects = prospects.map((prospect: any) => 
        validateLinkedInProspect(prospect)
      );

      const autoApproved = validatedProspects.filter(
        (p: any) => p.quality_score >= approval_threshold && p.ready_for_campaign
      );

      // Update approval session with approved prospects
      await supabase
        .from('data_approval_sessions')
        .update({
          status: 'auto_approved',
          approved_count: autoApproved.length,
          approval_threshold: approval_threshold,
          approved_at: new Date().toISOString()
        })
        .eq('id', approvalSession.id);

      return NextResponse.json({
        success: true,
        action: 'auto_approve',
        session_id,
        approved_count: autoApproved.length,
        rejected_count: prospects.length - autoApproved.length,
        approved_prospects: autoApproved,
        message: `Auto-approved ${autoApproved.length} prospects with ${(approval_threshold * 100).toFixed(0)}%+ quality scores`
      });
    }

    // Action: Assign to campaign
    if (action === 'assign_to_campaign') {
      if (!campaign_id && !campaign_name) {
        return NextResponse.json({ 
          error: 'Either campaign_id or campaign_name is required for assignment' 
        }, { status: 400 });
      }

      // Get user's workspace via workspace_members
      const { data: memberships, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .limit(1);

      if (membershipError || !memberships || memberships.length === 0) {
        console.error('Workspace membership lookup failed:', membershipError);
        return NextResponse.json({ 
          error: 'Workspace not found',
          details: 'User is not a member of any workspace'
        }, { status: 404 });
      }

      const workspaceId = memberships[0].workspace_id;
      let targetCampaignId = campaign_id;

      // If campaign_name provided, create or find campaign
      if (!targetCampaignId && campaign_name) {
        const { data: existingCampaign } = await supabase
          .from('campaigns')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('name', campaign_name)
          .single();

        if (existingCampaign) {
          targetCampaignId = existingCampaign.id;
        } else {
          // Create new campaign
          const { data: newCampaign, error: campaignError } = await supabase
            .from('campaigns')
            .insert({
              workspace_id: workspaceId,
              name: campaign_name,
              type: 'sam_signature',
              status: 'draft',
              campaign_type: 'linkedin_only',
              channel_preferences: {
                email: false,
                linkedin: true
              },
              created_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (campaignError) {
            return NextResponse.json({ 
              error: 'Failed to create campaign',
              details: campaignError.message 
            }, { status: 500 });
          }

          targetCampaignId = newCampaign.id;
        }
      }

      // Validate prospects before assignment
      const validatedProspects = prospects.map((prospect: any) => 
        validateLinkedInProspect(prospect)
      );

      const readyProspects = validatedProspects.filter(
        (p: any) => p.ready_for_campaign && p.validation_status !== 'invalid'
      );

      if (readyProspects.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No prospects are ready for campaign assignment',
          validation_summary: {
            total: prospects.length,
            ready: 0,
            requires_review: validatedProspects.filter((p: any) => !p.ready_for_campaign).length
          }
        }, { status: 400 });
      }

      // Insert prospects into workspace_prospects first
      const prospectInserts = readyProspects.map((p: any) => ({
        workspace_id: workspaceId,
        first_name: p.name.split(' ')[0] || '',
        last_name: p.name.split(' ').slice(1).join(' ') || '',
        full_name: p.name,
        company_name: p.company || '',
        job_title: p.title || '',
        linkedin_profile_url: p.linkedin_url || p.linkedinUrl || '',
        email_address: p.email || '',
        data_source: 'csv_upload',
        source_platform: 'linkedin',
        confidence_score: p.quality_score
      }));

      const { data: insertedProspects, error: insertError } = await supabase
        .from('workspace_prospects')
        .insert(prospectInserts)
        .select('id');

      if (insertError) {
        console.error('Prospect insert error:', insertError);
        return NextResponse.json({ 
          error: 'Failed to insert prospects',
          details: insertError.message 
        }, { status: 500 });
      }

      // Associate prospects with campaign
      const campaignAssociations = insertedProspects.map((prospect: any) => ({
        campaign_id: targetCampaignId,
        prospect_id: prospect.id,
        status: 'pending'
      }));

      const { error: associationError } = await supabase
        .from('campaign_prospects')
        .insert(campaignAssociations);

      if (associationError) {
        console.error('Campaign association error:', associationError);
        return NextResponse.json({ 
          error: 'Failed to assign prospects to campaign',
          details: associationError.message 
        }, { status: 500 });
      }

      // Update approval session
      await supabase
        .from('data_approval_sessions')
        .update({
          status: 'assigned_to_campaign',
          assigned_campaign_id: targetCampaignId,
          assigned_at: new Date().toISOString()
        })
        .eq('id', approvalSession.id);

      return NextResponse.json({
        success: true,
        action: 'assign_to_campaign',
        campaign_id: targetCampaignId,
        campaign_name: campaign_name,
        assigned_count: insertedProspects.length,
        skipped_count: prospects.length - readyProspects.length,
        message: `Successfully assigned ${insertedProspects.length} LinkedIn prospects to campaign`
      });
    }

    return NextResponse.json({ 
      error: 'Invalid action. Must be: validate, auto_approve, or assign_to_campaign' 
    }, { status: 400 });

  } catch (error) {
    console.error('Process dataset error:', error);
    return NextResponse.json({ 
      error: 'Failed to process dataset',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// LinkedIn prospect validation function
function validateLinkedInProspect(prospect: any): LinkedInProspectValidation {
  const issues: string[] = [];
  let qualityScore = 1.0;
  let readyForCampaign = true;

  // Validate LinkedIn URL
  const linkedinUrl = prospect.linkedinUrl || prospect.linkedin_url || prospect.linkedin_profile_url || '';
  if (!linkedinUrl) {
    issues.push('Missing LinkedIn profile URL');
    qualityScore -= 0.5;
    readyForCampaign = false;
  } else if (!linkedinUrl.includes('linkedin.com/in/')) {
    issues.push('Invalid LinkedIn URL format');
    qualityScore -= 0.3;
    readyForCampaign = false;
  }

  // Validate name
  const name = prospect.name || prospect.full_name || `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim();
  if (!name || name.length < 2) {
    issues.push('Missing or invalid name');
    qualityScore -= 0.3;
  }

  // Validate company (recommended but not required)
  const company = prospect.company || prospect.company_name || '';
  if (!company) {
    issues.push('Missing company name (recommended for personalization)');
    qualityScore -= 0.1;
  }

  // Validate title (recommended but not required)
  const title = prospect.title || prospect.job_title || '';
  if (!title) {
    issues.push('Missing job title (recommended for personalization)');
    qualityScore -= 0.1;
  }

  // Email is optional for LinkedIn campaigns
  const email = prospect.email || prospect.email_address || '';

  // Determine validation status
  let validationStatus: 'valid' | 'warning' | 'invalid';
  if (qualityScore >= 0.7 && readyForCampaign) {
    validationStatus = 'valid';
  } else if (qualityScore >= 0.5 && linkedinUrl) {
    validationStatus = 'warning';
  } else {
    validationStatus = 'invalid';
    readyForCampaign = false;
  }

  return {
    id: prospect.id || `prospect_${Date.now()}_${Math.random()}`,
    name,
    linkedin_url: linkedinUrl,
    email: email || undefined,
    company: company || undefined,
    title: title || undefined,
    validation_status: validationStatus,
    validation_issues: issues,
    quality_score: Math.max(0, qualityScore),
    ready_for_campaign: readyForCampaign
  };
}

// Generate recommendations based on validation results
function generateRecommendations(validatedProspects: LinkedInProspectValidation[]): string[] {
  const recommendations: string[] = [];
  
  const invalidCount = validatedProspects.filter(p => p.validation_status === 'invalid').length;
  const missingLinkedinCount = validatedProspects.filter(p => !p.linkedin_url).length;
  const missingCompanyCount = validatedProspects.filter(p => !p.company).length;
  const missingTitleCount = validatedProspects.filter(p => !p.title).length;

  if (invalidCount > 0) {
    recommendations.push(`${invalidCount} prospects have critical issues and should be reviewed or removed`);
  }

  if (missingLinkedinCount > 0) {
    recommendations.push(`${missingLinkedinCount} prospects are missing LinkedIn URLs - these are required for LinkedIn campaigns`);
  }

  if (missingCompanyCount > validatedProspects.length * 0.3) {
    recommendations.push('Many prospects are missing company information - this will reduce personalization effectiveness');
  }

  if (missingTitleCount > validatedProspects.length * 0.3) {
    recommendations.push('Many prospects are missing job titles - consider enriching this data for better targeting');
  }

  const avgQuality = validatedProspects.reduce((sum, p) => sum + p.quality_score, 0) / validatedProspects.length;
  if (avgQuality < 0.7) {
    recommendations.push(`Average quality score is ${(avgQuality * 100).toFixed(0)}% - consider data enrichment before campaign launch`);
  }

  return recommendations;
}
