/**
 * LinkedIn Commenting Agent - Poll Active Monitors
 * N8N calls this to get list of active monitors to process
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verify N8N internal trigger
    const triggerHeader = request.headers.get('x-internal-trigger');
    if (triggerHeader !== 'n8n-commenting-agent') {
      return NextResponse.json(
        { error: 'Unauthorized - N8N trigger required' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get monitors that are due for checking
    // Check if last_checked_at is older than check_frequency_minutes
    const { data: monitors, error } = await supabase
      .from('linkedin_post_monitors')
      .select(`
        *,
        workspaces!inner(name),
        workspace_accounts!inner(unipile_account_id, unipile_dsn, unipile_api_key)
      `)
      .eq('is_active', true)
      .eq('workspace_accounts.provider', 'linkedin')
      .eq('workspace_accounts.status', 'active')
      .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(Date.now() - 30 * 60 * 1000).toISOString()}`)
      .limit(20); // Process max 20 monitors per poll

    if (error) {
      console.error('❌ Error fetching monitors:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    console.log(`📊 Active monitors ready: ${monitors?.length || 0}`);

    if (!monitors || monitors.length === 0) {
      return NextResponse.json({ monitors: [] });
    }

    // Transform monitors for N8N
    const transformedMonitors = monitors.map(monitor => ({
      id: monitor.id,
      workspace_id: monitor.workspace_id,
      workspace_name: monitor.workspaces?.name,
      monitor_type: monitor.monitor_type,
      target_value: monitor.target_value,
      target_metadata: monitor.target_metadata || {},
      target_linkedin_id: monitor.target_metadata?.linkedin_id || extractLinkedInId(monitor.target_value),
      priority: monitor.priority,
      min_engagement_threshold: monitor.min_engagement_threshold || 0,
      exclude_keywords: monitor.exclude_keywords || [],
      prospect_id: monitor.prospect_id,
      campaign_id: monitor.campaign_id,
      unipile_account_id: monitor.workspace_accounts?.unipile_account_id,
      unipile_dsn: monitor.workspace_accounts?.unipile_dsn,
      unipile_api_key: monitor.workspace_accounts?.unipile_api_key
    }));

    return NextResponse.json({
      monitors: transformedMonitors,
      count: transformedMonitors.length,
      polled_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in monitors/poll:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract LinkedIn ID from URL
 * TODO: This is a placeholder - actual implementation needs Unipile profile lookup
 */
function extractLinkedInId(url: string): string {
  // Extract vanity URL from LinkedIn URL
  // Example: https://linkedin.com/in/john-doe → john-doe
  // Example: https://linkedin.com/company/acme-corp → acme-corp
  const match = url.match(/linkedin\.com\/(in|company)\/([^/?]+)/);
  if (match) {
    return match[2];
  }
  return url;
}
