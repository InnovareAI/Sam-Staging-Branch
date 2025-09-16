import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/unipile/connect-email
 * Connect email accounts (Gmail, Outlook) via Unipile
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, platform } = body;

    // Validate input
    if (!provider || !platform) {
      return NextResponse.json(
        { success: false, error: 'Provider and platform are required' },
        { status: 400 }
      );
    }

    if (!['google', 'microsoft'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider. Must be google or microsoft' },
        { status: 400 }
      );
    }

    if (!['gmail', 'outlook'].includes(platform)) {
      return NextResponse.json(
        { success: false, error: 'Invalid platform. Must be gmail or outlook' },
        { status: 400 }
      );
    }

    // Get Unipile credentials
    const unipileApiKey = process.env.UNIPILE_API_KEY;
    const unipileBaseUrl = process.env.UNIPILE_BASE_URL || 'https://api.unipile.com';

    if (!unipileApiKey) {
      console.error('❌ UNIPILE_API_KEY not configured');
      return NextResponse.json(
        { success: false, error: 'Unipile API key not configured' },
        { status: 500 }
      );
    }

    // Map provider to Unipile platform
    const unipilePlatform = provider === 'google' ? 'GMAIL' : 'OUTLOOK';
    
    // Create Unipile OAuth URL
    const unipileResponse = await fetch(`${unipileBaseUrl}/v1/accounts/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': unipileApiKey,
      },
      body: JSON.stringify({
        type: unipilePlatform,
        redirect_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/unipile/callback`,
        name: `${platform}-${Date.now()}`, // Unique account name
      }),
    });

    if (!unipileResponse.ok) {
      const errorText = await unipileResponse.text();
      console.error('❌ Unipile API error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to create Unipile OAuth URL' },
        { status: 500 }
      );
    }

    const unipileData = await unipileResponse.json();

    if (!unipileData.auth_url) {
      console.error('❌ No auth_url in Unipile response:', unipileData);
      return NextResponse.json(
        { success: false, error: 'Invalid Unipile response' },
        { status: 500 }
      );
    }

    console.log(`✅ Generated Unipile ${platform} OAuth URL`);

    return NextResponse.json({
      success: true,
      authUrl: unipileData.auth_url,
      accountId: unipileData.account_id,
      provider,
      platform,
    });

  } catch (error) {
    console.error('❌ Unipile email connection error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/unipile/connect-email
 * Get connected email accounts status
 */
export async function GET() {
  try {
    // TODO: Implement getting connected accounts from database
    // For now, return empty array
    return NextResponse.json({
      success: true,
      accounts: [],
    });
  } catch (error) {
    console.error('❌ Error fetching email accounts:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}