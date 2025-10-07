
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
    // Get user stats
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, created_at')
      .order('created_at', { ascending: false });

    // Get organizations stats
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    // Get conversation stats
    const { data: conversations, error: convsError } = await supabase
      .from('sam_conversations')
      .select('id, user_id, organization_id, created_at')
      .order('created_at', { ascending: false });

    if (usersError || orgsError || convsError) {
      throw new Error('Database query failed');
    }

    // Calculate growth metrics
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const todayUsers = users?.filter(u => new Date(u.created_at) >= today).length || 0;
    const yesterdayUsers = users?.filter(u => {
      const created = new Date(u.created_at);
      return created >= yesterday && created < today;
    }).length || 0;
    const weekUsers = users?.filter(u => new Date(u.created_at) >= lastWeek).length || 0;

    const todayConvs = conversations?.filter(c => new Date(c.created_at) >= today).length || 0;
    const weekConvs = conversations?.filter(c => new Date(c.created_at) >= lastWeek).length || 0;

    // Organization usage
    const orgUsage = orgs?.map(org => ({
      id: org.id,
      name: org.name,
      users: users?.filter(u => conversations?.some(c => c.organization_id === org.id && c.user_id === u.id)).length || 0,
      conversations: conversations?.filter(c => c.organization_id === org.id).length || 0
    })) || [];

    return NextResponse.json({
      users: {
        total: users?.length || 0,
        today: todayUsers,
        yesterday: yesterdayUsers,
        thisWeek: weekUsers,
        growth: yesterdayUsers > 0 ? ((todayUsers - yesterdayUsers) / yesterdayUsers * 100) : 0
      },
      organizations: {
        total: orgs?.length || 0,
        active: orgUsage.filter(o => o.conversations > 0).length
      },
      conversations: {
        total: conversations?.length || 0,
        today: todayConvs,
        thisWeek: weekConvs,
        avgPerUser: users?.length ? (conversations?.length || 0) / users.length : 0
      },
      orgUsage: orgUsage.slice(0, 10) // Top 10 orgs
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
