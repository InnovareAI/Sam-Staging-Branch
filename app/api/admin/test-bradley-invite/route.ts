/**
 * TEST ENDPOINT: Send connection request to Bradley Breton
 * This endpoint uses production Unipile credentials to test why Bradley is being rejected
 */

import { NextRequest, NextResponse } from 'next/server';

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA'; // Michelle's LinkedIn account
const LINKEDIN_URL = 'http://www.linkedin.com/in/bradleybreton';

export async function POST(req: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    test: 'Bradley Breton Connection Request',
    environmentVars: {
      UNIPILE_DSN: UNIPILE_DSN || 'MISSING',
      UNIPILE_API_KEY: UNIPILE_API_KEY ? `${UNIPILE_API_KEY.substring(0, 10)}...` : 'MISSING'
    },
    steps: []
  };

  try {
    // Step 1: Verify Unipile authentication
    console.log('🔍 STEP 1: Verify Unipile authentication');
    results.steps.push({ step: 1, name: 'Verify Authentication' });

    const accountsUrl = `https://${UNIPILE_DSN}/api/v1/accounts`;
    console.log('Accounts URL:', accountsUrl);

    const accountsResponse = await fetch(accountsUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY || '',
        'Accept': 'application/json',
      }
    });

    const accountsText = await accountsResponse.text();
    console.log('Accounts response status:', accountsResponse.status);
    console.log('Accounts response:', accountsText.substring(0, 500));

    results.steps[0].status = accountsResponse.status;
    results.steps[0].response = accountsText.substring(0, 500);

    if (!accountsResponse.ok) {
      const errorData = JSON.parse(accountsText);
      return NextResponse.json({
        error: 'Authentication failed',
        details: errorData,
        results
      }, { status: 401 });
    }

    const accounts = JSON.parse(accountsText);
    console.log('✅ Authenticated successfully');
    results.steps[0].success = true;
    results.steps[0].accountCount = accounts.items?.length || 0;

    // Find the specific account
    const linkedinAccount = accounts.items?.find((acc: any) =>
      acc.id === ACCOUNT_ID || acc.id.startsWith(ACCOUNT_ID)
    );

    if (!linkedinAccount) {
      return NextResponse.json({
        error: 'Account not found',
        accountId: ACCOUNT_ID,
        availableAccounts: accounts.items?.map((a: any) => ({ id: a.id, type: a.provider })),
        results
      }, { status: 404 });
    }

    console.log('✅ Found LinkedIn account:', linkedinAccount.id);
    results.accountUsed = linkedinAccount.id;

    // Step 2: Get Bradley's profile
    console.log('\n🔍 STEP 2: Get Bradley Breton\'s LinkedIn profile');
    results.steps.push({ step: 2, name: 'Get LinkedIn Profile' });

    const linkedinIdentifier = LINKEDIN_URL.split('/in/')[1].replace(/\/$/, '');
    const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${linkedinIdentifier}?account_id=${linkedinAccount.id}&provider=LINKEDIN`;

    console.log('Profile URL:', profileUrl);
    console.log('LinkedIn identifier:', linkedinIdentifier);

    const profileResponse = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY || '',
        'Accept': 'application/json',
      }
    });

    const profileText = await profileResponse.text();
    console.log('Profile response status:', profileResponse.status);
    console.log('Profile response:', profileText);

    results.steps[1].status = profileResponse.status;
    results.steps[1].response = profileText;

    if (!profileResponse.ok) {
      const errorData = JSON.parse(profileText);
      return NextResponse.json({
        error: 'Failed to get profile',
        details: errorData,
        results
      }, { status: profileResponse.status });
    }

    const profile = JSON.parse(profileText);
    const providerId = profile.object?.id || profile.id;

    if (!providerId) {
      return NextResponse.json({
        error: 'No provider_id in profile',
        profile,
        results
      }, { status: 500 });
    }

    console.log('✅ Got provider_id:', providerId);
    results.steps[1].success = true;
    results.steps[1].providerId = providerId;
    results.steps[1].profileName = profile.object?.display_name || profile.display_name;

    // Step 3: Send connection request
    console.log('\n🔍 STEP 3: Send connection request');
    results.steps.push({ step: 3, name: 'Send Connection Request' });

    const invitePayload = {
      account_id: linkedinAccount.id,
      provider_id: providerId,
      message: 'Hi Bradley, I\'d like to connect!'
    };

    console.log('Invite payload:', JSON.stringify(invitePayload, null, 2));

    const inviteUrl = `https://${UNIPILE_DSN}/api/v1/users/invite`;
    const inviteResponse = await fetch(inviteUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(invitePayload)
    });

    const inviteText = await inviteResponse.text();
    console.log('Invite response status:', inviteResponse.status);
    console.log('Invite response:', inviteText);

    results.steps[2].status = inviteResponse.status;
    results.steps[2].responseHeaders = Object.fromEntries(inviteResponse.headers.entries());
    results.steps[2].responseBody = inviteText;

    let inviteData;
    try {
      inviteData = JSON.parse(inviteText);
      results.steps[2].parsedResponse = inviteData;
    } catch (e) {
      results.steps[2].parseError = 'Failed to parse response as JSON';
    }

    if (!inviteResponse.ok) {
      console.error('❌ Connection request failed');
      console.error('Error response:', JSON.stringify(inviteData, null, 2));

      return NextResponse.json({
        error: 'Connection request failed',
        httpStatus: inviteResponse.status,
        errorType: inviteData?.type,
        errorTitle: inviteData?.title,
        errorMessage: inviteData?.message,
        errorDetail: inviteData?.detail,
        completeErrorResponse: inviteData,
        results
      }, { status: inviteResponse.status });
    }

    console.log('✅ Connection request sent successfully!');
    results.steps[2].success = true;
    results.success = true;

    return NextResponse.json({
      success: true,
      message: 'Connection request sent to Bradley Breton',
      invitationId: inviteData?.invitation_id || inviteData?.object?.invitation_id,
      results
    });

  } catch (error: any) {
    console.error('❌ Exception:', error);
    return NextResponse.json({
      error: 'Exception occurred',
      message: error.message,
      stack: error.stack,
      results
    }, { status: 500 });
  }
}

// Allow GET for easy browser testing
export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to test Bradley Breton connection request',
    endpoint: '/api/admin/test-bradley-invite',
    method: 'POST'
  });
}
