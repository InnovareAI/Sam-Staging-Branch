import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

// Helper function to make Unipile API calls
async function callUnipileAPI(endpoint: string, method: string = 'GET', body?: any) {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured');
  }

  const url = `https://${unipileDsn}/api/v1/${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json',
      ...(body && { 'Content-Type': 'application/json' })
    },
    ...(body && { body: JSON.stringify(body) })
  };

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user using Firebase/Cloud SQL
    const { userId, userEmail } = await verifyAuth(request);

    const { account_id } = await request.json();

    if (!account_id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    console.log(`👤 User ${userEmail} requesting messages for account: ${account_id}`);

    console.log('🔍 Fetching recent messages from Unipile for account:', account_id);

    if (!process.env.UNIPILE_DSN || !process.env.UNIPILE_API_KEY) {
      console.error('❌ Unipile credentials not configured');
      return NextResponse.json(
        { error: 'Unipile integration not configured' },
        { status: 500 }
      );
    }

    try {
      // First, verify the account belongs to the authenticated user
      console.log('🔒 Verifying account ownership for user:', userEmail);
      const accountsData = await callUnipileAPI('accounts');
      const allAccounts = Array.isArray(accountsData) ? accountsData : (accountsData.items || accountsData.accounts || []);

      // Filter to user's accounts using same privacy logic as accounts API
      const userOwnedAccounts = allAccounts.filter((account: any) => {
        const connectionParams = account.connection_params?.im || {};
        const accountEmail = connectionParams.email || connectionParams.username;
        const publicIdentifier = connectionParams.publicIdentifier;

        return accountEmail === userEmail ||
               (publicIdentifier && userEmail.includes(publicIdentifier)) ||
               account.name?.toLowerCase().includes(userEmail.split('@')[0].toLowerCase());
      });

      // Check if the requested account belongs to the user
      const requestedAccount = userOwnedAccounts.find((account: any) => account.id === account_id);
      if (!requestedAccount) {
        console.log(`❌ Account ${account_id} does not belong to user ${userEmail}`);
        return NextResponse.json({
          success: false,
          error: 'Access denied: Account does not belong to authenticated user'
        }, { status: 403 });
      }

      console.log(`✅ Account ownership verified for user ${userEmail}`);

      // Call Unipile API to get messages for the specific account
      console.log('🌐 Making direct call to Unipile messages API...');
      const messagesData = await callUnipileAPI(`messages`, 'GET');

      console.log('📨 Raw messages response:', {
        total: messagesData.length || 0,
        first_few: messagesData.slice ? messagesData.slice(0, 2) : 'Not an array'
      });

      // Filter messages for the specific account and format them
      const messages = Array.isArray(messagesData) ? messagesData : (messagesData.items || messagesData.messages || []);

      const recentMessages = messages
        .filter((msg: any) => {
          // Filter by account ID or source ID
          return msg.account_id === account_id ||
                 msg.source_id?.includes(account_id) ||
                 msg.account === account_id;
        })
        .slice(0, 10) // Get latest 10 messages
        .map((msg: any) => ({
          id: msg.id || `msg_${Date.now()}_${Math.random()}`,
          from: {
            name: msg.from?.name || msg.sender?.name || msg.author?.name || 'Unknown Sender',
            email: msg.from?.email || msg.sender?.email || msg.author?.email || 'no-email'
          },
          subject: msg.subject || msg.title || 'No Subject',
          text: msg.text || msg.body || msg.content || msg.message || 'No content available',
          date: msg.created_at || msg.timestamp || msg.date || 'Recently',
          platform: 'linkedin',
          chat_id: msg.chat_id || msg.thread_id || msg.conversation_id || `chat_${msg.id}`
        }));

      console.log('✅ Formatted recent messages:', {
        total_filtered: recentMessages.length,
        account_id: account_id
      });

      // If no real messages, provide mock data for demonstration
      if (recentMessages.length === 0) {
        console.log('📝 No real messages found, providing mock data for demo');
        const mockMessages = [
          {
            id: 'demo_msg_1',
            from: { name: 'John Smith', email: 'john@company.com' },
            subject: 'Re: Product Demo Request',
            text: 'Thanks for the demo yesterday. We\'d like to discuss pricing for our team of 50 users.',
            date: '2 hours ago',
            platform: 'linkedin',
            chat_id: 'demo_chat_1'
          },
          {
            id: 'demo_msg_2',
            from: { name: 'Sarah Johnson', email: 'sarah@startup.co' },
            subject: 'Integration question',
            text: 'Hi! Can your platform integrate with our existing CRM? We use Salesforce.',
            date: '4 hours ago',
            platform: 'linkedin',
            chat_id: 'demo_chat_2'
          },
          {
            id: 'demo_msg_3',
            from: { name: 'Mike Chen', email: 'mike@techcorp.com' },
            subject: 'Follow up on proposal',
            text: 'When can we schedule a call to discuss the implementation timeline?',
            date: '1 day ago',
            platform: 'linkedin',
            chat_id: 'demo_chat_3'
          }
        ];

        return NextResponse.json({
          success: true,
          messages: mockMessages,
          total: mockMessages.length,
          is_demo_data: true,
          note: 'Demo data shown - no recent messages found for this account',
          timestamp: new Date().toISOString()
        });
      }

      return NextResponse.json({
        success: true,
        messages: recentMessages,
        total: recentMessages.length,
        is_demo_data: false,
        timestamp: new Date().toISOString()
      });

    } catch (unipileError) {
      console.error('🚨 Unipile API call failed:', unipileError);

      // Fall back to mock data if API fails
      const mockMessages = [
        {
          id: 'fallback_1',
          from: { name: 'API Connection Issue', email: 'system@example.com' },
          subject: 'Connection Test',
          text: 'Unable to fetch real messages from Unipile. This is test data.',
          date: 'Just now',
          platform: 'linkedin',
          chat_id: 'fallback_chat'
        }
      ];

      return NextResponse.json({
        success: true,
        messages: mockMessages,
        total: mockMessages.length,
        is_demo_data: true,
        error_note: 'Unipile API connection failed, showing fallback data',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    // Handle auth errors
    if (error?.code === 'UNAUTHORIZED' || error?.code === 'FORBIDDEN' || error?.code === 'WORKSPACE_ACCESS_DENIED') {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: error.statusCode || 401 });
    }

    console.error('❌ Error in recent messages endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch recent messages',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
