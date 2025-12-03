import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reply-agent/draft
 * Fetch a draft by ID and approval token
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const token = searchParams.get('token');

  if (!id || !token) {
    return NextResponse.json({ error: 'Missing id or token' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: draft, error } = await supabase
    .from('reply_agent_drafts')
    .select('*')
    .eq('id', id)
    .eq('approval_token', token)
    .single();

  if (error || !draft) {
    return NextResponse.json(
      { error: 'Draft not found or invalid token' },
      { status: 404 }
    );
  }

  // Check if draft is expired
  if (draft.expires_at && new Date(draft.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This draft has expired' },
      { status: 410 }
    );
  }

  // Check if already processed
  if (draft.status !== 'pending_approval') {
    return NextResponse.json(
      { error: `This draft was already ${draft.status}` },
      { status: 409 }
    );
  }

  return NextResponse.json({ draft });
}
