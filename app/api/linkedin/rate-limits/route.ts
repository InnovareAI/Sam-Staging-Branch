import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * GET /api/linkedin/rate-limits
 *
 * Returns rate limit status for all LinkedIn accounts in a workspace.
 * Used to show warnings in the Campaign Hub when accounts are at/near limits.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace_id from query params or user metadata
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id') || user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Get all LinkedIn accounts for this workspace
    const { data: accounts, error: accountsError } = await supabase
      .from('workspace_accounts')
      .select('id, account_name, unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected');

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        success: true,
        accounts: [],
        message: 'No LinkedIn accounts connected'
      });
    }

    // Calculate rate limit status for each account
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const DAILY_LIMIT = 40; // Sales Navigator limit
    const WARNING_THRESHOLD = 35; // Show warning at 35+

    const accountStatuses = await Promise.all(
      accounts.map(async (account) => {
        // Get campaigns using this account
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('linkedin_account_id', account.id)
          .eq('status', 'active');

        const campaignIds = campaigns?.map(c => c.id) || [];

        if (campaignIds.length === 0) {
          return {
            accountId: account.id,
            accountName: account.account_name,
            sentToday: 0,
            dailyLimit: DAILY_LIMIT,
            remaining: DAILY_LIMIT,
            status: 'ok',
            message: null
          };
        }

        // Count CRs sent today from this account
        const { data: sentMessages, count } = await supabase
          .from('send_queue')
          .select('id', { count: 'exact' })
          .eq('status', 'sent')
          .in('campaign_id', campaignIds)
          .gte('sent_at', todayStart.toISOString());

        const sentToday = count || 0;
        const remaining = DAILY_LIMIT - sentToday;

        let status = 'ok';
        let message = null;

        if (sentToday >= DAILY_LIMIT) {
          status = 'limit_reached';
          message = `Daily limit reached (${sentToday}/${DAILY_LIMIT}). Sending will resume tomorrow.`;
        } else if (sentToday >= WARNING_THRESHOLD) {
          status = 'warning';
          message = `Approaching daily limit (${sentToday}/${DAILY_LIMIT}). ${remaining} remaining today.`;
        }

        return {
          accountId: account.id,
          accountName: account.account_name,
          sentToday,
          dailyLimit: DAILY_LIMIT,
          remaining,
          status,
          message
        };
      })
    );

    // Check if any account has warnings or limits
    const hasWarnings = accountStatuses.some(a => a.status === 'warning');
    const hasLimitsReached = accountStatuses.some(a => a.status === 'limit_reached');

    return NextResponse.json({
      success: true,
      accounts: accountStatuses,
      summary: {
        total: accountStatuses.length,
        atLimit: accountStatuses.filter(a => a.status === 'limit_reached').length,
        nearLimit: accountStatuses.filter(a => a.status === 'warning').length,
        ok: accountStatuses.filter(a => a.status === 'ok').length
      },
      hasWarnings,
      hasLimitsReached
    });

  } catch (error: any) {
    console.error('Rate limits API error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
