/**
 * Cron Job: Check Meeting Status
 *
 * POST /api/cron/check-meeting-status
 *
 * Runs every 15 minutes to:
 * 1. Detect no-shows (meeting time passed, no completion)
 * 2. Generate AI follow-up drafts for no-shows
 * 3. Check for meetings needing post-meeting follow-up
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import {
  detectNoShows,
  updateMeetingStatus,
  generateMeetingFollowUp,
  createMeetingFollowUpDraft,
  MeetingContext,
} from '@/lib/services/meeting-agent';

export const maxDuration = 120; // 2 minutes

export async function POST(req: NextRequest) {
  try {
    // Security check
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Checking meeting statuses...');

    const results = {
      no_shows_detected: 0,
      follow_ups_generated: 0,
      post_meeting_follow_ups: 0,
      errors: [] as string[],
    };

    // ============================================
    // 1. DETECT NO-SHOWS
    // ============================================
    console.log('📊 Detecting no-shows...');

    const noShowIds = await detectNoShows();
    results.no_shows_detected = noShowIds.length;

    // Generate follow-up drafts for no-shows
    for (const meetingId of noShowIds) {
      try {
        const { data: meeting } = await supabase
          .from('meetings')
          .select(`
            *,
            campaign_prospects (
              id, first_name, last_name, email, company_name, title, linkedin_url
            )
          `)
          .eq('id', meetingId)
          .single();

        if (!meeting || !meeting.campaign_prospects) continue;

        const context: MeetingContext = {
          meeting_id: meeting.id,
          prospect: {
            id: meeting.campaign_prospects.id,
            first_name: meeting.campaign_prospects.first_name || '',
            last_name: meeting.campaign_prospects.last_name || '',
            email: meeting.campaign_prospects.email,
            company_name: meeting.campaign_prospects.company_name,
            title: meeting.campaign_prospects.title,
            linkedin_url: meeting.campaign_prospects.linkedin_url,
          },
          workspace_id: meeting.workspace_id,
          meeting: {
            scheduled_at: new Date(meeting.scheduled_at),
            duration_minutes: meeting.duration_minutes,
            title: meeting.title,
            meeting_link: meeting.meeting_link,
            status: meeting.status,
          },
        };

        // Generate AI follow-up
        const followUp = await generateMeetingFollowUp(context, 'no_show');

        // Create draft for HITL approval
        await createMeetingFollowUpDraft(context, followUp);

        // Mark that follow-up was generated
        await supabase
          .from('meetings')
          .update({ no_show_follow_up_sent_at: new Date().toISOString() })
          .eq('id', meetingId);

        results.follow_ups_generated++;
        console.log(`   ✅ No-show follow-up generated for meeting ${meetingId}`);

      } catch (error: any) {
        results.errors.push(`No-show follow-up error for ${meetingId}: ${error.message}`);
        console.error(`   ❌ Error generating no-show follow-up:`, error);
      }
    }

    // ============================================
    // 2. CHECK FOR COMPLETED MEETINGS NEEDING FOLLOW-UP
    // ============================================
    console.log('📊 Checking for post-meeting follow-ups...');

    // Find completed meetings without follow-up (completed 1-24 hours ago)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data: completedMeetings } = await supabase
      .from('meetings')
      .select(`
        *,
        campaign_prospects (
          id, first_name, last_name, email, company_name, title, linkedin_url
        )
      `)
      .eq('status', 'completed')
      .gt('completed_at', oneDayAgo.toISOString())
      .lt('completed_at', oneHourAgo.toISOString())
      .is('post_meeting_follow_up_sent_at', null);

    for (const meeting of completedMeetings || []) {
      try {
        if (!meeting.campaign_prospects) continue;

        // Check if draft already exists
        const { data: existingDraft } = await supabase
          .from('meeting_follow_up_drafts')
          .select('id')
          .eq('meeting_id', meeting.id)
          .eq('follow_up_type', 'post_meeting')
          .in('status', ['pending_generation', 'pending_approval', 'approved'])
          .single();

        if (existingDraft) continue;

        const context: MeetingContext = {
          meeting_id: meeting.id,
          prospect: {
            id: meeting.campaign_prospects.id,
            first_name: meeting.campaign_prospects.first_name || '',
            last_name: meeting.campaign_prospects.last_name || '',
            email: meeting.campaign_prospects.email,
            company_name: meeting.campaign_prospects.company_name,
            title: meeting.campaign_prospects.title,
            linkedin_url: meeting.campaign_prospects.linkedin_url,
          },
          workspace_id: meeting.workspace_id,
          meeting: {
            scheduled_at: new Date(meeting.scheduled_at),
            duration_minutes: meeting.duration_minutes,
            title: meeting.title,
            meeting_link: meeting.meeting_link,
            status: meeting.status,
          },
        };

        // Generate AI follow-up
        const followUp = await generateMeetingFollowUp(context, 'post_meeting');

        // Create draft for HITL approval
        await createMeetingFollowUpDraft(context, followUp);

        results.post_meeting_follow_ups++;
        console.log(`   ✅ Post-meeting follow-up generated for meeting ${meeting.id}`);

      } catch (error: any) {
        results.errors.push(`Post-meeting follow-up error for ${meeting.id}: ${error.message}`);
        console.error(`   ❌ Error generating post-meeting follow-up:`, error);
      }
    }

    // ============================================
    // 3. CHECK FOR CANCELLED MEETINGS NEEDING RESCHEDULE
    // ============================================
    console.log('📊 Checking for cancelled meetings needing reschedule...');

    // Find recently cancelled meetings without follow-up
    const { data: cancelledMeetings } = await supabase
      .from('meetings')
      .select(`
        *,
        campaign_prospects (
          id, first_name, last_name, email, company_name, title, linkedin_url
        )
      `)
      .eq('status', 'cancelled')
      .gt('cancelled_at', oneDayAgo.toISOString())
      .lt('reschedule_attempts', 3); // Don't keep trying forever

    for (const meeting of cancelledMeetings || []) {
      try {
        if (!meeting.campaign_prospects) continue;

        // Check if reschedule draft already exists
        const { data: existingDraft } = await supabase
          .from('meeting_follow_up_drafts')
          .select('id')
          .eq('meeting_id', meeting.id)
          .eq('follow_up_type', 'reschedule')
          .in('status', ['pending_generation', 'pending_approval', 'approved', 'sent'])
          .single();

        if (existingDraft) continue;

        const context: MeetingContext = {
          meeting_id: meeting.id,
          prospect: {
            id: meeting.campaign_prospects.id,
            first_name: meeting.campaign_prospects.first_name || '',
            last_name: meeting.campaign_prospects.last_name || '',
            email: meeting.campaign_prospects.email,
            company_name: meeting.campaign_prospects.company_name,
            title: meeting.campaign_prospects.title,
            linkedin_url: meeting.campaign_prospects.linkedin_url,
          },
          workspace_id: meeting.workspace_id,
          meeting: {
            scheduled_at: new Date(meeting.scheduled_at),
            duration_minutes: meeting.duration_minutes,
            title: meeting.title,
            meeting_link: meeting.meeting_link,
            status: meeting.status,
          },
        };

        // Generate AI reschedule message
        const followUp = await generateMeetingFollowUp(context, 'reschedule');

        // Create draft for HITL approval
        await createMeetingFollowUpDraft(context, followUp);

        // Increment reschedule attempts
        await supabase
          .from('meetings')
          .update({ reschedule_attempts: (meeting.reschedule_attempts || 0) + 1 })
          .eq('id', meeting.id);

        results.follow_ups_generated++;
        console.log(`   ✅ Reschedule message generated for meeting ${meeting.id}`);

      } catch (error: any) {
        results.errors.push(`Reschedule error for ${meeting.id}: ${error.message}`);
      }
    }

    console.log('\n📊 Meeting Status Check Summary:');
    console.log(`   - No-shows detected: ${results.no_shows_detected}`);
    console.log(`   - Follow-ups generated: ${results.follow_ups_generated}`);
    console.log(`   - Post-meeting follow-ups: ${results.post_meeting_follow_ups}`);
    console.log(`   - Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error: any) {
    console.error('❌ Meeting status check error:', error);
    return NextResponse.json({
      error: 'Failed to check meeting statuses',
      details: error.message,
    }, { status: 500 });
  }
}
