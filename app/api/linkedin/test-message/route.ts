import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

// Unipile API configuration
const UNIPILE_BASE_URL = process.env.UNIPILE_DSN || 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

interface SendMessageRequest {
  account_id: string;         // Unipile account ID (from our accounts)
  recipient_id: string;       // LinkedIn user ID of recipient
  message: string;            // Message content
}

// Helper function to make Unipile API calls
async function callUnipileAPI(endpoint: string, method: string = 'GET', body?: any) {
  if (!UNIPILE_BASE_URL || !UNIPILE_API_KEY) {
    throw new Error('Unipile API credentials not configured');
  }

  const url = `https://${UNIPILE_BASE_URL}/api/v1/${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`Making Unipile API call: ${method} ${url}`);
  if (body) {
    console.log('Request body:', JSON.stringify(body, null, 2));
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Unipile API error: ${response.status} - ${errorText}`);
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Unipile API response:', JSON.stringify(data, null, 2));
  return data;
}

// Helper function to extract LinkedIn user ID from profile URL
function extractLinkedInUserId(profileUrl: string): string | null {
  if (!profileUrl) return null;

  // Extract from various LinkedIn URL formats
  const patterns = [
    /linkedin\.com\/in\/([^\/\?]+)/,
    /linkedin\.com\/pub\/[^\/]+\/[^\/]+\/[^\/]+\/([^\/\?]+)/,
    /linkedin\.com\/profile\/view\?id=([^&]+)/
  ];

  for (const pattern of patterns) {
    const match = profileUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user using Firebase auth
    const { userId, userEmail } = await verifyAuth(req);
    console.log(`Testing LinkedIn message sending for user ${userEmail}...`);

    const { from_account, to_linkedin_profile, to_linkedin_id, message = "Test message from SAM AI system - checking messaging functionality!" } = await req.json();

    if (!from_account || (!to_linkedin_profile && !to_linkedin_id)) {
      return NextResponse.json({
        error: 'from_account and either to_linkedin_profile (URL) or to_linkedin_id are required',
        available_accounts: [
          'Hut6zgezT_SWmwL-XIkjSg', // Thorsten Linz
          '3Zj8ks8aSrKg0ySaLQo_8A', // Irish Cita De Ade
          'MlV8PYD1SXG783XbJRraLQ', // Martin Schechtner
          'eCvuVstGTfCedKsrzAKvZA', // Peter Noble
          'he3RXnROSLuhONxgNle7dw'  // Charissa Daniel
        ],
        example: {
          "from_account": "Hut6zgezT_SWmwL-XIkjSg",
          "to_linkedin_profile": "https://www.linkedin.com/in/chonam-lamberte-54b87437b/",
          "message": "Your test message here"
        }
      }, { status: 400 });
    }

    // Extract LinkedIn user ID from profile URL if provided
    let recipientLinkedInId = to_linkedin_id;
    if (to_linkedin_profile && !recipientLinkedInId) {
      recipientLinkedInId = extractLinkedInUserId(to_linkedin_profile);
      if (!recipientLinkedInId) {
        return NextResponse.json({
          error: 'Could not extract LinkedIn user ID from profile URL',
          profile_url: to_linkedin_profile,
          help: 'Please provide a valid LinkedIn profile URL or the LinkedIn user ID directly'
        }, { status: 400 });
      }
    }

    console.log(`Testing message from ${from_account} to LinkedIn ID: ${recipientLinkedInId}`);
    console.log(`Note: LinkedIn requires internal ID format (ACoAAA...), not public identifier`);

    // Validate LinkedIn ID format
    if (recipientLinkedInId && !recipientLinkedInId.startsWith('ACoA')) {
      return NextResponse.json({
        error: 'Invalid LinkedIn ID format',
        provided_id: recipientLinkedInId,
        help: 'LinkedIn internal IDs start with "ACoA" (e.g., ACoAAACYv0MB5sgfg5P09EbKyGzp2OH-qwKEmgc)',
        suggestion: 'Use an existing connection ID from your Unipile account or get the ID from message history'
      }, { status: 400 });
    }

    // Get account information for sender
    const fromAccountData = await callUnipileAPI('accounts');
    const accounts = Array.isArray(fromAccountData) ? fromAccountData : (fromAccountData.items || [fromAccountData]);

    const fromAccount = accounts.find(acc => acc.id === from_account);

    if (!fromAccount) {
      return NextResponse.json({
        error: 'Sender account not found',
        available_accounts: accounts.map(acc => ({ id: acc.id, name: acc.name }))
      }, { status: 404 });
    }

    console.log(`From: ${fromAccount.name} (${fromAccount.id})`);
    console.log(`To LinkedIn ID: ${recipientLinkedInId}`);

    // Try to send a direct message using Unipile's messaging API
    try {
      // Method 1: Try sending via messages endpoint
      const messageData = {
        account_id: from_account,
        recipient_id: recipientLinkedInId,
        text: message
      };

      const messageResponse = await callUnipileAPI('messages', 'POST', messageData);

      return NextResponse.json({
        success: true,
        message: 'Test message sent successfully!',
        from_account: fromAccount.name,
        to_linkedin_profile: to_linkedin_profile || recipientLinkedInId,
        message_content: message,
        response: messageResponse,
        timestamp: new Date().toISOString()
      });

    } catch (messageError) {
      console.log('Direct message failed, trying invitation method...', messageError);

      // Method 2: Try sending via invitation with message
      try {
        const invitationData = {
          provider_id: recipientLinkedInId,
          account_id: fromAccount.sources?.[0]?.id,
          user_email: "test@example.com", // Required by LinkedIn API
          message: `Test connection: ${message}`
        };

        const invitationResponse = await callUnipileAPI('users/invite', 'POST', invitationData);

        return NextResponse.json({
          success: true,
          method: 'invitation_with_message',
          message: 'Test invitation sent successfully!',
          from_account: fromAccount.name,
          to_linkedin_profile: to_linkedin_profile || recipientLinkedInId,
          message_content: message,
          response: invitationResponse,
          timestamp: new Date().toISOString()
        });

      } catch (invitationError) {
        console.error('Both message methods failed:', { messageError, invitationError });

        return NextResponse.json({
          success: false,
          error: 'Unable to send test message',
          details: {
            direct_message_error: messageError.message,
            invitation_error: invitationError.message,
            from_account: fromAccount.name,
            to_linkedin_profile: to_linkedin_profile || recipientLinkedInId,
            available_methods: ['messages', 'users/invite']
          }
        }, { status: 500 });
      }
    }

  } catch (error: any) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Test message error:', error);
    return NextResponse.json(
      { error: 'Failed to send test message', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate user using Firebase auth
    const { userId, userEmail } = await verifyAuth(req);
    console.log(`Getting LinkedIn accounts for messaging test for user ${userEmail}...`);

    // Get available accounts for testing
    const accountsData = await callUnipileAPI('accounts');
    const accounts = Array.isArray(accountsData) ? accountsData : (accountsData.items || [accountsData]);

    const linkedinAccounts = accounts.filter(account =>
      account.type === 'LINKEDIN' &&
      account.sources?.[0]?.status === 'OK'
    );

    return NextResponse.json({
      message: 'LinkedIn test message API ready',
      available_accounts: linkedinAccounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        premium_features: acc.connection_params?.im?.premiumFeatures || [],
        linkedin_id: acc.connection_params?.im?.id
      })),
      test_instructions: {
        method: 'POST',
        endpoint: '/api/linkedin/test-message',
        body: {
          from_account: 'account_id_here',
          to_linkedin_id: 'ACoAAA... (internal LinkedIn ID)',
          message: 'Your test message here'
        },
        note: 'To get valid LinkedIn IDs, use existing connections from your message history or recently connected contacts.'
      },
      how_to_get_linkedin_ids: {
        option_1: 'Use GET /api/linkedin/discover-contacts to scan message history for existing connection IDs',
        option_2: 'Check recent webhook data from connection acceptances',
        option_3: 'Use campaign prospect data where LinkedIn IDs were already captured'
      }
    });

  } catch (error: any) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Failed to get test message info:', error);
    return NextResponse.json(
      { error: 'Failed to get test info', details: error.message },
      { status: 500 }
    );
  }
}
