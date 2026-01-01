import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * Message Outbox Processor
 *
 * Processes queued messages from the message_outbox table and sends them
 * via appropriate channels (email via Postmark, LinkedIn via Unipile)
 *
 * This should be called by a cron job every 1 minute
 *
 * Netlify cron: Add to netlify.toml:
 * [[plugins]]
 *   package = "@netlify/plugin-scheduled-functions"
 *   [plugins.inputs]
 *     [plugins.inputs.functions]
 *       "process-outbox" = "* * * * *"
 */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();

    console.log('🔄 Starting message outbox processing...');

    // Fetch messages ready to send (queued and scheduled time has passed)
    const { data: messages, error: fetchError } = await supabase
      .from('message_outbox')
      .select('*')
      .eq('status', 'queued')
      .or(`scheduled_send_time.is.null,scheduled_send_time.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: true })
      .limit(10); // Process 10 at a time to avoid timeout

    if (fetchError) {
      console.error('❌ Failed to fetch messages:', fetchError);
      return NextResponse.json({
        success: false,
        error: fetchError.message
      }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      console.log('✅ No messages to process');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No messages in queue'
      });
    }

    console.log(`📧 Processing ${messages.length} messages...`);

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each message
    for (const message of messages) {
      try {
        // Update status to 'sending' to prevent duplicate processing
        await supabase
          .from('message_outbox')
          .update({
            status: 'sending',
            attempts: (message.attempts || 0) + 1,
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', message.id);

        // Send via appropriate channel
        if (message.channel === 'email') {
          await sendEmailMessage(message, supabase);
        } else if (message.channel === 'linkedin') {
          await sendLinkedInMessage(message, supabase);
        } else {
          throw new Error(`Unknown channel: ${message.channel}`);
        }

        // Mark as sent
        await supabase
          .from('message_outbox')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', message.id);

        results.sent++;
        console.log(`✅ Message ${message.id} sent via ${message.channel}`);

      } catch (error) {
        console.error(`❌ Failed to send message ${message.id}:`, error);
        results.failed++;
        results.errors.push(`Message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Update with error
        const maxAttempts = 3;
        const attempts = (message.attempts || 0) + 1;

        await supabase
          .from('message_outbox')
          .update({
            status: attempts >= maxAttempts ? 'failed' : 'queued',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            attempts
          })
          .eq('id', message.id);
      }
    }

    console.log(`✅ Processing complete: ${results.sent} sent, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      processed: messages.length,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors
    });

  } catch (error) {
    console.error('❌ Outbox processor error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Send email message via Postmark
 */
async function sendEmailMessage(message: any, supabase: any) {
  const Postmark = require('postmark');
  const postmark = new Postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN!);

  // Get prospect details
  const { data: prospect } = await supabase
    .from('workspace_prospects')
    .select('email, first_name, last_name')
    .eq('id', message.prospect_id)
    .single();

  if (!prospect?.email) {
    throw new Error('Prospect email not found');
  }

  // Get campaign details for Reply-To header
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, workspace_id')
    .eq('id', message.campaign_id)
    .single();

  await postmark.sendEmail({
    From: process.env.POSTMARK_FROM_EMAIL || 'sam@innovareai.com',
    To: prospect.email,
    Subject: message.subject || 'Following up',
    HtmlBody: message.message_content,
    TextBody: message.message_content.replace(/<[^>]*>/g, ''),
    ReplyTo: `campaign-reply-${message.campaign_id}-${message.prospect_id}@sam.innovareai.com`,
    Headers: [
      { Name: 'X-Campaign-ID', Value: message.campaign_id },
      { Name: 'X-Prospect-ID', Value: message.prospect_id },
      { Name: 'X-Message-Type', Value: 'campaign-reply' }
    ],
    MessageStream: 'outbound'
  });
}

/**
 * Send LinkedIn message via Unipile
 */
async function sendLinkedInMessage(message: any, supabase: any) {
  // Get prospect LinkedIn URL
  const { data: prospect } = await supabase
    .from('workspace_prospects')
    .select('linkedin_url')
    .eq('id', message.prospect_id)
    .single();

  if (!prospect?.linkedin_url) {
    throw new Error('Prospect LinkedIn URL not found');
  }

  // Get campaign's LinkedIn account
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('linkedin_account_id')
    .eq('id', message.campaign_id)
    .single();

  if (!campaign?.linkedin_account_id) {
    throw new Error('Campaign LinkedIn account not configured');
  }

  // Send via Unipile API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/messages`, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        account_id: campaign.linkedin_account_id,
        provider: 'LINKEDIN',
        text: message.message_content,
        attendees: [{
          messaging_id: prospect.linkedin_url
        }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Unipile error ${response.status}: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Unipile API timeout after 30s');
    }
    throw error;
  }
}

// Also export as POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
