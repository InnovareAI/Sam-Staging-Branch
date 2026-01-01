/**
 * Push Leads to ReachInbox Campaign API
 *
 * POST /api/campaigns/email/reachinbox/push-leads
 *
 * Pushes approved prospects from SAM to an existing ReachInbox campaign.
 * Uses workspace-level ReachInbox API key from workspace_tiers.integration_config.
 *
 * Note: Users can EITHER use Unipile (Google/Microsoft) OR ReachInbox, not both.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

const REACHINBOX_API_URL = 'https://api.reachinbox.ai/api/v1';

interface PushLeadsRequest {
  reachinbox_campaign_id: string;
  sam_campaign_id?: string;
  prospect_ids?: string[];
  custom_fields?: Record<string, string>;
}

interface ReachInboxLead {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  job_title?: string;
  linkedin_url?: string;
  phone?: string;
  website?: string;
  location?: string;
  [key: string]: string | undefined;
}

/**
 * Get workspace's ReachInbox API key from database
 */
async function getWorkspaceReachInboxKey(supabase: any, workspaceId: string): Promise<string | null> {
  const { data: tierConfig } = await supabase
    .from('workspace_tiers')
    .select('integration_config')
    .eq('workspace_id', workspaceId)
    .single();

  return tierConfig?.integration_config?.reachinbox_api_key || null;
}

/**
 * Make ReachInbox API request with workspace key
 */
async function reachInboxRequest(
  apiKey: string,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  data?: any
) {
  const url = `${REACHINBOX_API_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (data && method === 'POST') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ReachInbox API error (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export async function POST(req: NextRequest) {
  try {
    // Get user and workspace
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace from user
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!workspaceMember) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspaceId = workspaceMember.workspace_id;

    // Get workspace's ReachInbox API key
    const apiKey = await getWorkspaceReachInboxKey(supabase, workspaceId);

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'ReachInbox not configured',
          details: 'Please add your ReachInbox API key in Settings > Integrations',
        },
        { status: 400 }
      );
    }

    // Parse request body
    const request: PushLeadsRequest = await req.json();

    if (!request.reachinbox_campaign_id) {
      return NextResponse.json(
        { error: 'ReachInbox campaign ID is required' },
        { status: 400 }
      );
    }

    // Fetch prospects based on provided IDs or SAM campaign
    let prospects: any[] = [];

    if (request.prospect_ids && request.prospect_ids.length > 0) {
      const { data: prospectData, error: prospectError } = await supabase
        .from('campaign_prospects')
        .select(`
          id, first_name, last_name, email, title, company_name,
          linkedin_url, phone, website, country,
          campaigns(campaign_name)
        `)
        .eq('workspace_id', workspaceId)
        .in('id', request.prospect_ids);

      if (prospectError) {
        console.error('Error fetching prospects:', prospectError);
        return NextResponse.json(
          { error: 'Failed to fetch prospects', details: prospectError.message },
          { status: 500 }
        );
      }

      prospects = prospectData || [];
    } else if (request.sam_campaign_id) {
      const { data: prospectData, error: prospectError } = await supabase
        .from('campaign_prospects')
        .select(`
          id, first_name, last_name, email, title, company_name,
          linkedin_url, phone, website, country,
          campaigns(campaign_name)
        `)
        .eq('campaign_id', request.sam_campaign_id)
        .in('status', ['pending', 'approved'])
        .not('email', 'is', null);

      if (prospectError) {
        console.error('Error fetching campaign prospects:', prospectError);
        return NextResponse.json(
          { error: 'Failed to fetch campaign prospects', details: prospectError.message },
          { status: 500 }
        );
      }

      prospects = prospectData || [];
    } else {
      return NextResponse.json(
        { error: 'Either prospect_ids or sam_campaign_id is required' },
        { status: 400 }
      );
    }

    // Filter out prospects without email
    const validProspects = prospects.filter((p) => p.email);

    if (validProspects.length === 0) {
      return NextResponse.json(
        { error: 'No valid prospects with email addresses found' },
        { status: 400 }
      );
    }

    console.log(`📤 Pushing ${validProspects.length} prospects to ReachInbox campaign ${request.reachinbox_campaign_id}`);

    // Convert to ReachInbox lead format
    const reachInboxLeads: ReachInboxLead[] = validProspects.map((prospect) => ({
      email: prospect.email,
      first_name: prospect.first_name || '',
      last_name: prospect.last_name || '',
      company_name: prospect.company_name || '',
      job_title: prospect.title || '',
      linkedin_url: prospect.linkedin_url || '',
      phone: prospect.phone || '',
      website: prospect.website || '',
      location: prospect.country || '',
      custom_sam_prospect_id: prospect.id,
      custom_sam_campaign: (prospect.campaigns as any)?.campaign_name || '',
    }));

    // Push leads to ReachInbox
    let result;
    try {
      result = await reachInboxRequest(
        apiKey,
        `/campaigns/${request.reachinbox_campaign_id}/leads`,
        'POST',
        { leads: reachInboxLeads }
      );
    } catch (error: any) {
      console.error('❌ ReachInbox push failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to push leads to ReachInbox',
          details: error.message,
        },
        { status: 500 }
      );
    }

    // Get campaign name
    let campaignName = request.reachinbox_campaign_id;
    try {
      const campaignInfo = await reachInboxRequest(
        apiKey,
        `/campaigns/${request.reachinbox_campaign_id}`
      );
      campaignName = campaignInfo.data?.name || campaignInfo.name || request.reachinbox_campaign_id;
    } catch {
      // Ignore campaign name fetch error
    }

    const leadsPushed = result.data?.added || result.added || validProspects.length;
    const leadsSkipped = result.data?.skipped || result.skipped || 0;

    // Update prospect status in SAM database
    const prospectIds = validProspects.map((p) => p.id);

    await supabase
      .from('campaign_prospects')
      .update({
        status: 'email_scheduled',
        reachinbox_campaign_id: request.reachinbox_campaign_id,
        updated_at: new Date().toISOString(),
      })
      .in('id', prospectIds);

    // Log the sync event
    await supabase.from('activity_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action_type: 'reachinbox_push',
      entity_type: 'campaign_prospects',
      entity_id: request.sam_campaign_id || request.reachinbox_campaign_id,
      metadata: {
        reachinbox_campaign_id: request.reachinbox_campaign_id,
        reachinbox_campaign_name: campaignName,
        leads_pushed: leadsPushed,
        leads_skipped: leadsSkipped,
        prospect_ids: prospectIds,
      },
    });

    console.log(`✅ Successfully pushed ${leadsPushed} leads to ReachInbox campaign "${campaignName}"`);

    return NextResponse.json({
      success: true,
      message: `Successfully pushed ${leadsPushed} leads to ReachInbox`,
      data: {
        reachinbox_campaign_id: request.reachinbox_campaign_id,
        reachinbox_campaign_name: campaignName,
        leads_pushed: leadsPushed,
        leads_skipped: leadsSkipped,
      },
    });
  } catch (error: any) {
    console.error('❌ Push to ReachInbox error:', error);
    return NextResponse.json(
      { error: 'Failed to push leads to ReachInbox', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - List available ReachInbox campaigns
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!workspaceMember) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get workspace's ReachInbox API key
    const apiKey = await getWorkspaceReachInboxKey(supabase, workspaceMember.workspace_id);

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'ReachInbox not configured',
          details: 'Please add your ReachInbox API key in Settings > Integrations',
        },
        { status: 400 }
      );
    }

    // List campaigns from ReachInbox
    try {
      const response = await reachInboxRequest(apiKey, '/campaigns');
      const campaigns = response.data || response.campaigns || [];

      return NextResponse.json({
        success: true,
        campaigns: campaigns.map((c: any) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          type: c.type,
          leads_count: c.leadsCount || c.leads_count || 0,
          created_at: c.createdAt || c.created_at,
        })),
      });
    } catch (error: any) {
      console.error('❌ Failed to list ReachInbox campaigns:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to connect to ReachInbox',
          details: error.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('❌ List ReachInbox campaigns error:', error);
    return NextResponse.json(
      { error: 'Failed to list ReachInbox campaigns', details: error.message },
      { status: 500 }
    );
  }
}
