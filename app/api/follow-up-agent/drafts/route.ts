/**
 * Follow-Up Agent Drafts API
 *
 * GET /api/follow-up-agent/drafts - List pending follow-up drafts
 * POST /api/follow-up-agent/drafts - Generate new follow-up draft
 *
 * HITL Workflow:
 * 1. Cron job detects prospects due for follow-up
 * 2. AI generates draft → status = pending_approval
 * 3. Human reviews in UI → approve/reject/edit
 * 4. Approved drafts sent by send cron
 *
 * Migrated Dec 31, 2025: Firebase auth + Cloud SQL
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import {
  generateFollowUpMessage,
  createFollowUpDraft,
  detectScenario,
  determineChannel,
  FollowUpContext,
  FollowUpScenario
} from '@/lib/services/follow-up-agent-v2';

/**
 * GET /api/follow-up-agent/drafts
 * List pending follow-up drafts for workspace
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check via Firebase
    let userId: string;
    let workspaceId: string;

    try {
      const auth = await verifyAuth(req);
      userId = auth.userId;
      workspaceId = auth.workspaceId;
    } catch (authError) {
      const err = authError as AuthError;
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }

    const { searchParams } = new URL(req.url);
    // Allow query param to override header workspace_id if provided
    const queryWorkspaceId = searchParams.get('workspace_id');
    const effectiveWorkspaceId = queryWorkspaceId || workspaceId;
    const status = searchParams.get('status') || 'pending_approval';
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!effectiveWorkspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    // Verify user has access to workspace (if different from auth workspace)
    if (queryWorkspaceId && queryWorkspaceId !== workspaceId) {
      const memberResult = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [queryWorkspaceId, userId]
      );
      if (memberResult.rows.length === 0) {
        return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
      }
    }

    // Fetch drafts with prospect and campaign info using raw SQL
    const draftsResult = await pool.query(
      `SELECT
        d.*,
        json_build_object(
          'id', p.id,
          'first_name', p.first_name,
          'last_name', p.last_name,
          'company_name', p.company_name,
          'title', p.title,
          'linkedin_url', p.linkedin_url,
          'email', p.email
        ) as campaign_prospects,
        json_build_object(
          'id', c.id,
          'campaign_name', c.campaign_name
        ) as campaigns
      FROM follow_up_drafts d
      LEFT JOIN campaign_prospects p ON d.prospect_id = p.id
      LEFT JOIN campaigns c ON d.campaign_id = c.id
      WHERE d.workspace_id = $1 AND d.status = $2
      ORDER BY d.created_at DESC
      LIMIT $3`,
      [effectiveWorkspaceId, status, limit]
    );

    return NextResponse.json({
      success: true,
      drafts: draftsResult.rows,
      count: draftsResult.rows.length
    });

  } catch (error) {
    console.error('GET /api/follow-up-agent/drafts error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/follow-up-agent/drafts
 * Generate new follow-up draft for a prospect
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prospect_id, campaign_id, workspace_id, channel, force_scenario } = body;

    // Validate required fields
    if (!prospect_id || !campaign_id || !workspace_id) {
      return NextResponse.json({
        error: 'prospect_id, campaign_id, and workspace_id required'
      }, { status: 400 });
    }

    // Check if this is a cron request
    const cronSecret = req.headers.get('x-cron-secret');
    const isCron = cronSecret === process.env.CRON_SECRET;

    if (!isCron) {
      // Auth check for non-cron requests via Firebase
      try {
        const auth = await verifyAuth(req);
        // Verify workspace access (verifyAuth already checks this, but double-check if different workspace)
        if (auth.workspaceId !== workspace_id) {
          const memberResult = await pool.query(
            'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
            [workspace_id, auth.userId]
          );
          if (memberResult.rows.length === 0) {
            return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
          }
        }
      } catch (authError) {
        const err = authError as AuthError;
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
    }

    // Fetch prospect details with campaign info
    const prospectResult = await pool.query(
      `SELECT
        p.*,
        json_build_object(
          'id', c.id,
          'campaign_name', c.campaign_name,
          'workspace_id', c.workspace_id,
          'message_templates', c.message_templates
        ) as campaigns
      FROM campaign_prospects p
      LEFT JOIN campaigns c ON p.campaign_id = c.id
      WHERE p.id = $1`,
      [prospect_id]
    );

    if (prospectResult.rows.length === 0) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    const prospect = prospectResult.rows[0];

    // Check for existing pending draft
    const existingDraftResult = await pool.query(
      'SELECT id FROM follow_up_drafts WHERE prospect_id = $1 AND status = $2',
      [prospect_id, 'pending_approval']
    );

    if (existingDraftResult.rows.length > 0) {
      return NextResponse.json({
        error: 'Pending draft already exists for this prospect',
        draft_id: existingDraftResult.rows[0].id
      }, { status: 409 });
    }

    // Detect scenario
    const scenario: FollowUpScenario = force_scenario || detectScenario({
      status: prospect.status,
      responded_at: prospect.responded_at,
      connection_accepted_at: prospect.connection_accepted_at,
      meeting_scheduled_at: prospect.meeting_scheduled_at,
      demo_completed_at: prospect.demo_completed_at,
      check_back_date: prospect.check_back_date,
      trial_started_at: prospect.trial_started_at,
      trial_last_activity_at: prospect.trial_last_activity_at
    });

    // Determine touch number
    const touchNumber = (prospect.follow_up_sequence_index || 0) + 1;

    // Determine channel (may switch for touch 3+)
    const effectiveChannel = determineChannel(
      {
        id: prospect.id,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        linkedin_url: prospect.linkedin_url,
        email: prospect.email
      },
      touchNumber,
      channel || 'linkedin'
    );

    // Calculate days since last contact
    const lastContact = prospect.last_follow_up_at || prospect.connection_request_sent || prospect.created_at;
    const daysSinceContact = Math.floor(
      (Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get previous follow-ups
    const previousFollowUpsResult = await pool.query(
      'SELECT message FROM follow_up_drafts WHERE prospect_id = $1 AND status = $2 ORDER BY created_at ASC',
      [prospect_id, 'sent']
    );

    // Build context
    const context: FollowUpContext = {
      prospect: {
        id: prospect.id,
        first_name: prospect.first_name || '',
        last_name: prospect.last_name || '',
        company_name: prospect.company_name,
        title: prospect.title,
        industry: prospect.industry,
        linkedin_url: prospect.linkedin_url,
        email: prospect.email,
        timezone: prospect.timezone
      },
      campaign: {
        id: prospect.campaigns.id,
        name: prospect.campaigns.campaign_name,
        workspace_id: workspace_id
      },
      scenario,
      channel: effectiveChannel,
      touch_number: touchNumber,
      max_touches: 4,
      days_since_last_contact: daysSinceContact,
      conversation_history: {
        initial_outreach: prospect.campaigns?.message_templates?.connection_request,
        their_replies: prospect.their_messages ? JSON.parse(prospect.their_messages) : [],
        our_replies: prospect.our_messages ? JSON.parse(prospect.our_messages) : [],
        last_topic_discussed: prospect.last_topic
      },
      check_back_date: prospect.check_back_date,
      previous_follow_ups: previousFollowUpsResult.rows.map(f => f.message) || []
    };

    console.log('Generating follow-up draft:', {
      prospect: `${context.prospect.first_name} ${context.prospect.last_name}`,
      scenario,
      touch: touchNumber,
      channel: effectiveChannel
    });

    // Generate AI follow-up message
    const generated = await generateFollowUpMessage(context);

    // Create draft
    const draft = await createFollowUpDraft(context, generated);

    console.log('Draft created:', draft.id);

    return NextResponse.json({
      success: true,
      draft,
      metadata: {
        scenario,
        touch_number: touchNumber,
        channel: effectiveChannel,
        confidence: generated.confidence_score,
        next_follow_up_days: generated.next_follow_up_days
      }
    });

  } catch (error) {
    console.error('POST /api/follow-up-agent/drafts error:', error);
    return NextResponse.json({
      error: 'Failed to generate follow-up draft',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
