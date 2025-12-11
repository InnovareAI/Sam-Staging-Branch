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
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import {
  generateFollowUpMessage,
  createFollowUpDraft,
  detectScenario,
  determineChannel,
  FollowUpContext,
  FollowUpScenario
} from '@/lib/services/follow-up-agent-v2';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/follow-up-agent/drafts
 * List pending follow-up drafts for workspace
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const cookieStore = cookies();
    const authClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');
    const status = searchParams.get('status') || 'pending_approval';
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    // Fetch drafts with prospect and campaign info
    const { data: drafts, error } = await supabase
      .from('follow_up_drafts')
      .select(`
        *,
        campaign_prospects!prospect_id (
          id,
          first_name,
          last_name,
          company_name,
          title,
          linkedin_url,
          email
        ),
        campaigns!campaign_id (
          id,
          campaign_name
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching drafts:', error);
      return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      drafts,
      count: drafts?.length || 0
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
      // Auth check for non-cron requests
      const cookieStore = cookies();
      const authClient = createRouteHandlerClient({ cookies: () => cookieStore });
      const { data: { user } } = await authClient.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Verify workspace access
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspace_id)
        .eq('user_id', user.id)
        .single();

      if (!member) {
        return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
      }
    }

    // Fetch prospect details
    const { data: prospect, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select(`
        *,
        campaigns!campaign_id (
          id,
          campaign_name,
          workspace_id,
          message_templates
        )
      `)
      .eq('id', prospect_id)
      .single();

    if (prospectError || !prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    // Check for existing pending draft
    const { data: existingDraft } = await supabase
      .from('follow_up_drafts')
      .select('id')
      .eq('prospect_id', prospect_id)
      .eq('status', 'pending_approval')
      .single();

    if (existingDraft) {
      return NextResponse.json({
        error: 'Pending draft already exists for this prospect',
        draft_id: existingDraft.id
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
    const { data: previousFollowUps } = await supabase
      .from('follow_up_drafts')
      .select('message')
      .eq('prospect_id', prospect_id)
      .eq('status', 'sent')
      .order('created_at', { ascending: true });

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
      previous_follow_ups: previousFollowUps?.map(f => f.message) || []
    };

    console.log('📝 Generating follow-up draft:', {
      prospect: `${context.prospect.first_name} ${context.prospect.last_name}`,
      scenario,
      touch: touchNumber,
      channel: effectiveChannel
    });

    // Generate AI follow-up message
    const generated = await generateFollowUpMessage(context);

    // Create draft
    const draft = await createFollowUpDraft(context, generated);

    console.log('✅ Draft created:', draft.id);

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
