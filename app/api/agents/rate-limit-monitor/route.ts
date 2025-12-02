/**
 * Rate Limit Monitor Agent
 * Tracks LinkedIn daily/weekly limits per account
 *
 * POST /api/agents/rate-limit-monitor
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface AccountLimits {
  account_id: string;
  account_name: string;
  daily_cr_sent: number;
  daily_cr_limit: number;
  daily_cr_remaining: number;
  weekly_cr_sent: number;
  weekly_cr_limit: number;
  weekly_cr_remaining: number;
  daily_messages_sent: number;
  daily_message_limit: number;
  status: 'healthy' | 'warning' | 'critical' | 'blocked';
  recommendation: string;
}

// LinkedIn limits (conservative estimates)
const DAILY_CR_LIMIT = 20; // Connection requests per day
const WEEKLY_CR_LIMIT = 100; // Connection requests per week
const DAILY_MESSAGE_LIMIT = 50; // Messages per day

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');

  if (!cronSecret && !authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = supabaseAdmin();

    // Get all LinkedIn accounts from Unipile API (source of truth)
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileDsn || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Unipile API credentials not configured'
      }, { status: 503 });
    }

    const unipileResponse = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    if (!unipileResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve LinkedIn accounts from Unipile'
      }, { status: 503 });
    }

    const unipileData = await unipileResponse.json();
    const allAccounts = Array.isArray(unipileData) ? unipileData : (unipileData.items || unipileData.accounts || []);
    const linkedInAccounts = allAccounts.filter((acc: any) => acc.type === 'LINKEDIN');

    if (linkedInAccounts.length === 0) {
      return NextResponse.json({ success: true, message: 'No connected LinkedIn accounts' });
    }

    // Map Unipile accounts to our format
    const accounts = linkedInAccounts.map((acc: any) => ({
      id: acc.id,
      name: acc.name || acc.account_id,
      unipile_account_id: acc.id,
      connection_status: 'connected',
      workspace_id: null // We'll need to map this if needed
    }));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const accountLimits: AccountLimits[] = [];

    for (const account of accounts) {
      // Count today's CRs from send_queue
      const { count: dailyCRs } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', todayStart);

      // Count this week's CRs
      const { count: weeklyCRs } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', weekStart);

      // Count today's messages (if we have message tracking)
      const { count: dailyMessages } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('unipile_account_id', account.unipile_account_id)
        .in('status', ['messaging', 'message_sent'])
        .gte('last_follow_up_at', todayStart);

      const dailyCRSent = dailyCRs || 0;
      const weeklyCRSent = weeklyCRs || 0;
      const dailyMessagesSent = dailyMessages || 0;

      // Calculate remaining
      const dailyCRRemaining = Math.max(0, DAILY_CR_LIMIT - dailyCRSent);
      const weeklyCRRemaining = Math.max(0, WEEKLY_CR_LIMIT - weeklyCRSent);

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' | 'blocked' = 'healthy';
      let recommendation = 'All limits healthy - continue sending';

      if (dailyCRRemaining === 0 || weeklyCRRemaining === 0) {
        status = 'blocked';
        recommendation = dailyCRRemaining === 0
          ? 'Daily limit reached - wait until tomorrow'
          : 'Weekly limit reached - wait until next week';
      } else if (dailyCRRemaining <= 5 || weeklyCRRemaining <= 10) {
        status = 'critical';
        recommendation = `Only ${Math.min(dailyCRRemaining, weeklyCRRemaining)} CRs remaining - slow down`;
      } else if (dailyCRRemaining <= 10 || weeklyCRRemaining <= 30) {
        status = 'warning';
        recommendation = 'Approaching limits - monitor usage';
      }

      accountLimits.push({
        account_id: account.id,
        account_name: account.name,
        daily_cr_sent: dailyCRSent,
        daily_cr_limit: DAILY_CR_LIMIT,
        daily_cr_remaining: dailyCRRemaining,
        weekly_cr_sent: weeklyCRSent,
        weekly_cr_limit: WEEKLY_CR_LIMIT,
        weekly_cr_remaining: weeklyCRRemaining,
        daily_messages_sent: dailyMessagesSent,
        daily_message_limit: DAILY_MESSAGE_LIMIT,
        status,
        recommendation
      });

      // Store rate limit data
      await supabase
        .from('account_rate_limits')
        .upsert({
          account_id: account.id,
          date: todayStart,
          daily_cr_sent: dailyCRSent,
          weekly_cr_sent: weeklyCRSent,
          daily_messages_sent: dailyMessagesSent,
          status,
          updated_at: now.toISOString()
        }, { onConflict: 'account_id,date' });
    }

    // Summary
    const summary = {
      total_accounts: accountLimits.length,
      healthy: accountLimits.filter(a => a.status === 'healthy').length,
      warning: accountLimits.filter(a => a.status === 'warning').length,
      critical: accountLimits.filter(a => a.status === 'critical').length,
      blocked: accountLimits.filter(a => a.status === 'blocked').length,
      total_daily_cr_remaining: accountLimits.reduce((sum, a) => sum + a.daily_cr_remaining, 0),
      total_weekly_cr_remaining: accountLimits.reduce((sum, a) => sum + a.weekly_cr_remaining, 0)
    };

    // Alert if any accounts are critical or blocked
    const alerts = accountLimits
      .filter(a => a.status === 'critical' || a.status === 'blocked')
      .map(a => ({
        account: a.account_name,
        status: a.status,
        message: a.recommendation
      }));

    return NextResponse.json({
      success: true,
      summary,
      accounts: accountLimits,
      alerts: alerts.length > 0 ? alerts : undefined
    });

  } catch (error) {
    console.error('Rate limit monitor error:', error);
    return NextResponse.json({
      error: 'Rate limit check failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}
