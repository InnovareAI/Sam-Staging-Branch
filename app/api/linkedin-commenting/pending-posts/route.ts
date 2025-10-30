import { createClient } from '@/app/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const trigger = request.headers.get('x-internal-trigger');
  if (trigger !== 'n8n-commenting-agent') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createClient();
  const { data } = await supabase.from('linkedin_posts_discovered').select('*').eq('status', 'pending').limit(5);
  return NextResponse.json({ posts: data || [] });
}
