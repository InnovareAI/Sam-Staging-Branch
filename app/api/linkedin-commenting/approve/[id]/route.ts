import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, rejection_reason } = await request.json();

  const updateData: any = {
    approval_status: action === 'approve' ? 'approved' : 'rejected',
    approved_by: user.id,
    approved_at: new Date().toISOString()
  };

  if (action === 'reject') {
    updateData.rejection_reason = rejection_reason;
    updateData.status = 'cancelled';
  }

  const { data, error } = await supabase
    .from('linkedin_comment_queue')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
