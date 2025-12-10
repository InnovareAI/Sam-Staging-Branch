/**
 * Reject a generated comment
 * POST /api/linkedin-commenting/reject-comment
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { comment_id } = body;

    if (!comment_id) {
      return NextResponse.json(
        { error: 'Missing comment_id' },
        { status: 400 }
      );
    }

    console.log('❌ Rejecting comment:', comment_id);

    // Verify user is authenticated
    const authClient = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to bypass RLS for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update comment status to 'rejected'
    const { data: comment, error: updateError } = await supabase
      .from('linkedin_post_comments')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', comment_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating comment status:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject comment', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('✅ Comment rejected successfully');

    // When a comment is rejected, reset the post to 'discovered' status
    // This allows the system to potentially generate a new comment for this post
    // OR discover new posts to replace the rejected content
    if (comment.post_id) {
      const { error: resetError } = await supabase
        .from('linkedin_posts_discovered')
        .update({
          status: 'skipped', // Mark as skipped so we don't regenerate for same post
          updated_at: new Date().toISOString()
        })
        .eq('id', comment.post_id);

      if (resetError) {
        console.warn('⚠️ Could not update post status:', resetError.message);
      }
    }

    // Count remaining pending comments for this workspace
    const { count: pendingCount } = await supabase
      .from('linkedin_post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', comment.workspace_id)
      .eq('status', 'pending_approval');

    // If we're running low on pending comments, trigger async discovery
    // This ensures the approval queue stays populated
    const LOW_THRESHOLD = 5;
    if ((pendingCount || 0) < LOW_THRESHOLD) {
      console.log(`📬 Low pending count (${pendingCount}), triggering background discovery...`);

      // Fire and forget - don't wait for discovery to complete
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';
      fetch(`${baseUrl}/api/linkedin-commenting/discover-posts-hashtag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET || ''
        }
      }).catch(err => console.warn('Background discovery failed:', err.message));
    }

    return NextResponse.json({
      success: true,
      comment,
      pending_remaining: pendingCount || 0
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
