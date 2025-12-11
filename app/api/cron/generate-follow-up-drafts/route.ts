/**
 * Cron Job: Generate Follow-Up Drafts
 *
 * POST /api/cron/generate-follow-up-drafts
 *
 * Runs every hour to:
 * 1. Find prospects due for follow-up
 * 2. Detect the appropriate scenario
 * 3. Generate AI-powered follow-up draft
 * 4. Save to follow_up_drafts table for HITL approval
 *
 * This creates drafts but does NOT send them.
 * The send-approved-follow-ups cron handles sending after human approval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generateFollowUpMessage,
  createFollowUpDraft,
  detectScenario,
  determineChannel,
  calculateNextFollowUpDate,
  FollowUpContext,
  FollowUpScenario
} from '@/lib/services/follow-up-agent-v2';

export const maxDuration = 300; // 5 minutes

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Security check
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Generating follow-up drafts...');

    // 1. Find prospects due for follow-up who don't have pending drafts
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        *,
        campaigns!inner (
          id,
          campaign_name,
          workspace_id,
          message_templates,
          campaign_type
        )
      `)
      // Prospects who need follow-up
      .in('status', ['connected', 'messaging', 'replied'])
      .not('follow_up_due_at', 'is', null)
      .lte('follow_up_due_at', new Date().toISOString())
      // Limit to avoid timeouts
      .order('follow_up_due_at', { ascending: true })
      .limit(20);

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log('✅ No prospects due for follow-up');
      return NextResponse.json({
        success: true,
        generated: 0,
        message: 'No prospects due for follow-up'
      });
    }

    console.log(`📊 Found ${prospects.length} prospects due for follow-up`);

    const results: Array<{
      prospectId: string;
      name: string;
      status: 'generated' | 'skipped' | 'error';
      draftId?: string;
      error?: string;
    }> = [];

    for (const prospect of prospects) {
      try {
        const prospectName = `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim();
        console.log(`\n👤 Processing: ${prospectName}`);

        // Check if there's already a pending draft for this prospect
        const { data: existingDraft } = await supabase
          .from('follow_up_drafts')
          .select('id')
          .eq('prospect_id', prospect.id)
          .in('status', ['pending_generation', 'pending_approval', 'approved'])
          .single();

        if (existingDraft) {
          console.log(`⏭️ Skipping - pending draft already exists: ${existingDraft.id}`);
          results.push({
            prospectId: prospect.id,
            name: prospectName,
            status: 'skipped',
            error: 'Pending draft already exists'
          });
          continue;
        }

        // Detect scenario based on prospect state
        const scenario: FollowUpScenario = detectScenario({
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

        // Determine channel (may switch to email for touch 3+)
        const originalChannel = prospect.campaigns?.campaign_type === 'email' ? 'email' : 'linkedin';
        const effectiveChannel = determineChannel(
          {
            id: prospect.id,
            first_name: prospect.first_name,
            last_name: prospect.last_name,
            linkedin_url: prospect.linkedin_url,
            email: prospect.email
          },
          touchNumber,
          originalChannel
        );

        // Calculate days since last contact
        const lastContact = prospect.last_follow_up_at || prospect.connection_request_sent || prospect.created_at;
        const daysSinceContact = Math.floor(
          (Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Get previous follow-ups for context
        const { data: previousFollowUps } = await supabase
          .from('follow_up_drafts')
          .select('message')
          .eq('prospect_id', prospect.id)
          .eq('status', 'sent')
          .order('created_at', { ascending: true });

        // Build context for AI generation
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
            workspace_id: prospect.campaigns.workspace_id
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

        console.log(`📝 Generating draft:`, {
          scenario,
          touch: touchNumber,
          channel: effectiveChannel,
          daysSince: daysSinceContact
        });

        // Generate AI-powered follow-up message
        const generated = await generateFollowUpMessage(context);

        // Create draft in database
        const draft = await createFollowUpDraft(context, generated);

        console.log(`✅ Draft created: ${draft.id}`);

        results.push({
          prospectId: prospect.id,
          name: prospectName,
          status: 'generated',
          draftId: draft.id
        });

        // Small delay between AI calls
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.error(`❌ Error processing prospect:`, error);
        results.push({
          prospectId: prospect.id,
          name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
          status: 'error',
          error: error.message
        });
      }
    }

    const generated = results.filter(r => r.status === 'generated').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`\n📊 Summary:`);
    console.log(`   - Generated: ${generated}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Errors: ${errors}`);

    return NextResponse.json({
      success: true,
      processed: prospects.length,
      generated,
      skipped,
      errors,
      results
    });

  } catch (error: any) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json({
      error: 'Failed to generate follow-up drafts',
      details: error.message
    }, { status: 500 });
  }
}
