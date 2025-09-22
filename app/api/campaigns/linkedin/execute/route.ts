import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { 
  detectLanguageFromContent, 
  getPersonalizationGuidelines, 
  getLanguageSpecificRecommendations 
} from '@/utils/linkedin-personalization-languages';

// Import MCP tools for Unipile integration
declare global {
  function mcp__unipile__unipile_get_accounts(): Promise<any[]>;
}

// Unipile API configuration
const UNIPILE_BASE_URL = process.env.UNIPILE_DSN || 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

interface UnipileResponse<T> {
  object: string;
  data?: T;
  error?: {
    type: string;
    message: string;
  };
}

interface SendInvitationRequest {
  provider_id: string;        // LinkedIn user ID
  account_id: string;         // LinkedIn account ID
  user_email?: string;        // Email (LinkedIn requirement)
  message?: string;           // Connection request message (max 300 chars)
}

interface SendInvitationResponse {
  object: "UserInvitationSent";
  invitation_id: string;
  usage?: number;             // Usage percentage
}

interface Prospect {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  job_title: string;
  linkedin_user_id: string;
  email?: string;
  location?: string;
  industry?: string;
}

interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  linkedin_account_id: string;
  connection_request_template: string;
  follow_up_templates: string[];
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
          invitation_sent_at,
          workspace_prospects (
            id,
            first_name,
            last_name,
            company_name,
            job_title,
            linkedin_profile_url,
            email_address,
            location
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

    // Get available LinkedIn accounts via MCP (structured data access)
    const availableAccounts = await mcp__unipile__unipile_get_accounts();
    const linkedinAccounts = availableAccounts.filter(account => 
      account.type === 'LINKEDIN' && 
      account.sources?.[0]?.status === 'OK'
    );

    if (linkedinAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No active LinkedIn accounts available',
        details: 'Please connect a LinkedIn account first' 
      }, { status: 400 });
    }

    // Select best account (prefer Sales Navigator > Premium > Classic)
    const selectedAccount = linkedinAccounts.find(account => 
      account.connection_params?.im?.premiumFeatures?.includes('sales_navigator')
    ) || linkedinAccounts.find(account => 
      account.connection_params?.im?.premiumFeatures?.includes('premium')
    ) || linkedinAccounts[0];

    console.log(`Using LinkedIn account: ${selectedAccount.name} (${selectedAccount.connection_params?.im?.premiumFeatures?.join(', ') || 'classic'})`);

    // Get prospects that haven't been contacted yet
    const pendingProspects = campaign.campaign_prospects.filter(
      (cp: any) => cp.status === 'pending' && cp.workspace_prospects
    );

    if (pendingProspects.length === 0) {
      return NextResponse.json({ 
        message: 'No pending prospects to contact',
        processed: 0 
      });
    }

    // Apply daily limit
    const prospectsToProcess = pendingProspects.slice(0, campaign.daily_limit || 50);
    
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
        
        // Personalize the connection request message
        const personalizedMessage = personalizeMessage(
          campaign.message_templates?.connection_request || "Hi {first_name}, I'd like to connect!",
          prospect
        );

        // Perform AI final check before sending
        const finalCheckResult = await performFinalCheck(personalizedMessage, prospect, {
          campaign_type: campaign.campaign_type,
          message_type: 'connection_request',
          platform: 'linkedin',
          account_type: selectedAccount.connection_params?.im?.premiumFeatures?.length > 0 ? 'premium' : 'free'
        });

        // If final check fails, skip this prospect with detailed error
        if (!finalCheckResult.approved) {
          const criticalIssues = finalCheckResult.issues
            .filter(issue => issue.severity === 'critical')
            .map(issue => issue.message)
            .join('; ');
          
          throw new Error(`AI Final Check Failed: ${criticalIssues || 'Message quality issues detected'}`);
        }

        // Use optimized message if available, otherwise use original
        const messageToSend = finalCheckResult.optimized_message || personalizedMessage;

        // Additional length validation (backup check)
        if (messageToSend.length > 300) {
          throw new Error('Connection request message exceeds 300 character limit');
        }

        // Extract LinkedIn user ID from profile URL
        const linkedinUserId = extractLinkedInUserId(prospect.linkedin_profile_url);
        if (!linkedinUserId) {
          throw new Error('Invalid LinkedIn profile URL');
        }

        // Send invitation via Unipile
        const invitationResponse = await sendLinkedInInvitation({
          provider_id: linkedinUserId,
          account_id: selectedAccount.sources[0].id,
          user_email: prospect.email_address,
          message: messageToSend
        });

        if (invitationResponse.error) {
          throw new Error(invitationResponse.error.message);
        }

        // Update campaign prospect status using database function
        await supabase.rpc('update_campaign_prospect_status', {
          p_campaign_id: campaignId,
          p_prospect_id: prospect.id,
          p_status: 'invitation_sent',
          p_invitation_id: invitationResponse.data?.invitation_id
        });

        // Track campaign message
        await supabase.rpc('track_campaign_message', {
          p_campaign_id: campaignId,
          p_platform: 'linkedin',
          p_platform_message_id: invitationResponse.data?.invitation_id,
          p_message_content: messageToSend,
          p_recipient_linkedin_profile: prospect.linkedin_profile_url,
          p_recipient_name: `${prospect.first_name} ${prospect.last_name}`,
          p_recipient_email: prospect.email_address,
          p_message_template_variant: 'connection_request',
          p_sender_account: selectedAccount.name
        });

        results.sent++;

        // Rate limiting - random delay between 5-15 minutes
        if (results.sent < prospectsToProcess.length) {
          const delay = getRandomDelay();
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error: any) {
        const prospect = campaignProspect.workspace_prospects;
        console.error(`Failed to send invitation to ${prospect?.first_name} ${prospect?.last_name}:`, error);
        
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
          error: error.message
        });
      }
    }

    // Update campaign statistics
    await supabase
      .from('campaigns')
      .update({
        invitations_sent: campaign.invitations_sent + results.sent,
        last_executed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    return NextResponse.json({
      message: 'Campaign execution completed',
      results
    });

  } catch (error: any) {
    console.error('Campaign execution error:', error);
    return NextResponse.json(
      { error: 'Campaign execution failed', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to send LinkedIn invitation via Unipile
async function sendLinkedInInvitation(
  request: SendInvitationRequest
): Promise<UnipileResponse<SendInvitationResponse>> {
  try {
    const response = await fetch(`${UNIPILE_BASE_URL}/api/v1/users/invite`, {
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
    .replace(/{full_name}/g, `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim());
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

// Helper function for random delays (5-15 minutes)
function getRandomDelay(): number {
  const minDelay = 5 * 60 * 1000; // 5 minutes
  const maxDelay = 15 * 60 * 1000; // 15 minutes
  return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

// AI Final Check function for message optimization
async function performFinalCheck(
  message: string, 
  recipient: any, 
  context: any
): Promise<{
  approved: boolean;
  confidence_score: number;
  issues: Array<{
    type: 'error' | 'warning' | 'suggestion';
    category: 'length' | 'personalization' | 'cultural' | 'compliance' | 'tone' | 'content';
    message: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
  optimized_message?: string;
  recommendations: string[];
}> {
  const issues: any[] = [];
  const recommendations: string[] = [];
  let optimized_message: string | undefined;

  // Language detection and cultural analysis
  const detectedLanguage = detectLanguageFromContent(message);
  const guidelines = getPersonalizationGuidelines(detectedLanguage);
  const languageRecommendations = getLanguageSpecificRecommendations(message, detectedLanguage);

  // Character count analysis
  const maxLimit = context.account_type === 'free' ? 200 : 300;
  const recommendedMax = maxLimit - 20; // Leave buffer

  // Critical Issues (will block sending)
  
  // 1. Character limit violations
  if (message.length > maxLimit) {
    issues.push({
      type: 'error',
      category: 'length',
      message: `Message exceeds LinkedIn character limit (${message.length}/${maxLimit} chars)`,
      severity: 'critical'
    });
  }

  // 2. Missing personalization
  const hasPersonalization = message.includes(recipient.first_name) || 
                            message.includes(recipient.last_name) ||
                            message.includes(recipient.company_name);
  
  if (!hasPersonalization) {
    issues.push({
      type: 'error',
      category: 'personalization',
      message: 'Message lacks personalization - should include recipient name or company',
      severity: 'critical'
    });
  }

  // 3. Cultural compliance for non-English
  if (detectedLanguage === 'de') {
    if (!message.includes('Sie') && !message.includes('Sehr geehrte')) {
      issues.push({
        type: 'error',
        category: 'cultural',
        message: 'German messages must use formal "Sie" addressing',
        severity: 'high'
      });
    }
  }

  if (detectedLanguage === 'fr') {
    if (!message.includes('Vous') && !message.includes('Monsieur') && !message.includes('Madame')) {
      issues.push({
        type: 'error',
        category: 'cultural',
        message: 'French messages must use formal "Vous" addressing',
        severity: 'high'
      });
    }
  }

  // Add language-specific recommendations
  if (languageRecommendations.length > 0) {
    recommendations.push(...languageRecommendations.slice(0, 2));
  }

  // Generate optimized message if there are fixable issues
  if (issues.some(issue => issue.severity === 'critical' || issue.severity === 'high')) {
    optimized_message = generateOptimizedMessage(message, recipient, guidelines, maxLimit);
  }

  // Calculate confidence score
  let confidence_score = 1.0;
  
  // Deduct for critical issues
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  confidence_score -= criticalIssues * 0.3;
  
  // Deduct for high severity issues
  const highIssues = issues.filter(i => i.severity === 'high').length;
  confidence_score -= highIssues * 0.2;

  // Ensure confidence score doesn't go below 0
  confidence_score = Math.max(0, confidence_score);

  // Add bonuses for good practices
  if (hasPersonalization) confidence_score += 0.1;
  if (message.length <= recommendedMax) confidence_score += 0.05;

  // Cap at 1.0
  confidence_score = Math.min(1.0, confidence_score);

  // Determine if message is approved
  const approved = issues.filter(i => i.severity === 'critical').length === 0;

  return {
    approved,
    confidence_score,
    issues,
    optimized_message,
    recommendations
  };
}

// Generate optimized message
function generateOptimizedMessage(
  originalMessage: string, 
  recipient: any, 
  guidelines: any, 
  maxLimit: number
): string {
  let optimized = originalMessage;

  // Fix personalization if missing
  const hasPersonalization = optimized.includes(recipient.first_name) || 
                            optimized.includes(recipient.last_name) ||
                            optimized.includes(recipient.company_name);

  if (!hasPersonalization) {
    // Add basic personalization at the beginning
    const greeting = guidelines.language === 'German' ? `Sehr geehrte/r ${recipient.first_name} ${recipient.last_name}` :
                    guidelines.language === 'French' ? `Bonjour ${recipient.first_name}` :
                    guidelines.language === 'Dutch' ? `Hallo ${recipient.first_name}` :
                    `Hi ${recipient.first_name}`;
    
    optimized = `${greeting},\n\n${optimized}`;
  }

  // Fix cultural addressing for German
  if (guidelines.language === 'German' && !optimized.includes('Sie')) {
    optimized = optimized.replace(/\bdu\b/gi, 'Sie');
    optimized = optimized.replace(/\bdich\b/gi, 'Sie');
    optimized = optimized.replace(/\bdir\b/gi, 'Ihnen');
  }

  // Fix cultural addressing for French  
  if (guidelines.language === 'French' && !optimized.includes('Vous')) {
    optimized = optimized.replace(/\btu\b/gi, 'Vous');
    optimized = optimized.replace(/\btoi\b/gi, 'Vous');
  }

  // Trim if too long
  if (optimized.length > maxLimit) {
    optimized = optimized.substring(0, maxLimit - 3) + '...';
  }

  return optimized;
}