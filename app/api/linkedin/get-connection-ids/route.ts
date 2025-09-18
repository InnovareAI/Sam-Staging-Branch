import { NextRequest, NextResponse } from 'next/server';

// Unipile API configuration
const UNIPILE_BASE_URL = process.env.UNIPILE_DSN || 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

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

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Getting LinkedIn connection IDs for testing...');

    const searchParams = req.nextUrl.searchParams;
    const accountId = searchParams.get('account_id') || 'Hut6zgezT_SWmwL-XIkjSg'; // Default to Thorsten's account
    const batchSize = parseInt(searchParams.get('batch_size') || '50');

    // Get recent messages to find connection IDs
    const messagesData = await callUnipileAPI(`messaging/accounts/${accountId}/messages`, 'GET');
    
    // Extract unique sender IDs from recent messages
    const connectionIds = new Set<string>();
    const connectionProfiles: any[] = [];

    if (messagesData.items) {
      for (const message of messagesData.items.slice(0, batchSize)) {
        if (message.sender_id && message.sender_id !== accountId && message.sender_id.startsWith('ACoA')) {
          connectionIds.add(message.sender_id);
          
          // Add to profiles if we have additional info
          connectionProfiles.push({
            linkedin_id: message.sender_id,
            name: message.sender_name || 'Unknown',
            last_message_at: message.created_at,
            last_message_preview: message.text ? message.text.substring(0, 100) + '...' : ''
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      account_id: accountId,
      total_connections_found: connectionIds.size,
      connection_ids: Array.from(connectionIds).slice(0, 20), // Limit to first 20 for testing
      connection_profiles: connectionProfiles.slice(0, 20),
      usage_example: {
        test_message_endpoint: '/api/linkedin/test-message',
        example_request: {
          from_account: accountId,
          to_linkedin_id: Array.from(connectionIds)[0] || 'ACoAAA...',
          message: 'Test message from SAM AI system!'
        }
      },
      notes: [
        'These are LinkedIn internal IDs from your recent conversations',
        'All IDs start with ACoA which is the correct format for messaging',
        'Use any of these IDs in the test-message endpoint for real testing'
      ]
    });

  } catch (error: any) {
    console.error('Failed to get connection IDs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get connection IDs', 
        details: error.message,
        help: 'Make sure the account_id parameter matches a valid Unipile account'
      },
      { status: 500 }
    );
  }
}