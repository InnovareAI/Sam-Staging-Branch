import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const commentId = params.id;

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('linkedin_posts_discovered')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting comment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comment: data,
      message: 'Comment rejected'
    });

  } catch (error) {
    console.error('Error in reject endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to reject comment' },
      { status: 500 }
    );
  }
}
