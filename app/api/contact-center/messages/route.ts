import { NextRequest, NextResponse } from 'next/server';

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

    // Get accounts first (reusing the same privacy filter)
    console.log('🌐 Getting user accounts...');
    const accountsData = await callUnipileAPI('accounts');
    const accounts = Array.isArray(accountsData) ? accountsData : (accountsData.items || accountsData.accounts || []);
    
    // Apply same privacy filter as accounts endpoint
    const userAccounts = accounts.filter((account: any) => {
      if (account.type !== 'LINKEDIN') return false;
      
      const accountName = account.name?.toLowerCase() || '';
      const accountEmail = account.connection_params?.im?.publicIdentifier?.toLowerCase() || '';
      
      return accountName.includes('thorsten') || accountEmail.includes('tvonlinz');
    });

    console.log(`🔒 Found ${userAccounts.length} user accounts for message fetching`);

    if (userAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        messages: [],
        total: 0,
        message: 'No user accounts found for message fetching',
        timestamp: new Date().toISOString()
      });
    }

    // Fetch messages for each user account
    const allMessages: any[] = [];
    
    for (const account of userAccounts) {
      try {
        console.log(`📥 Fetching messages for account: ${account.name}`);
        
        // Get messages for this account using the first source ID
        const sourceId = account.sources?.[0]?.id;
        if (!sourceId) {
          console.log(`⚠️ No source ID found for account ${account.name}`);
          continue;
        }

        const messages = await callUnipileAPI(`accounts/${account.id}/messages?limit=20`);
        const messageArray = Array.isArray(messages) ? messages : (messages.items || messages.messages || []);
        
        console.log(`📊 Found ${messageArray.length} messages for ${account.name}`);
        
        // Transform messages to match our format
        const transformedMessages = messageArray.map((msg: any) => ({
          id: msg.id || `msg_${Date.now()}_${Math.random()}`,
          type: determineMessageType(msg),
          subject: msg.subject || extractSubjectFromText(msg.text) || 'Message from LinkedIn',
          from: msg.from?.name || msg.from?.email || msg.participants?.find((p: any) => p.id !== account.id)?.name || 'Unknown Sender',
          company: msg.from?.company || extractCompanyFromMessage(msg) || 'Unknown Company',
          time: formatMessageTime(msg.created_at || msg.timestamp),
          details: msg.text || msg.body || 'No content available',
          platform: 'linkedin',
          accountName: account.name,
          rawMessage: msg // Keep original for debugging
        }));

        allMessages.push(...transformedMessages);
      } catch (accountError) {
        console.error(`❌ Error fetching messages for account ${account.name}:`, accountError);
        // Continue with other accounts
      }
    }

    // Sort messages by time (most recent first)
    allMessages.sort((a, b) => new Date(b.rawMessage.created_at || 0).getTime() - new Date(a.rawMessage.created_at || 0).getTime());

    console.log(`✅ Successfully fetched ${allMessages.length} total messages`);

    return NextResponse.json({
      success: true,
      messages: allMessages,
      total: allMessages.length,
      accounts_checked: userAccounts.length,
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
function determineMessageType(message: any): 'demo' | 'pricing' | 'support' | 'general' {
  const text = (message.text || message.body || '').toLowerCase();
  
  if (text.includes('demo') || text.includes('demonstration') || text.includes('meeting') || text.includes('call')) {
    return 'demo';
  }
  if (text.includes('pricing') || text.includes('price') || text.includes('cost') || text.includes('quote')) {
    return 'pricing';
  }
  if (text.includes('help') || text.includes('support') || text.includes('issue') || text.includes('problem')) {
    return 'support';
  }
  return 'general';
}

function extractSubjectFromText(text: string): string {
  if (!text) return '';
  
  // Take first 50 characters and add ellipsis if longer
  const subject = text.substring(0, 50).trim();
  return subject.length < text.length ? `${subject}...` : subject;
}

function extractCompanyFromMessage(message: any): string {
  // Try to extract company from various fields
  if (message.from?.company) return message.from.company;
  if (message.sender?.company) return message.sender.company;
  
  // Look for company patterns in text
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