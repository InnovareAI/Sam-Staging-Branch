import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

/**
 * Resolve LinkedIn URLs to provider_ids (chat IDs)
 *
 * This endpoint:
 * 1. Takes an array of prospects with LinkedIn URLs
 * 2. Resolves each URL to a provider_id via Unipile
 * 3. Returns prospects with resolved provider_ids
 *
 * Used before creating Connector campaigns to ensure we have valid IDs.
 */

// Unipile API helper
async function unipileRequest(endpoint: string) {
  const dsn = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
  const apiKey = process.env.UNIPILE_API_KEY;

  if (!apiKey) throw new Error('UNIPILE_API_KEY not configured');

  const baseUrl = dsn.includes('://') ? dsn : `https://${dsn}`;
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prospects, workspaceId } = await req.json();

    if (!prospects || !Array.isArray(prospects)) {
      return NextResponse.json({
        error: 'prospects array is required'
      }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({
        error: 'workspaceId is required'
      }, { status: 400 });
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get Unipile LinkedIn account for this workspace
    const { data: workspaceAccount } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .in('connection_status', VALID_CONNECTION_STATUSES)
      .single();

    if (!workspaceAccount?.unipile_account_id) {
      return NextResponse.json({
        error: 'No connected LinkedIn account found for this workspace'
      }, { status: 400 });
    }

    const unipileAccountId = workspaceAccount.unipile_account_id;
    console.log(`🔍 Resolving LinkedIn IDs for ${prospects.length} prospects using account ${unipileAccountId}`);

    // Resolve each prospect's LinkedIn URL to provider_id
    const resolvedProspects: any[] = [];
    const failedProspects: any[] = [];

    for (const prospect of prospects) {
      const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || prospect.linkedinUrl;

      if (!linkedinUrl) {
        failedProspects.push({
          ...prospect,
          resolution_error: 'No LinkedIn URL'
        });
        continue;
      }

      // Extract vanity identifier from URL
      const vanityMatch = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
      if (!vanityMatch) {
        failedProspects.push({
          ...prospect,
          resolution_error: 'Invalid LinkedIn URL format'
        });
        continue;
      }

      const vanityId = vanityMatch[1];

      try {
        // Use legacy endpoint to get provider_id (most reliable)
        const profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${unipileAccountId}`);

        if (profile.provider_id) {
          resolvedProspects.push({
            ...prospect,
            linkedin_user_id: profile.provider_id,
            connection_degree: prospect.connection_degree || (profile.network_distance === 'FIRST_DEGREE' ? '1st' : '2nd')
          });
          console.log(`  ✅ Resolved ${prospect.name || vanityId}: ${profile.provider_id}`);
        } else {
          failedProspects.push({
            ...prospect,
            resolution_error: 'No provider_id in profile response'
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`  ❌ Failed to resolve ${prospect.name || vanityId}:`, error);
        failedProspects.push({
          ...prospect,
          resolution_error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`📊 Resolution complete: ${resolvedProspects.length} resolved, ${failedProspects.length} failed`);

    return NextResponse.json({
      success: true,
      resolved: resolvedProspects,
      failed: failedProspects,
      summary: {
        total: prospects.length,
        resolved: resolvedProspects.length,
        failed: failedProspects.length
      }
    });

  } catch (error) {
    console.error('LinkedIn ID resolution error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
