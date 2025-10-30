import { createClient } from '@/app/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const trigger = request.headers.get('x-internal-trigger');
  if (trigger !== 'n8n-commenting-agent') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createClient();

  // Get comments that are queued AND either auto-approved or manually approved
  const { data } = await supabase
    .from('linkedin_comment_queue')
    .select('*')
    .eq('status', 'queued')
    .or('requires_approval.eq.false,and(requires_approval.eq.true,approval_status.eq.approved)')
    .limit(3);

  return NextResponse.json({ comments: data || [] });
}
