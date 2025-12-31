/**
 * SAM Dataset Processing API
 * Handles validation, auto-approval, and campaign assignment for datasets
 * Updated Dec 31, 2025: Migrated to verifyAuth and pool.query
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

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
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = auth.user;
    const body: ProcessDatasetRequest = await request.json();
    const { session_id, action, campaign_id, campaign_name, approval_threshold = 0.8 } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get the data approval session
    const sessionRes = await pool.query(
      'SELECT * FROM data_approval_sessions WHERE session_id = $1 AND user_id = $2',
      [session_id, user.uid]
    );
    const approvalSession = sessionRes.rows[0];

    if (!approvalSession) {
      return NextResponse.json({
        error: 'Data approval session not found'
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
      await pool.query(
        `UPDATE data_approval_sessions 
         SET status = 'auto_approved', approved_count = $1, approval_threshold = $2, approved_at = NOW()
         WHERE id = $3`,
        [autoApproved.length, approval_threshold, approvalSession.id]
      );

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

      // Get user's workspace
      const userRes = await pool.query(
        'SELECT current_workspace_id FROM users WHERE id = $1',
        [user.uid]
      );
      const workspaceId = userRes.rows[0]?.current_workspace_id;

      if (!workspaceId) {
        return NextResponse.json({
          error: 'Workspace not found',
          details: 'User has no active workspace'
        }, { status: 404 });
      }

      let targetCampaignId = campaign_id;

      // If campaign_name provided, create or find campaign
      if (!targetCampaignId && campaign_name) {
        const campaignRes = await pool.query(
          'SELECT id FROM campaigns WHERE workspace_id = $1 AND name = $2 LIMIT 1',
          [workspaceId, campaign_name]
        );
        const existingCampaign = campaignRes.rows[0];

        if (existingCampaign) {
          targetCampaignId = existingCampaign.id;
        } else {
          // Create new campaign
          const newCampaignRes = await pool.query(
            `INSERT INTO campaigns (
              workspace_id, name, type, status, campaign_type, channel_preferences, created_at
            ) VALUES ($1, $2, 'sam_signature', 'draft', 'linkedin_only', $3, NOW())
            RETURNING id`,
            [workspaceId, campaign_name, JSON.stringify({ email: false, linkedin: true })]
          );
          targetCampaignId = newCampaignRes.rows[0].id;
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

      // Insert prospects into workspace_prospects
      const insertedProspectIds: string[] = [];
      for (const p of readyProspects) {
        const prospectRes = await pool.query(
          `INSERT INTO workspace_prospects (
            workspace_id, first_name, last_name, full_name, company_name, 
            job_title, linkedin_profile_url, email_address, data_source, 
            source_platform, confidence_score
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'csv_upload', 'linkedin', $9)
          RETURNING id`,
          [
            workspaceId,
            p.name.split(' ')[0] || '',
            p.name.split(' ').slice(1).join(' ') || '',
            p.name,
            p.company || '',
            p.title || '',
            p.linkedin_url || '',
            p.email || '',
            p.quality_score
          ]
        );
        insertedProspectIds.push(prospectRes.rows[0].id);
      }

      // Associate prospects with campaign
      for (const prospectId of insertedProspectIds) {
        await pool.query(
          'INSERT INTO campaign_prospects (campaign_id, prospect_id, status) VALUES ($1, $2, $3)',
          [targetCampaignId, prospectId, 'pending']
        );
      }

      // Update approval session
      await pool.query(
        `UPDATE data_approval_sessions 
         SET status = 'assigned_to_campaign', assigned_campaign_id = $1, assigned_at = NOW()
         WHERE id = $2`,
        [targetCampaignId, approvalSession.id]
      );

      return NextResponse.json({
        success: true,
        action: 'assign_to_campaign',
        campaign_id: targetCampaignId,
        campaign_name: campaign_name,
        assigned_count: insertedProspectIds.length,
        skipped_count: prospects.length - readyProspects.length,
        message: `Successfully assigned ${insertedProspectIds.length} LinkedIn prospects to campaign`
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
