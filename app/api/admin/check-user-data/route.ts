
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/security/route-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
    }

    // Get user
    const { data: authData } = await supabase.auth.admin.listUsers();
    const user = authData.users.find(u => u.email === email);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get their campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('created_by', user.id);

    // Get their prospects
    const { data: prospects } = await supabase
      .from('workspace_prospects')
      .select('id, email, first_name, last_name, company, created_at')
      .eq('created_by', user.id)
      .limit(100);

    // Get their accounts
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('user_id', user.id);

    // Get their knowledge base entries
    const { data: kb } = await supabase
      .from('knowledge_base')
      .select('id, title, type, created_at')
      .eq('created_by', user.id);

    return NextResponse.json({
      user_email: email,
      user_id: user.id,
      campaigns: campaigns || [],
      prospects_count: prospects?.length || 0,
      prospects: prospects || [],
      accounts: accounts || [],
      knowledge_base: kb || []
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
