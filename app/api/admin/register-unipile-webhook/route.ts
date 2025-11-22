import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin Endpoint - Register Unipile Webhook
 *
 * Registers the webhook with Unipile for connection acceptance events
 * This should be called ONCE during setup
 *
 * POST /api/admin/register-unipile-webhook
 * Body: { account_id: string, webhook_url: string }
 */

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

async function unipileRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.title || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function POST(req: NextRequest) {
  try {
    // Security check - only admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { account_id, webhook_url } = await req.json();

    if (!account_id || !webhook_url) {
      return NextResponse.json(
        { error: 'Missing account_id or webhook_url' },
        { status: 400 }
      );
    }

    console.log(`🔧 Registering webhook for account ${account_id}`);
    console.log(`   URL: ${webhook_url}`);

    // Register webhook with Unipile
    const webhook = await unipileRequest('/api/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        account_id: account_id,
        url: webhook_url,
        source: 'users',
        event_type: 'new_relation',
        active: true
      })
    });

    console.log(`✅ Webhook registered:`, webhook);

    return NextResponse.json({
      success: true,
      webhook_id: webhook.id,
      message: 'Webhook registered successfully',
      details: webhook
    });

  } catch (error: any) {
    console.error('❌ Webhook registration error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to register webhook'
    }, { status: 500 });
  }
}

// GET endpoint for info
export async function GET() {
  return NextResponse.json({
    name: 'Register Unipile Webhook',
    description: 'Registers webhook for connection acceptance events',
    endpoint: '/api/admin/register-unipile-webhook',
    method: 'POST',
    auth: 'Bearer token required',
    payload: {
      account_id: 'Unipile account ID (e.g., ymtTx4xVQ6OVUFk83ctwtA)',
      webhook_url: 'Full URL to webhook handler (e.g., https://app.meet-sam.com/api/webhooks/unipile-connection-accepted)'
    },
    example_curl: `curl -X POST https://app.meet-sam.com/api/admin/register-unipile-webhook \\
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
    "webhook_url": "https://app.meet-sam.com/api/webhooks/unipile-connection-accepted"
  }'`
  });
}
