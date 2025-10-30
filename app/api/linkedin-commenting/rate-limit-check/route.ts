import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const trigger = request.headers.get('x-internal-trigger');
  if (trigger !== 'n8n-commenting-agent') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { workspace_id } = await request.json();
  const supabase = await createClient();

  // Check hourly limit
  const { data: hourlyData } = await supabase.rpc('check_linkedin_comment_rate_limit', {
    p_workspace_id: workspace_id,
    p_period_hours: 1
  });

  return NextResponse.json(hourlyData || { within_limits: false });
}
