/**
 * CRM OAuth Initiation Handler
 * Generates OAuth authorization URLs for CRM platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface InitiateOAuthRequest {
  workspace_id: string;
  crm_type: 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho' | 'activecampaign' | 'keap' | 'close' | 'copper' | 'freshsales';
}

export async function POST(request: NextRequest) {
  try {
    const body: InitiateOAuthRequest = await request.json();
    const { workspace_id, crm_type } = body;

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

    // Generate OAuth URL based on CRM type
    const authUrl = generateOAuthUrl(workspace_id, crm_type);

    return NextResponse.json({ auth_url: authUrl });

  } catch (error) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Generate OAuth authorization URL for CRM platform
 */
function generateOAuthUrl(workspaceId: string, crmType: string): string {
  // State parameter encodes workspace_id and crm_type for callback
  const state = `${workspaceId}:${crmType}`;

  switch (crmType) {
    case 'hubspot':
      return `https://app.hubspot.com/oauth/authorize?` +
        `client_id=${process.env.HUBSPOT_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.HUBSPOT_REDIRECT_URI!)}&` +
        `scope=${encodeURIComponent('crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write crm.objects.deals.read crm.objects.deals.write')}&` +
        `state=${encodeURIComponent(state)}`;

    case 'salesforce':
      return `https://login.salesforce.com/services/oauth2/authorize?` +
        `response_type=code&` +
        `client_id=${process.env.SALESFORCE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.SALESFORCE_REDIRECT_URI!)}&` +
        `scope=${encodeURIComponent('api refresh_token')}&` +
        `state=${encodeURIComponent(state)}`;

    case 'pipedrive':
      return `https://oauth.pipedrive.com/oauth/authorize?` +
        `client_id=${process.env.PIPEDRIVE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.PIPEDRIVE_REDIRECT_URI!)}&` +
        `state=${encodeURIComponent(state)}`;

    case 'zoho':
      return `https://accounts.zoho.com/oauth/v2/auth?` +
        `response_type=code&` +
        `client_id=${process.env.ZOHO_CLIENT_ID}&` +
        `scope=${encodeURIComponent('ZohoCRM.modules.ALL')}&` +
        `redirect_uri=${encodeURIComponent(process.env.ZOHO_REDIRECT_URI!)}&` +
        `access_type=offline&` +
        `state=${encodeURIComponent(state)}`;

    case 'activecampaign':
      return `https://${process.env.ACTIVECAMPAIGN_ACCOUNT}.api-us1.com/oauth/authorize?` +
        `client_id=${process.env.ACTIVECAMPAIGN_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.ACTIVECAMPAIGN_REDIRECT_URI!)}&` +
        `response_type=code&` +
        `state=${encodeURIComponent(state)}`;

    case 'keap':
      return `https://accounts.infusionsoft.com/app/oauth/authorize?` +
        `client_id=${process.env.KEAP_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.KEAP_REDIRECT_URI!)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('full')}&` +
        `state=${encodeURIComponent(state)}`;

    case 'close':
      return `https://app.close.com/oauth2/authorize/?` +
        `client_id=${process.env.CLOSE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.CLOSE_REDIRECT_URI!)}&` +
        `response_type=code&` +
        `state=${encodeURIComponent(state)}`;

    case 'copper':
      return `https://app.copper.com/oauth/authorize?` +
        `client_id=${process.env.COPPER_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.COPPER_REDIRECT_URI!)}&` +
        `response_type=code&` +
        `state=${encodeURIComponent(state)}`;

    case 'freshsales':
      return `https://${process.env.FRESHSALES_DOMAIN}.freshsales.io/oauth/authorize?` +
        `client_id=${process.env.FRESHSALES_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.FRESHSALES_REDIRECT_URI!)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('contacts:read contacts:write accounts:read accounts:write deals:read deals:write')}&` +
        `state=${encodeURIComponent(state)}`;

    default:
      throw new Error(`Unsupported CRM type: ${crmType}`);
  }
}
