import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';
import { personalizeMessage as personalizeMessageUniversal } from '@/lib/personalization';

// Unipile API configuration
const UNIPILE_BASE_URL = process.env.UNIPILE_DSN ? `https://${process.env.UNIPILE_DSN}` : 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

// Use service role client to bypass RLS for campaign execution
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface UnipileResponse<T> {
  object: string;
  data?: T;
  error?: {
    type: string;
    message: string;
  };
}

interface SendEmailRequest {
  account_id: string;         // Unipile account ID
  to: string;                 // Recipient email
  subject: string;            // Email subject
  body: string;               // Email body (HTML or plain text)
  from_name?: string;         // Sender name
  reply_to?: string;          // Reply-to email
  cc?: string[];              // CC recipients
  bcc?: string[];             // BCC recipients
}

interface SendEmailResponse {
  object: "EmailSent";
  message_id: string;
  status: string;
  usage?: number;
}

interface Prospect {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  job_title: string;
  email_address: string;
  linkedin_profile_url?: string;
  location?: string;
  industry?: string;
}

interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  email_account_id?: string;
  message_templates: {
    email_subject: string;
    email_body: string;
    follow_up_emails?: Array<{
      subject: string;
      body: string;
      delay_days: number;
    }>;
  };
  prospects: Prospect[];
  daily_limit: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
}

export async function POST(req: NextRequest) {
  try {
    // Use service role client to bypass RLS
    // Get request data
    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    console.log(`📧 [EMAIL EXECUTE] Processing campaign: ${campaignId}`);

    // Get campaign details with workspace_id
    // Note: campaign_prospects has prospect data directly (not via FK to workspace_prospects)
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_prospects (
          id,
          status,
          first_name,
          last_name,
          email,
          company_name,
          title,
          location,
          industry,
          linkedin_url
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError);
      return NextResponse.json({ error: 'Campaign not found', details: campaignError?.message }, { status: 404 });
    }

    console.log(`📧 [EMAIL EXECUTE] Found campaign: ${campaign.name}, workspace: ${campaign.workspace_id}`);

    // Check if campaign is active or being activated (inactive is allowed during activation flow)
    if (campaign.status !== 'active' && campaign.status !== 'inactive') {
      return NextResponse.json({ error: `Campaign cannot be executed (status: ${campaign.status})` }, { status: 400 });
    }

    // Get email account from workspace_accounts table
    const { data: emailAccount, error: emailAccountError } = await supabase
      .from('workspace_accounts')
      .select('id, unipile_account_id, account_name, connection_status')
      .eq('workspace_id', campaign.workspace_id)
      .eq('account_type', 'email')
      .in('connection_status', VALID_CONNECTION_STATUSES)
      .limit(1)
      .maybeSingle();

    if (emailAccountError) {
      console.error('Error fetching email account:', emailAccountError);
    }

    if (!emailAccount || !emailAccount.unipile_account_id) {
      return NextResponse.json({
        error: 'No email account connected',
        details: 'Please connect an email account (Gmail or Outlook) in Settings → Integrations before sending email campaigns.',
        accounts_needed: true
      }, { status: 400 });
    }

    console.log(`📧 [EMAIL EXECUTE] Using email account: ${emailAccount.account_name} (Unipile ID: ${emailAccount.unipile_account_id})`);

    // Get prospects that haven't been contacted yet
    // Note: prospect data is directly in campaign_prospects (not nested in workspace_prospects)
    const pendingProspects = campaign.campaign_prospects.filter(
      (cp: any) => cp.status === 'pending' && cp.email
    );

    if (pendingProspects.length === 0) {
      return NextResponse.json({ 
        message: 'No pending prospects with email addresses to contact',
        processed: 0 
      });
    }

    // Apply per-execution limit (1 email per call due to Netlify function timeout)
    // For bulk sending, use the queue-based endpoint instead
    const perExecutionLimit = 1;
    const prospectsToProcess = pendingProspects.slice(0, perExecutionLimit);

    console.log(`📧 [EMAIL EXECUTE] Processing ${prospectsToProcess.length} prospect(s)`);

    // Get initial email template - email campaigns use email_body field
    const initialEmailTemplate = campaign.message_templates?.email_body ||
                                  campaign.message_templates?.alternative_message || '';

    // Get email subject
    const subjectTemplate = campaign.message_templates?.initial_subject ||
                            campaign.message_templates?.email_subject ||
                            `Quick question about {company_name}`;

    if (!initialEmailTemplate) {
      return NextResponse.json({
        error: 'No email template found',
        details: 'Campaign is missing initial email message. Please edit the campaign and add message templates.'
      }, { status: 400 });
    }

    // Process prospects - send emails directly via Unipile
    const results = {
      total: prospectsToProcess.length,
      sent: 0,
      failed: 0,
      errors: [] as any[]
    };

    for (const cp of prospectsToProcess) {
      // Prospect data is directly on cp (not nested in workspace_prospects)
      const prospect = cp;

      try {
        // Personalize the email
        const personalizedBody = personalizeMessage(initialEmailTemplate, prospect);
        const personalizedSubject = personalizeMessage(subjectTemplate, prospect);

        console.log(`📧 Sending email to ${prospect.email}: ${personalizedSubject}`);

        // Build the email payload
        const emailPayload = {
          account_id: emailAccount.unipile_account_id,
          to: [{
            display_name: `${prospect.first_name} ${prospect.last_name}`.trim() || prospect.email.split('@')[0],
            identifier: prospect.email
          }],
          subject: personalizedSubject,
          body: `<p>${personalizedBody.replace(/\n/g, '<br>')}</p>`
        };

        console.log(`📧 Email payload:`, JSON.stringify(emailPayload));

        // Send via Unipile - CORRECT FORMAT (Nov 26 fix)
        // Endpoint: /api/v1/emails (confirmed working in process-email-queue)
        // Payload: to is array with {display_name, identifier}
        const emailResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/emails`, {
          method: 'POST',
          headers: {
            'X-API-KEY': UNIPILE_API_KEY!,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`❌ Unipile API error for ${prospect.email}: HTTP ${emailResponse.status} - ${errorText}`);
          let errorMessage = `HTTP ${emailResponse.status}`;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorText;
          } catch {
            errorMessage = errorText || `HTTP ${emailResponse.status}`;
          }
          throw new Error(errorMessage);
        }

        const emailResult = await emailResponse.json();
        console.log(`✅ Email sent to ${prospect.email}:`, emailResult);

        // Update prospect status
        await supabase
          .from('campaign_prospects')
          .update({
            status: 'email_sent',
            email_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', cp.id);

        results.sent++;

      } catch (error: any) {
        console.error(`❌ Failed to send email to ${prospect?.email}:`, error);

        // Update prospect with error status
        await supabase
          .from('campaign_prospects')
          .update({
            status: 'error',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', cp.id);

        results.failed++;
        results.errors.push({
          prospect_id: prospect?.id,
          name: `${prospect?.first_name} ${prospect?.last_name}`,
          email: prospect?.email,
          error: error.message
        });
      }
    }

    // Update campaign last_executed_at
    await supabase
      .from('campaigns')
      .update({
        last_executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    return NextResponse.json({
      success: true,
      message: `Email campaign executed: ${results.sent} sent, ${results.failed} failed`,
      results,
      account_used: emailAccount.account_name
    });

  } catch (error: any) {
    console.error('Email campaign execution error:', error);
    return NextResponse.json(
      { error: 'Email campaign execution failed', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to send email via Unipile
async function sendEmailViaUnipile(
  request: SendEmailRequest
): Promise<UnipileResponse<SendEmailResponse>> {
  try {
    const response = await fetch(`${UNIPILE_BASE_URL}/api/v1/messages/send`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        object: 'error',
        error: {
          type: errorData.type || 'api_error',
          message: errorData.message || `HTTP ${response.status}: ${response.statusText}`
        }
      };
    }

    const data = await response.json();
    return {
      object: 'success',
      data
    };

  } catch (error: any) {
    return {
      object: 'error',
      error: {
        type: 'network_error',
        message: error.message
      }
    };
  }
}

// Helper function to personalize messages (uses universal personalization)
function personalizeMessage(template: string, prospect: any): string {
  return personalizeMessageUniversal(template, {
    first_name: prospect.first_name,
    last_name: prospect.last_name,
    company_name: prospect.company_name,
    company: prospect.company,
    title: prospect.title,
    job_title: prospect.job_title,
    email: prospect.email,
    location: prospect.location,
    industry: prospect.industry
  });
}

// Helper function for random delays (2-5 minutes for email)
function getRandomEmailDelay(): number {
  const minDelay = 2 * 60 * 1000; // 2 minutes
  const maxDelay = 5 * 60 * 1000; // 5 minutes
  return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

// AI Final Check function for email optimization
async function performEmailFinalCheck(
  subject: string,
  body: string,
  recipient: any, 
  context: any
): Promise<{
  approved: boolean;
  confidence_score: number;
  issues: Array<{
    type: 'error' | 'warning' | 'suggestion';
    category: 'length' | 'personalization' | 'spam' | 'compliance' | 'tone' | 'content';
    message: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
  optimized_subject?: string;
  optimized_body?: string;
  recommendations: string[];
}> {
  const issues: any[] = [];
  const recommendations: string[] = [];
  let optimized_subject: string | undefined;
  let optimized_body: string | undefined;

  // Critical Issues (will block sending)
  
  // 1. Subject line validation
  if (!subject || subject.trim().length === 0) {
    issues.push({
      type: 'error',
      category: 'content',
      message: 'Email subject line cannot be empty',
      severity: 'critical'
    });
  }

  if (subject.length > 50) {
    issues.push({
      type: 'warning',
      category: 'length',
      message: `Subject line is long (${subject.length} chars). Consider shortening for better open rates.`,
      severity: 'medium'
    });
  }

  // 2. Body validation
  if (!body || body.trim().length === 0) {
    issues.push({
      type: 'error',
      category: 'content',
      message: 'Email body cannot be empty',
      severity: 'critical'
    });
  }

  if (body.length > 2000) {
    issues.push({
      type: 'warning',
      category: 'length',
      message: `Email body is very long (${body.length} chars). Consider shortening for better engagement.`,
      severity: 'medium'
    });
  }

  // 3. Personalization check
  const hasPersonalization = subject.includes(recipient.first_name) || 
                            body.includes(recipient.first_name) ||
                            subject.includes(recipient.company_name) ||
                            body.includes(recipient.company_name);
  
  if (!hasPersonalization) {
    issues.push({
      type: 'error',
      category: 'personalization',
      message: 'Email lacks personalization - should include recipient name or company',
      severity: 'critical'
    });
  }

  // 4. Spam word detection
  const spamWords = [
    'guaranteed', 'free money', 'act now', 'urgent', 'limited time',
    'click here', 'buy now', 'cash', 'earn money', 'make money fast',
    'no obligation', 'risk free', 'save big money', 'winner', 'congratulations'
  ];

  const lowerSubject = subject.toLowerCase();
  const lowerBody = body.toLowerCase();
  const foundSpamWords = spamWords.filter(word => 
    lowerSubject.includes(word) || lowerBody.includes(word)
  );

  if (foundSpamWords.length > 0) {
    issues.push({
      type: 'warning',
      category: 'spam',
      message: `Potential spam words detected: ${foundSpamWords.join(', ')}`,
      severity: 'high'
    });
  }

  // 5. Professional tone check
  if (body.includes('!!!') || body.includes('???')) {
    issues.push({
      type: 'warning',
      category: 'tone',
      message: 'Excessive punctuation may appear unprofessional',
      severity: 'medium'
    });
  }

  // Generate optimized content if there are fixable issues
  if (issues.some(issue => issue.severity === 'critical' || issue.severity === 'high')) {
    if (!hasPersonalization) {
      optimized_subject = subject.includes(recipient.company_name) ? 
        subject : `${subject} - ${recipient.company_name}`;
      
      if (!body.includes(recipient.first_name)) {
        optimized_body = `Hi ${recipient.first_name},\n\n${body}`;
      }
    }

    // Remove spam words if found
    if (foundSpamWords.length > 0) {
      let cleanSubject = subject;
      let cleanBody = body;
      foundSpamWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        cleanSubject = cleanSubject.replace(regex, '');
        cleanBody = cleanBody.replace(regex, '');
      });
      optimized_subject = cleanSubject.trim();
      optimized_body = cleanBody.trim();
    }
  }

  // Add recommendations
  if (subject.length > 40) {
    recommendations.push('Consider shortening subject line to under 40 characters for mobile optimization');
  }
  
  if (body.length > 150) {
    recommendations.push('Keep email body concise - aim for under 150 words for cold outreach');
  }
  
  if (!body.includes('Best regards') && !body.includes('Sincerely') && !body.includes('Thanks')) {
    recommendations.push('Consider adding a professional closing to your email');
  }

  // Calculate confidence score
  let confidence_score = 1.0;
  
  // Deduct for critical issues
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  confidence_score -= criticalIssues * 0.4;
  
  // Deduct for high severity issues
  const highIssues = issues.filter(i => i.severity === 'high').length;
  confidence_score -= highIssues * 0.2;

  // Ensure confidence score doesn't go below 0
  confidence_score = Math.max(0, confidence_score);

  // Add bonuses for good practices
  if (hasPersonalization) confidence_score += 0.1;
  if (subject.length <= 40 && subject.length > 0) confidence_score += 0.05;
  if (body.length <= 200 && body.length > 50) confidence_score += 0.05;

  // Cap at 1.0
  confidence_score = Math.min(1.0, confidence_score);

  // Determine if email is approved
  const approved = issues.filter(i => i.severity === 'critical').length === 0;

  return {
    approved,
    confidence_score,
    issues,
    optimized_subject,
    optimized_body,
    recommendations
  };
}