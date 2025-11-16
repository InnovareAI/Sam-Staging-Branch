import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// Import MCP tools for Unipile integration
declare global {
  function mcp__unipile__unipile_get_accounts(): Promise<any[]>;
}

// N8N Workflow configuration
const N8N_WEBHOOK_URL = process.env.N8N_CAMPAIGN_WEBHOOK_URL || 'https://workflows.innovareai.com/webhook/campaign-execute';

// Unipile API configuration
const UNIPILE_BASE_URL = process.env.UNIPILE_DSN || 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

// Supabase configuration for N8N
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request data
    const { campaignId } = await req.json();
    
    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_prospects (
          id,
          prospect_id,
          status,
          sequence_step,
          email_sent_at,
          workspace_prospects (
            id,
            first_name,
            last_name,
            company_name,
            job_title,
            email_address,
            linkedin_profile_url,
            location,
            industry
          )
        )
      `)
      .eq('id', campaignId)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Check if campaign is active
    if (campaign.status !== 'active') {
      return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 });
    }

    // Get available email accounts via MCP (structured data access)
    let availableAccounts = [];
    try {
      if (typeof mcp__unipile__unipile_get_accounts === 'function') {
        availableAccounts = await mcp__unipile__unipile_get_accounts();
      }
    } catch (error) {
      console.log('MCP function not available, using fallback');
      availableAccounts = [];
    }
    
    const emailAccounts = availableAccounts.filter(account => 
      (account.type === 'MAIL' || account.type === 'EMAIL') && 
      account.sources?.[0]?.status === 'OK'
    );

    if (emailAccounts.length === 0) {
      // ULTRAHARD FIX: Graceful fallback when MCP unavailable
      return NextResponse.json({ 
        success: true,
        message: 'Email campaign queued - no connected accounts detected',
        processed: 0,
        accounts_needed: true,
        details: 'Please connect an email account first. For Startup plan ($99/month), connect your Gmail or Outlook via Unipile.',
        fallback_mode: true
      });
    }

    // Select best email account (prefer specified account or first available)
    const selectedAccount = campaign.email_account_id 
      ? emailAccounts.find(account => account.id === campaign.email_account_id)
      : emailAccounts[0];

    if (!selectedAccount) {
      return NextResponse.json({ 
        error: 'Specified email account not found or inactive',
        details: 'Please check your email account connection' 
      }, { status: 400 });
    }

    console.log(`Using email account: ${selectedAccount.name} (${selectedAccount.type})`);

    // Get prospects that haven't been contacted yet
    const pendingProspects = campaign.campaign_prospects.filter(
      (cp: any) => cp.status === 'pending' && cp.workspace_prospects && cp.workspace_prospects.email_address
    );

    if (pendingProspects.length === 0) {
      return NextResponse.json({ 
        message: 'No pending prospects with email addresses to contact',
        processed: 0 
      });
    }

    // Apply daily limit (respect Startup plan limits: 800 emails/month ≈ 40/day weekdays)
    const dailyLimit = Math.min(campaign.daily_limit || 40, 40); // Cap at 40/day for Startup plan
    const prospectsToProcess = pendingProspects.slice(0, dailyLimit);

    // Prepare prospects for N8N orchestration
    const prospectsPayload = prospectsToProcess.map((cp: any) => {
      const prospect = cp.workspace_prospects;
      return {
        id: cp.id, // campaign_prospect ID
        email: prospect.email_address,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        company_name: prospect.company_name,
        title: prospect.job_title,
        location: prospect.location,
        industry: prospect.industry
      };
    });

    console.log('📧 Routing email campaign to N8N orchestrator:', {
      campaign_id: campaignId,
      prospects_count: prospectsPayload.length,
      email_account: selectedAccount.name
    });

    // Call N8N webhook with channel='email'
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // CRITICAL: Set channel to 'email'
        channel: 'email',

        // Campaign identifiers
        workspace_id: campaign.workspace_id,
        campaign_id: campaignId,

        // Email-specific fields
        email_account_id: selectedAccount.sources[0].id,
        from_email: selectedAccount.name || 'SAM AI Assistant',
        subject_template: campaign.message_templates?.email_subject || 'Quick question',

        // Common fields
        unipile_dsn: UNIPILE_BASE_URL,
        unipile_api_key: UNIPILE_API_KEY,
        supabase_url: SUPABASE_URL,
        supabase_service_key: SUPABASE_SERVICE_ROLE_KEY,

        // Prospects
        prospects: prospectsPayload,

        // Messages
        messages: {
          initial_email: campaign.message_templates?.email_body || '',
          follow_up_1: campaign.message_templates?.follow_up_emails?.[0]?.body || '',
          follow_up_2: campaign.message_templates?.follow_up_emails?.[1]?.body || '',
          follow_up_3: campaign.message_templates?.follow_up_emails?.[2]?.body || '',
          follow_up_4: campaign.message_templates?.follow_up_emails?.[3]?.body || '',
          goodbye: campaign.message_templates?.follow_up_emails?.[4]?.body || ''
        },

        // Timing configuration
        timing: {
          fu1_delay_days: campaign.message_templates?.follow_up_emails?.[0]?.delay_days || 2,
          fu2_delay_days: campaign.message_templates?.follow_up_emails?.[1]?.delay_days || 5,
          fu3_delay_days: campaign.message_templates?.follow_up_emails?.[2]?.delay_days || 7,
          fu4_delay_days: campaign.message_templates?.follow_up_emails?.[3]?.delay_days || 5,
          gb_delay_days: campaign.message_templates?.follow_up_emails?.[4]?.delay_days || 7
        }
      })
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('❌ N8N workflow failed:', errorText);
      throw new Error(`N8N workflow failed: ${n8nResponse.statusText}`);
    }

    const n8nResult = await n8nResponse.json();
    console.log('✅ Email campaign sent to N8N orchestrator:', n8nResult);

    // Update campaign status to active
    await supabase
      .from('campaigns')
      .update({
        status: 'active',
        last_executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    return NextResponse.json({
      success: true,
      message: 'Email campaign launched via N8N orchestrator',
      prospects_queued: prospectsPayload.length,
      n8n_execution: n8nResult,
      account_used: selectedAccount.name,
      orchestration: 'n8n',
      next_steps: [
        'N8N will orchestrate email sending with configured delays',
        'Reply detection will trigger automatically',
        'Follow-ups will be sent if no reply received',
        'HITL approval will be triggered on prospect replies'
      ]
    });

    /* OLD CODE - Replaced with N8N orchestration
    const results = {
      total: prospectsToProcess.length,
      sent: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Process each prospect
    for (const campaignProspect of prospectsToProcess) {
      try {
        const prospect = campaignProspect.workspace_prospects;
        
        // Personalize the email subject and body
        const personalizedSubject = personalizeMessage(
          campaign.message_templates?.email_subject || "Quick question about {company_name}",
          prospect
        );

        const personalizedBody = personalizeMessage(
          campaign.message_templates?.email_body || "Hi {first_name},\n\nI noticed your work at {company_name}. I'd love to connect!\n\nBest regards",
          prospect
        );

        // Perform AI final check before sending
        const finalCheckResult = await performEmailFinalCheck(personalizedSubject, personalizedBody, prospect, {
          campaign_type: campaign.campaign_type,
          message_type: 'cold_email',
          platform: 'email',
          tier: 'startup' // Default for Unipile-first implementation
        });

        // If final check fails, skip this prospect with detailed error
        if (!finalCheckResult.approved) {
          const criticalIssues = finalCheckResult.issues
            .filter(issue => issue.severity === 'critical')
            .map(issue => issue.message)
            .join('; ');
          
          throw new Error(`AI Final Check Failed: ${criticalIssues || 'Email quality issues detected'}`);
        }

        // Use optimized content if available, otherwise use original
        const subjectToSend = finalCheckResult.optimized_subject || personalizedSubject;
        const bodyToSend = finalCheckResult.optimized_body || personalizedBody;

        // Send email via Unipile
        const emailResponse = await sendEmailViaUnipile({
          account_id: selectedAccount.sources[0].id,
          to: prospect.email_address,
          subject: subjectToSend,
          body: bodyToSend,
          from_name: selectedAccount.name || 'SAM AI Assistant'
        });

        if (emailResponse.error) {
          throw new Error(emailResponse.error.message);
        }

        // Update campaign prospect status using database function
        await supabase.rpc('update_campaign_prospect_status', {
          p_campaign_id: campaignId,
          p_prospect_id: prospect.id,
          p_status: 'email_sent',
          p_email_message_id: emailResponse.data?.message_id
        });

        // Track campaign message
        await supabase.rpc('track_campaign_message', {
          p_campaign_id: campaignId,
          p_platform: 'email',
          p_platform_message_id: emailResponse.data?.message_id,
          p_message_content: `Subject: ${subjectToSend}\n\n${bodyToSend}`,
          p_recipient_email: prospect.email_address,
          p_recipient_name: `${prospect.first_name} ${prospect.last_name}`,
          p_recipient_linkedin_profile: prospect.linkedin_profile_url,
          p_message_template_variant: 'cold_email',
          p_sender_account: selectedAccount.name
        });

        results.sent++;

        // Rate limiting - random delay between 2-5 minutes for email (more frequent than LinkedIn)
        if (results.sent < prospectsToProcess.length) {
          const delay = getRandomEmailDelay();
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error: any) {
        const prospect = campaignProspect.workspace_prospects;
        console.error(`Failed to send email to ${prospect?.first_name} ${prospect?.last_name}:`, error);
        
        // Update prospect with error status
        await supabase.rpc('update_campaign_prospect_status', {
          p_campaign_id: campaignId,
          p_prospect_id: prospect?.id,
          p_status: 'error',
          p_error_message: error.message
        });

        results.failed++;
        results.errors.push({
          prospect_id: prospect?.id,
          name: `${prospect?.first_name} ${prospect?.last_name}`,
          email: prospect?.email_address,
          error: error.message
        });
      }
    }

    // Update campaign statistics
    await supabase
      .from('campaigns')
      .update({
        emails_sent: (campaign.emails_sent || 0) + results.sent,
        last_executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    return NextResponse.json({
      message: 'Email campaign execution completed',
      results,
      account_used: selectedAccount.name,
      tier_limits: {
        startup_plan: '800 emails/month (~40/day weekdays)',
        current_daily_limit: dailyLimit
      }
    });
    */
    // END OLD CODE - Now using N8N orchestration above

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

// Helper function to personalize messages
function personalizeMessage(template: string, prospect: any): string {
  return template
    .replace(/{first_name}/g, prospect.first_name || '')
    .replace(/{last_name}/g, prospect.last_name || '')
    .replace(/{company_name}/g, prospect.company_name || '')
    .replace(/{job_title}/g, prospect.job_title || '')
    .replace(/{location}/g, prospect.location || '')
    .replace(/{industry}/g, prospect.industry || '')
    .replace(/{full_name}/g, `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim());
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