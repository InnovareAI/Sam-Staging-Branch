import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { pool } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Helper function to make Unipile API calls
async function callUnipileAPI(endpoint: string, method: string = 'GET') {
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
    }
  };

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Helper function to get messages using MCP structure (works correctly)
async function getRecentMessagesViaMCP(accountId: string) {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured');
  }

  const url = `https://${unipileDsn}/api/v1/accounts/${accountId}/hosted/chats/messages`;
  const options: RequestInit = {
    method: 'POST',
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      batch_size: 20
    })
  };

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile MCP API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching recent messages from Unipile for Contact Center...');

    if (!process.env.UNIPILE_DSN || !process.env.UNIPILE_API_KEY) {
      console.error('❌ Unipile credentials not configured');
      return NextResponse.json({
        success: false,
        error: 'Unipile integration not configured. Please check environment variables.',
        messages: [],
        total: 0,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // Authenticate user via Firebase session
    const { user, error: authError } = await verifyAuth(request);
    if (!user || authError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's current workspace
    const userResult = await pool.query(
      `SELECT current_workspace_id FROM users WHERE id = $1`,
      [user.uid]
    );

    const workspaceId = userResult.rows[0]?.current_workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
    }

    // Get connected LinkedIn accounts for THIS workspace ONLY
    const accountsResult = await pool.query(
      `SELECT unipile_account_id, account_name FROM workspace_accounts 
       WHERE workspace_id = $1 AND account_type = 'linkedin' 
       AND connection_status IN ('CONNECTED', 'OK')`,
      [workspaceId]
    );

    const workspaceAccounts = accountsResult.rows;

    if (!workspaceAccounts || workspaceAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        messages: [],
        total: 0,
        message: 'No connected LinkedIn accounts in this workspace',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔒 Found ${workspaceAccounts.length} workspace accounts for message fetching`);

    // Fetch messages for each account
    const allMessages: any[] = [];

    for (const dbAccount of workspaceAccounts) {
      try {
        console.log(`📥 Fetching messages for account: ${dbAccount.account_name}`);

        // Use real MCP-style call to fetch messages
        const messageData = await getRecentMessagesViaMCP(dbAccount.unipile_account_id);
        const messageArray = Array.isArray(messageData) ? messageData : (messageData.items || []);

        console.log(`📊 Found ${messageArray.length} messages for ${dbAccount.account_name}`);

        // Transform messages
        const transformedMessages = messageArray.map((msg: any) => ({
          id: msg.id || `msg_${Date.now()}_${Math.random()}`,
          type: determineMessageType(msg),
          subject: msg.subject || extractSubjectFromText(msg.text) || 'Message from LinkedIn',
          from: extractSenderName(msg) || 'Unknown Sender',
          company: msg.chat_info?.name || extractCompanyFromMessage(msg) || 'Unknown Company',
          time: formatMessageTime(msg.timestamp),
          details: msg.text || 'No content available',
          platform: 'linkedin',
          accountName: dbAccount.account_name,
          rawMessage: msg
        }));

        allMessages.push(...transformedMessages);
      } catch (accountError) {
        console.error(`❌ Error fetching messages for account ${dbAccount.account_name}:`, accountError);
      }
    }

    // Sort messages by time (most recent first)
    allMessages.sort((a, b) => new Date(b.rawMessage.timestamp || 0).getTime() - new Date(a.rawMessage.timestamp || 0).getTime());

    console.log(`✅ Successfully fetched ${allMessages.length} total messages`);

    return NextResponse.json({
      success: true,
      messages: allMessages,
      total: allMessages.length,
      accounts_checked: workspaceAccounts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching Contact Center messages from Unipile:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch messages: ${errorMessage}`,
        messages: [],
        total: 0,
        debug_info: {
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          unipile_configured: !!(process.env.UNIPILE_DSN && process.env.UNIPILE_API_KEY)
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Helper functions
function determineMessageType(message: any): 'linkedin' | 'inmail' {
  const text = (message.text || message.body || '').toLowerCase();
  const chatName = message.chat_info?.name || '';

  if (text.includes('connect') ||
    text.includes('your profile') ||
    text.includes('would like to connect') ||
    text.includes('invitation') ||
    chatName.includes('Invitation') ||
    message.message_type === 'INMAIL') {
    return 'inmail';
  }

  return 'linkedin';
}

function extractSenderName(message: any): string {
  if (message.sender_name) return message.sender_name;
  if (message.from?.name) return message.from.name;
  if (message.sender?.name) return message.sender.name;

  const chatName = message.chat_info?.name;
  if (chatName && !chatName.includes('null')) return chatName;

  const text = message.text || '';
  const firstLine = text.split('\n')[0];
  const nameMatch = firstLine.match(/^Hi\s+([A-Z][a-z]+)/);
  if (nameMatch) return nameMatch[1];

  return '';
}

function extractSubjectFromText(text: string): string {
  if (!text) return '';
  const subject = text.substring(0, 50).trim();
  return subject.length < text.length ? `${subject}...` : subject;
}

function extractCompanyFromMessage(message: any): string {
  if (message.from?.company) return message.from.company;
  if (message.sender?.company) return message.sender.company;

  const text = message.text || message.body || '';
  const companyMatch = text.match(/(?:from|at|with)\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\.|,|$)/);
  if (companyMatch) return companyMatch[1].trim();

  return '';
}

function formatMessageTime(timestamp: string): string {
  if (!timestamp) return 'Unknown time';

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  } catch (error) {
    return 'Unknown time';
  }
}