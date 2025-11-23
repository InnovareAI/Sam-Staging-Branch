import { createClient } from '@/app/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { shouldAutoApproveComment, autoApproveQueuedComment } from '@/lib/services/auto-approval-service';

export const dynamic = 'force-dynamic';

/**
 * Auto-approve a LinkedIn comment based on monitor settings
 *
 * POST /api/linkedin-commenting/auto-approve
 *
 * Body: { monitorId: string, queueId: string }
 *
 * Returns: { autoApproved: boolean, reason: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user (optional for service-to-service calls)
    const { data: { user } } = await supabase.auth.getUser();

    // Parse request body
    const body = await request.json();
    const { monitorId, queueId } = body;

    if (!monitorId || !queueId) {
      return NextResponse.json(
        { error: 'Missing required fields: monitorId and queueId' },
        { status: 400 }
      );
    }

    console.log(`🔍 Auto-approval check for monitor ${monitorId}, queue ${queueId}`);

    // Check if comment should be auto-approved
    const shouldApprove = await shouldAutoApproveComment(monitorId);

    if (shouldApprove) {
      // Auto-approve the comment
      const approved = await autoApproveQueuedComment(queueId, user?.id);

      if (approved) {
        console.log(`✅ Auto-approved comment ${queueId}`);
        return NextResponse.json({
          autoApproved: true,
          reason: 'Within auto-approval window',
          queueId
        });
      } else {
        console.error(`❌ Failed to auto-approve comment ${queueId}`);
        return NextResponse.json({
          autoApproved: false,
          reason: 'Failed to update queue record',
          queueId
        }, { status: 500 });
      }
    } else {
      console.log(`⏳ Comment ${queueId} requires manual approval`);
      return NextResponse.json({
        autoApproved: false,
        reason: 'Outside auto-approval window or auto-approval disabled',
        queueId
      });
    }
  } catch (error) {
    console.error('❌ Error in auto-approve endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Get auto-approval status for a monitor
 *
 * GET /api/linkedin-commenting/auto-approve?monitorId=xxx
 *
 * Returns: { enabled: boolean, window: { start: string, end: string }, timezone: string }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const monitorId = request.nextUrl.searchParams.get('monitorId');

    if (!monitorId) {
      return NextResponse.json(
        { error: 'Missing required parameter: monitorId' },
        { status: 400 }
      );
    }

    // Get monitor auto-approval settings
    const { data: monitor, error } = await supabase
      .from('linkedin_post_monitors')
      .select('auto_approve_enabled, auto_approve_start_time, auto_approve_end_time, timezone')
      .eq('id', monitorId)
      .single();

    if (error || !monitor) {
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      enabled: monitor.auto_approve_enabled,
      window: {
        start: monitor.auto_approve_start_time,
        end: monitor.auto_approve_end_time
      },
      timezone: monitor.timezone
    });
  } catch (error) {
    console.error('❌ Error in auto-approve GET endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
