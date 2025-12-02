/**
 * ActiveCampaign API Key Connection
 * Connect to ActiveCampaign using account URL and API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface ConnectActiveCampaignRequest {
  workspace_id: string;
  account_url: string; // e.g., https://youraccountname.api-us1.com
  api_key: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConnectActiveCampaignRequest = await request.json();
    const { workspace_id, account_url, api_key } = body;

    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Clean account URL
    const cleanUrl = account_url.replace(/\/+$/, ''); // Remove trailing slashes

    // Validate credentials by making test API call
    const testResponse = await fetch(`${cleanUrl}/api/3/users/me`, {
      headers: {
        'Api-Token': api_key
      }
    });

    if (!testResponse.ok) {
      return NextResponse.json({
        error: 'Invalid API credentials. Please check your account URL and API key.'
      }, { status: 400 });
    }

    const userData = await testResponse.json();

    // Extract account name from URL
    const accountName = cleanUrl.match(/https?:\/\/([^.]+)/)?.[1] || 'ActiveCampaign';

    // Store connection in database
    const { error: dbError } = await supabase
      .from('crm_connections')
      .upsert({
        workspace_id,
        crm_type: 'activecampaign',
        access_token: api_key,
        refresh_token: null,
        expires_at: null, // API keys don't expire
        scope: null,
        crm_account_id: cleanUrl,
        crm_account_name: accountName,
        status: 'active',
        connected_at: new Date().toISOString(),
        last_synced_at: null
      }, {
        onConflict: 'workspace_id,crm_type'
      });

    if (dbError) {
      console.error('Database error storing CRM connection:', dbError);
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
    }

    // Create default field mappings
    await createDefaultFieldMappings(supabase, workspace_id);

    return NextResponse.json({
      success: true,
      account_name: accountName
    });

  } catch (error) {
    console.error('ActiveCampaign connection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function createDefaultFieldMappings(supabase: any, workspaceId: string) {
  const mappings = [
    { sam_field: 'firstName', crm_field: 'firstName', field_type: 'contact', data_type: 'string' },
    { sam_field: 'lastName', crm_field: 'lastName', field_type: 'contact', data_type: 'string' },
    { sam_field: 'email', crm_field: 'email', field_type: 'contact', data_type: 'string' },
    { sam_field: 'phone', crm_field: 'phone', field_type: 'contact', data_type: 'string' },
    { sam_field: 'companyName', crm_field: 'name', field_type: 'company', data_type: 'string' }
  ];

  const { error } = await supabase
    .from('crm_field_mappings')
    .upsert(
      mappings.map(m => ({
        workspace_id: workspaceId,
        crm_type: 'activecampaign',
        ...m,
        is_required: ['email', 'firstName', 'lastName'].includes(m.sam_field),
        is_custom: false
      })),
      {
        onConflict: 'workspace_id,crm_type,field_type,sam_field'
      }
    );

  if (error) {
    console.error('Error creating default field mappings:', error);
  }
}
