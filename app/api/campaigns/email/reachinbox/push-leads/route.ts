/**
 * Push Leads to ReachInbox Campaign API
 *
 * POST /api/campaigns/email/reachinbox/push-leads
 *
 * Pushes approved prospects from SAM to an existing ReachInbox campaign.
 * The ReachInbox campaign should be pre-configured with email templates,
 * sequences, and warmup settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { reachInboxService, ReachInboxLead } from '@/lib/reachinbox';

interface PushLeadsRequest {
  reachinbox_campaign_id: string;
  sam_campaign_id?: string;
  prospect_ids?: string[];
  custom_fields?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();

    // Get user and workspace
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace from user metadata or workspace_members
    const { data: workspaceMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!workspaceMember) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspaceId = workspaceMember.workspace_id;

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
      // Fetch specific prospects by ID
      const { data: prospectData, error: prospectError } = await supabase
        .from('campaign_prospects')
        .select(
          `
          id,
          first_name,
          last_name,
          email,
          title,
          company_name,
          linkedin_url,
          phone,
          website,
          country,
          campaigns(campaign_name)
        `
        )
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
      // Fetch all pending prospects from a SAM campaign
      const { data: prospectData, error: prospectError } = await supabase
        .from('campaign_prospects')
        .select(
          `
          id,
          first_name,
          last_name,
          email,
          title,
          company_name,
          linkedin_url,
          phone,
          website,
          country,
          campaigns(campaign_name)
        `
        )
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
      firstName: prospect.first_name || '',
      lastName: prospect.last_name || '',
      companyName: prospect.company_name || '',
      jobTitle: prospect.title || '',
      linkedinUrl: prospect.linkedin_url || '',
      phone: prospect.phone || '',
      website: prospect.website || '',
      location: prospect.country || '',
      customFields: {
        sam_prospect_id: prospect.id,
        sam_campaign: (prospect.campaigns as any)?.campaign_name || '',
        ...request.custom_fields,
      },
    }));

    // Push leads to ReachInbox
    const result = await reachInboxService.pushLeadsToCampaign(
      request.reachinbox_campaign_id,
      reachInboxLeads
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to push leads to ReachInbox',
          details: result.errors,
        },
        { status: 500 }
      );
    }

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
        reachinbox_campaign_name: result.campaignName,
        leads_pushed: result.leadsPushed,
        leads_skipped: result.leadsSkipped,
        prospect_ids: prospectIds,
      },
    });

    console.log(
      `✅ Successfully pushed ${result.leadsPushed} leads to ReachInbox campaign "${result.campaignName}"`
    );

    return NextResponse.json({
      success: true,
      message: `Successfully pushed ${result.leadsPushed} leads to ReachInbox`,
      data: {
        reachinbox_campaign_id: result.campaignId,
        reachinbox_campaign_name: result.campaignName,
        leads_pushed: result.leadsPushed,
        leads_skipped: result.leadsSkipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
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
    const supabase = createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test connection and list campaigns
    const connectionTest = await reachInboxService.testConnection();

    if (!connectionTest.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'ReachInbox connection failed',
          details: connectionTest.error,
        },
        { status: 500 }
      );
    }

    // List campaigns
    const campaigns = await reachInboxService.listCampaigns();

    return NextResponse.json({
      success: true,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        type: c.type,
        leads_count: c.leadsCount,
        created_at: c.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('❌ List ReachInbox campaigns error:', error);
    return NextResponse.json(
      { error: 'Failed to list ReachInbox campaigns', details: error.message },
      { status: 500 }
    );
  }
}
