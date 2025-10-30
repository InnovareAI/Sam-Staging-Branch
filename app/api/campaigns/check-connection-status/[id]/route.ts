/**
 * Check LinkedIn Connection Status
 * Used by N8N workflow to check if connection request was accepted
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prospectId = params.id;

    if (!prospectId) {
      return NextResponse.json(
        { error: 'Prospect ID required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Checking connection status for prospect: ${prospectId}`);

    // Use service role for N8N callbacks
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get prospect data
    const { data: prospect, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select('*, campaigns!inner(*)')
      .eq('id', prospectId)
      .single();

    if (prospectError || !prospect) {
      console.error('❌ Prospect not found:', prospectError);
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      );
    }

    // Get workspace LinkedIn account
    const { data: linkedinAccount, error: accountError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', prospect.campaigns.workspace_id)
      .eq('account_type', 'linkedin')
      .single();

    if (accountError || !linkedinAccount) {
      console.error('❌ LinkedIn account not found');
      return NextResponse.json(
        { error: 'LinkedIn account not configured' },
        { status: 404 }
      );
    }

    // Check connection status via Unipile
    // Get the LinkedIn username from the prospect's LinkedIn URL
    const linkedinUsername = prospect.linkedin_url
      ?.split('/in/')[1]
      ?.split('?')[0]
      ?.replace('/', '');

    if (!linkedinUsername) {
      console.error('❌ Invalid LinkedIn URL:', prospect.linkedin_url);
      return NextResponse.json(
        { error: 'Invalid LinkedIn URL' },
        { status: 400 }
      );
    }

    // Query Unipile for connection status
    const unipileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${linkedinAccount.unipile_account_id}`;

    console.log(`📡 Checking Unipile connection status...`);

    const unipileResponse = await fetch(unipileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY || '',
        'Accept': 'application/json'
      }
    });

    if (!unipileResponse.ok) {
      const errorText = await unipileResponse.text();
      console.error(`❌ Unipile API error (${unipileResponse.status}):`, errorText);

      return NextResponse.json({
        accepted: false,
        error: `Unipile API error: ${unipileResponse.status}`,
        prospect_id: prospectId
      });
    }

    const unipileData = await unipileResponse.json();

    // Check if connection is accepted
    // Unipile returns connection_degree field: 1 = first-degree (connected)
    const isAccepted = unipileData.connection_degree === 1;
    const acceptedAt = isAccepted ? new Date().toISOString() : null;

    console.log(`${isAccepted ? '✅' : '⏳'} Connection ${isAccepted ? 'accepted' : 'not yet accepted'}`);

    // Update prospect status if accepted
    if (isAccepted) {
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'connected',
          personalization_data: {
            ...prospect.personalization_data,
            connection_accepted_at: acceptedAt,
            connection_degree: 1
          }
        })
        .eq('id', prospectId);

      console.log('✅ Updated prospect status to connected');
    }

    return NextResponse.json({
      accepted: isAccepted,
      acceptedAt,
      connectionDegree: unipileData.connection_degree,
      prospect_id: prospectId,
      prospect_name: `${prospect.first_name} ${prospect.last_name}`,
      checked_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error checking connection status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check connection status',
        message: error.message
      },
      { status: 500 }
    );
  }
}
