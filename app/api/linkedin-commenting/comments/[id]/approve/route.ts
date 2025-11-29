import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const commentId = params.id;
    const body = await request.json().catch(() => ({}));
    const editedComment = body.comment;

    const supabase = await createServerSupabaseClient();

    // Update the comment status and optionally the comment text
    const updateData: any = {
      status: 'approved',
      approved_at: new Date().toISOString()
    };

    if (editedComment) {
      updateData.generated_comment = editedComment;
    }

    const { data, error } = await supabase
      .from('linkedin_posts_discovered')
      .update(updateData)
      .eq('id', commentId)
      .select()
      .single();

    if (error) {
      console.error('Error approving comment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comment: data,
      message: 'Comment approved and queued for posting'
    });

  } catch (error) {
    console.error('Error in approve endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to approve comment' },
      { status: 500 }
    );
  }
}
