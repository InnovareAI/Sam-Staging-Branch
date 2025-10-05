/**
 * CRM OAuth Callback Handler
 * Handles OAuth redirects from CRM platforms and stores credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface OAuthCallbackParams {
  code: string;
  state: string; // Contains workspace_id and crm_type
  error?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      new URL(`/workspace?crm_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/workspace?crm_error=missing_parameters', request.url)
    );
  }

  try {
    // Decode state parameter (format: workspace_id:crm_type)
    const [workspaceId, crmType] = state.split(':');

    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL('/login?redirect=/workspace', request.url)
      );
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.redirect(
        new URL('/workspace?crm_error=unauthorized', request.url)
      );
    }

    // Exchange code for tokens based on CRM type
    let tokenData: any;

    switch (crmType) {
      case 'hubspot':
        tokenData = await exchangeHubSpotCode(code);
        break;
      case 'salesforce':
        tokenData = await exchangeSalesforceCode(code);
        break;
      // Add other CRM types as implemented
      default:
        throw new Error(`Unsupported CRM type: ${crmType}`);
    }

    // Store connection in database
    const { error: dbError } = await supabase
      .from('crm_connections')
      .upsert({
        workspace_id: workspaceId,
        crm_type: crmType,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at,
        scope: tokenData.scope,
        crm_account_id: tokenData.account_id,
        crm_account_name: tokenData.account_name,
        status: 'active',
        connected_at: new Date().toISOString(),
        last_synced_at: null
      }, {
        onConflict: 'workspace_id,crm_type'
      });

    if (dbError) {
      console.error('Database error storing CRM connection:', dbError);
      throw dbError;
    }

    // Create default field mappings
    await createDefaultFieldMappings(supabase, workspaceId, crmType);

    // Redirect to workspace with success message
    return NextResponse.redirect(
      new URL(`/workspace/${workspaceId}?crm_connected=${crmType}`, request.url)
    );

  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      new URL(`/workspace?crm_error=${encodeURIComponent(err instanceof Error ? err.message : 'unknown_error')}`, request.url)
    );
  }
}

/**
 * Exchange HubSpot authorization code for tokens
 */
async function exchangeHubSpotCode(code: string) {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      redirect_uri: process.env.HUBSPOT_REDIRECT_URI!,
      code
    })
  });

  if (!response.ok) {
    throw new Error('HubSpot token exchange failed');
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scope: data.scope?.split(' ') || [],
    account_id: data.hub_id,
    account_name: data.hub_domain
  };
}

/**
 * Exchange Salesforce authorization code for tokens
 */
async function exchangeSalesforceCode(code: string) {
  const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
      redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
      code
    })
  });

  if (!response.ok) {
    throw new Error('Salesforce token exchange failed');
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: null, // Salesforce tokens don't expire by default
    scope: data.scope?.split(' ') || [],
    account_id: data.id.split('/').pop(),
    account_name: data.instance_url
  };
}

/**
 * Create default field mappings for a new CRM connection
 */
async function createDefaultFieldMappings(
  supabase: any,
  workspaceId: string,
  crmType: string
) {
  const defaultMappings = {
    hubspot: [
      { sam_field: 'firstName', crm_field: 'firstname', field_type: 'contact', data_type: 'string' },
      { sam_field: 'lastName', crm_field: 'lastname', field_type: 'contact', data_type: 'string' },
      { sam_field: 'email', crm_field: 'email', field_type: 'contact', data_type: 'string' },
      { sam_field: 'phone', crm_field: 'phone', field_type: 'contact', data_type: 'string' },
      { sam_field: 'company', crm_field: 'company', field_type: 'contact', data_type: 'string' },
      { sam_field: 'jobTitle', crm_field: 'jobtitle', field_type: 'contact', data_type: 'string' },
      { sam_field: 'companyName', crm_field: 'name', field_type: 'company', data_type: 'string' },
      { sam_field: 'companyDomain', crm_field: 'domain', field_type: 'company', data_type: 'string' },
      { sam_field: 'companyIndustry', crm_field: 'industry', field_type: 'company', data_type: 'string' }
    ],
    salesforce: [
      { sam_field: 'firstName', crm_field: 'FirstName', field_type: 'contact', data_type: 'string' },
      { sam_field: 'lastName', crm_field: 'LastName', field_type: 'contact', data_type: 'string' },
      { sam_field: 'email', crm_field: 'Email', field_type: 'contact', data_type: 'string' },
      { sam_field: 'phone', crm_field: 'Phone', field_type: 'contact', data_type: 'string' },
      { sam_field: 'jobTitle', crm_field: 'Title', field_type: 'contact', data_type: 'string' },
      { sam_field: 'companyName', crm_field: 'Name', field_type: 'company', data_type: 'string' },
      { sam_field: 'companyDomain', crm_field: 'Website', field_type: 'company', data_type: 'string' },
      { sam_field: 'companyIndustry', crm_field: 'Industry', field_type: 'company', data_type: 'string' }
    ]
  };

  const mappings = defaultMappings[crmType as keyof typeof defaultMappings] || [];

  const { error } = await supabase
    .from('crm_field_mappings')
    .upsert(
      mappings.map(m => ({
        workspace_id: workspaceId,
        crm_type: crmType,
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
