import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with service role key (bypasses RLS for testing)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // For testing, use the known test user email
    const testUserEmail = 'tl@innovareai.com';

    console.log(`🧪 TEST ENDPOINT - Testing with user: ${testUserEmail}`);

    // Get the test user
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find((u: any) => u.email === testUserEmail);

    if (!user) {
      return NextResponse.json({ error: 'Test user not found' }, { status: 404 });
    }

    // Get user's profile to find workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;

    console.log(`🧪 Workspace ID: ${workspaceId}`);

    // Get user's LinkedIn account
    const { data: linkedInAccount } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')
      .in('connection_status', VALID_CONNECTION_STATUSES)
      .single();

    if (!linkedInAccount) {
      return NextResponse.json({ error: 'No LinkedIn account found' }, { status: 404 });
    }

    console.log(`🧪 Found LinkedIn account: ${linkedInAccount.account_name}`);
    console.log(`🧪 Base Account ID: ${linkedInAccount.unipile_account_id}`);
    console.log(`🧪 Sources:`, linkedInAccount.unipile_sources);

    // Test profile lookup with michaelhaeri
    const linkedinIdentifier = 'michaelhaeri';
    const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinIdentifier}?account_id=${linkedInAccount.unipile_account_id}`;

    console.log(`🧪 Testing profile lookup`);
    console.log(`🧪 URL: ${profileUrl}`);

    const profileResponse = await fetch(
      profileUrl,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY || '',
          'Accept': 'application/json'
        }
      }
    );

    console.log(`🧪 Response status: ${profileResponse.status} ${profileResponse.statusText}`);

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error(`🧪 ERROR Response:`, errorText);

      return NextResponse.json({
        success: false,
        error: 'Profile lookup failed',
        status: profileResponse.status,
        statusText: profileResponse.statusText,
        errorResponse: errorText,
        accountUsed: {
          name: linkedInAccount.account_name,
          baseAccountId: linkedInAccount.unipile_account_id,
          sources: linkedInAccount.unipile_sources
        },
        urlCalled: profileUrl
      }, { status: 200 }); // Return 200 so we can see the error details
    }

    const profileData = await profileResponse.json();
    console.log(`🧪 SUCCESS! Got profile data`);

    return NextResponse.json({
      success: true,
      message: 'Profile lookup successful!',
      profile: {
        name: `${profileData.first_name} ${profileData.last_name}`,
        headline: profileData.headline,
        providerId: profileData.provider_id
      },
      accountUsed: {
        name: linkedInAccount.account_name,
        baseAccountId: linkedInAccount.unipile_account_id,
        sources: linkedInAccount.unipile_sources
      },
      urlCalled: profileUrl
    });

  } catch (error) {
    console.error('🧪 TEST ENDPOINT ERROR:', error);
    return NextResponse.json({
      error: 'Internal error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
