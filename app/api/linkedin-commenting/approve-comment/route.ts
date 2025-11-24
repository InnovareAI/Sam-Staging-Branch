/**
 * Approve a generated comment and post it to LinkedIn
 * POST /api/linkedin-commenting/approve-comment
 */

import { createClient } from '@/app/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

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

    console.log('✅ Approving comment:', comment_id);

    const supabase = await createClient();

    // Update comment status to 'approved'
    const { data: comment, error: updateError } = await supabase
      .from('linkedin_post_comments')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', comment_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating comment status:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve comment', details: updateError.message },
        { status: 500 }
      );
    }

    // TODO: Queue comment for posting to LinkedIn
    // This would integrate with Unipile API to actually post the comment

    console.log('✅ Comment approved successfully');

    return NextResponse.json({
      success: true,
      comment
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
