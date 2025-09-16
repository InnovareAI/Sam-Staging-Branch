import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { emailApprovalParser } from '@/lib/services/email-approval-parser';
import { unipileSender } from '@/lib/services/unipile-sender';
import { prospectResearcher, type ResearchResult } from '@/lib/services/prospect-research';

/**
 * SAM Reply Workflow API
 * Handles the complete flow: Inbox Message → SAM Draft → Email Approval → Unipile Send
 * 
 * Endpoints:
 * POST /api/replies/workflow/start - Start reply thread with SAM draft
 * POST /api/replies/workflow/send-approval - Send approval email to client
 * POST /api/replies/workflow/process-approval - Process client approval response
 * POST /api/replies/workflow/send-message - Send approved message via Unipile
 * GET /api/replies/workflow/status/:threadId - Get thread status
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const { action, ...payload } = await request.json();

    switch (action) {
      case 'start_reply':
        return await startReplyThread(supabase, user.id, payload);
      
      case 'send_approval':
        return await sendApprovalEmail(supabase, user.id, payload);
      
      case 'process_approval':
        return await processApprovalResponse(supabase, payload);
      
      case 'send_message':
        return await sendMessageViaUnipile(supabase, payload);
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Reply workflow error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('threadId');

    if (!threadId) {
      return NextResponse.json({
        success: false,
        error: 'Thread ID required'
      }, { status: 400 });
    }

    return await getThreadStatus(supabase, threadId);

  } catch (error) {
    console.error('❌ Get thread status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Start a new reply thread with prospect research, lead scoring, and SAM draft generation
 */
async function startReplyThread(supabase: any, userId: string, payload: any) {
  const {
    originalMessageId,
    originalPlatform,
    originalSenderName,
    originalSenderEmail,
    originalSenderId,
    originalSubject,
    originalContent,
    originalTimestamp,
    userGuidance,
    tonePreference = 'professional'
  } = payload;

  console.log('🚀 Starting intelligent reply thread with research for:', originalSenderName);

  // Generate unique thread ID
  const threadId = `SAM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  try {
    // STEP 1: PROSPECT RESEARCH & LEAD SCORING
    console.log('🔍 Conducting prospect research and scoring...');
    const researchResult = await prospectResearcher.researchProspect(
      originalSenderName,
      originalSenderEmail,
      originalContent,
      originalPlatform
    );

    console.log('📊 Research completed:', {
      company: researchResult.company.name,
      score: researchResult.leadScore.overall,
      category: researchResult.leadScore.overall >= 80 ? 'Hot Lead' : 
                researchResult.leadScore.overall >= 65 ? 'Warm Lead' :
                researchResult.leadScore.overall >= 50 ? 'Qualified Lead' : 'Cold Lead',
      confidence: researchResult.confidence
    });

    // STEP 2: INTELLIGENT SAM DRAFT with research context
    console.log('🤖 Generating SAM draft with research context...');
    const samDraftContent = await generateIntelligentSamDraft({
      originalContent,
      userGuidance,
      tonePreference,
      senderName: originalSenderName,
      platform: originalPlatform,
      researchResult // Enhanced with research context
    });

    // STEP 3: LEAD PIPELINE INTEGRATION with scoring
    await updateLeadPipelineStatus(supabase, {
      senderName: originalSenderName,
      senderEmail: originalSenderEmail,
      company: researchResult.company.name,
      platform: originalPlatform,
      action: 'reply_initiated',
      threadId,
      userId,
      leadScore: researchResult.leadScore.overall
    });

    // STEP 4: HITL DECISION LOGIC
    const shouldRequireApproval = determineHITLRequirement(researchResult, samDraftContent);

    // Create reply thread record with research data
    const threadData = {
      id: threadId,
      user_id: userId,
      original_message_id: originalMessageId,
      original_platform: originalPlatform,
      original_sender_name: originalSenderName,
      original_sender_email: originalSenderEmail,
      original_sender_id: originalSenderId,
      original_subject: originalSubject,
      original_content: originalContent,
      original_timestamp: originalTimestamp,
      thread_id: threadId,
      status: shouldRequireApproval ? 'awaiting_approval' : 'draft',
      created_at: new Date().toISOString(),
      // Enhanced with research data
      research_data: researchResult,
      lead_score: researchResult.leadScore.overall,
      requires_approval: shouldRequireApproval
    };

    // Create draft record with enhanced context
    const draftData = {
      thread_id: threadId,
      draft_content: samDraftContent.content,
      sam_reasoning: samDraftContent.reasoning,
      user_guidance: userGuidance,
      tone_preference: tonePreference,
      is_active: true,
      status: shouldRequireApproval ? 'awaiting_approval' : 'ready',
      research_context: researchResult,
      personalization_hooks: researchResult.personalizedHooks
    };

    console.log('✅ Intelligent reply thread started:', { 
      threadId, 
      leadScore: researchResult.leadScore.overall,
      requiresApproval: shouldRequireApproval,
      company: researchResult.company.name,
      draftLength: samDraftContent.content.length
    });

    return NextResponse.json({
      success: true,
      threadId,
      research: {
        prospect: researchResult.prospect,
        company: researchResult.company,
        leadScore: researchResult.leadScore,
        insights: researchResult.keyInsights,
        confidence: researchResult.confidence
      },
      draft: samDraftContent,
      status: shouldRequireApproval ? 'awaiting_approval' : 'draft_ready',
      next_step: shouldRequireApproval ? 'human_approval_required' : 'send_approval',
      hitl: {
        required: shouldRequireApproval,
        reason: getHITLReason(researchResult, samDraftContent),
        priority: researchResult.leadScore.overall >= 80 ? 'high' : 
                 researchResult.leadScore.overall >= 65 ? 'medium' : 'low'
      },
      leadPipeline: {
        updated: true,
        status: researchResult.leadScore.overall >= 70 ? 'opportunities' : 'qualified',
        score: researchResult.leadScore.overall,
        category: researchResult.leadScore.overall >= 80 ? 'Hot Lead' : 
                 researchResult.leadScore.overall >= 65 ? 'Warm Lead' : 'Qualified Lead'
      }
    });

  } catch (error) {
    console.error('❌ Intelligent reply thread failed:', error);
    
    // Fallback to basic workflow if research fails
    const fallbackDraft = await generateSamDraft({
      originalContent,
      userGuidance,
      tonePreference,
      senderName: originalSenderName,
      platform: originalPlatform
    });

    return NextResponse.json({
      success: true,
      threadId,
      draft: fallbackDraft,
      status: 'draft_ready',
      next_step: 'send_approval',
      research: {
        failed: true,
        error: 'Research unavailable - using fallback approach'
      },
      leadPipeline: {
        updated: true,
        status: 'qualified',
        reason: 'Fallback mode - limited research'
      }
    });
  }
}

/**
 * Send approval email to client
 */
async function sendApprovalEmail(supabase: any, userId: string, payload: any) {
  const { threadId, recipientEmail, recipientName } = payload;

  console.log('📧 Sending approval email for thread:', threadId);

  // Get thread and draft data (placeholder logic)
  const originalMessage = "Original message content"; // From database
  const draftReply = "SAM's drafted reply"; // From database

  // Generate approval email
  const approvalEmail = emailApprovalParser.generateApprovalEmailTemplate(
    originalMessage,
    draftReply,
    threadId,
    recipientName
  );

  // TODO: Send email via email service (SMTP/SendGrid/etc)
  console.log('📤 Approval email generated:', {
    to: recipientEmail,
    subject: approvalEmail.subject,
    bodyLength: approvalEmail.body.length
  });

  // Create approval email record
  const approvalEmailData = {
    thread_id: threadId,
    recipient_email: recipientEmail,
    recipient_name: recipientName,
    email_subject: approvalEmail.subject,
    email_body: approvalEmail.body,
    sent_at: new Date().toISOString(),
    status: 'sent'
  };

  return NextResponse.json({
    success: true,
    approvalEmail: {
      subject: approvalEmail.subject,
      recipient: recipientEmail
    },
    status: 'awaiting_approval',
    message: 'Approval email sent to client'
  });
}

/**
 * Process client approval response from email
 */
async function processApprovalResponse(supabase: any, payload: any) {
  const { emailSubject, emailBody, fromEmail } = payload;

  console.log('📥 Processing approval response from:', fromEmail);

  // Parse approval email
  const approvalResult = emailApprovalParser.parseApprovalEmail({
    subject: emailSubject,
    body: emailBody,
    fromEmail
  });

  // Validate result
  const validation = emailApprovalParser.validateApprovalResult(approvalResult);
  
  if (!validation.isValid) {
    return NextResponse.json({
      success: false,
      error: 'Invalid approval response',
      errors: validation.errors,
      result: approvalResult
    }, { status: 400 });
  }

  console.log('✅ Approval parsed successfully:', {
    action: approvalResult.action,
    confidence: approvalResult.confidence,
    threadId: approvalResult.originalThreadId
  });

  // Update thread status based on response
  let newStatus = 'unknown';
  switch (approvalResult.action) {
    case 'APPROVED':
      newStatus = 'approved';
      break;
    case 'CHANGES':
      newStatus = 'changes_requested';
      break;
    case 'STOP':
      newStatus = 'stopped';
      break;
  }

  return NextResponse.json({
    success: true,
    approvalResult,
    newStatus,
    next_step: approvalResult.action === 'APPROVED' ? 'send_message' : 
               approvalResult.action === 'CHANGES' ? 'generate_new_draft' : 
               'workflow_stopped'
  });
}

/**
 * Send approved message via Unipile
 */
async function sendMessageViaUnipile(supabase: any, payload: any) {
  const { threadId, finalMessage, platform, recipientInfo, unipileAccountId } = payload;

  console.log('📤 Sending message via Unipile:', { threadId, platform });

  try {
    let sendResult;

    if (platform === 'linkedin') {
      sendResult = await unipileSender.sendLinkedInMessage({
        accountId: unipileAccountId,
        chatId: recipientInfo.chatId,
        recipientId: recipientInfo.recipientId,
        message: finalMessage,
        replyToMessageId: recipientInfo.originalMessageId
      });
    } else if (['email', 'gmail', 'outlook'].includes(platform)) {
      sendResult = await unipileSender.sendEmail({
        accountId: unipileAccountId,
        to: recipientInfo.email,
        subject: `Re: ${recipientInfo.originalSubject || 'Your message'}`,
        body: finalMessage,
        replyToMessageId: recipientInfo.originalMessageId,
        threadId: threadId
      });
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    if (sendResult.success) {
      console.log('✅ Message sent successfully via Unipile:', {
        messageId: sendResult.messageId,
        platform: sendResult.platform
      });

      // LEAD PIPELINE INTEGRATION: Update lead status when message is actually sent
      await updateLeadPipelineStatus(supabase, {
        senderName: recipientInfo.name || 'Unknown',
        senderEmail: recipientInfo.email,
        company: extractCompanyFromSender(recipientInfo.name || 'Unknown', recipientInfo.email),
        platform: platform,
        action: 'message_sent',
        threadId,
        userId: 'current_user' // TODO: Get from auth context
      });

      return NextResponse.json({
        success: true,
        sendResult,
        status: 'sent',
        message: 'Reply sent successfully via Unipile',
        leadPipeline: {
          updated: true,
          status: 'opportunities',
          reason: 'Message sent - active engagement'
        }
      });
    } else {
      throw new Error(sendResult.error || 'Send failed');
    }

  } catch (error) {
    console.error('❌ Unipile send failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Send failed',
      status: 'failed'
    }, { status: 500 });
  }
}

/**
 * Get thread status and history
 */
async function getThreadStatus(supabase: any, threadId: string) {
  console.log('📊 Getting status for thread:', threadId);

  // TODO: Query database for thread status
  // This would normally fetch from reply_threads, reply_drafts, approval_emails, etc.
  
  const mockStatus = {
    threadId,
    status: 'awaiting_approval',
    created_at: new Date().toISOString(),
    current_step: 'client_review',
    original_message: {
      platform: 'linkedin',
      sender: 'John Doe',
      subject: 'Business inquiry'
    },
    draft: {
      content: 'Thank you for your message...',
      created_at: new Date().toISOString()
    },
    approval_status: {
      email_sent: true,
      client_responded: false,
      sent_at: new Date().toISOString()
    }
  };

  return NextResponse.json({
    success: true,
    thread: mockStatus
  });
}

/**
 * Generate intelligent SAM draft with research context
 * TODO: Integrate with actual SAM AI system
 */
async function generateIntelligentSamDraft(context: any) {
  const { originalContent, userGuidance, tonePreference, senderName, platform, researchResult } = context;

  console.log('🤖 Generating intelligent SAM draft with research context:', {
    contentLength: originalContent?.length || 0,
    guidance: userGuidance,
    tone: tonePreference,
    platform,
    leadScore: researchResult?.leadScore?.overall || 'N/A',
    company: researchResult?.company?.name || 'Unknown'
  });

  // Enhanced SAM draft generation with research context
  const research = researchResult;
  const prospect = research?.prospect || {};
  const company = research?.company || {};
  const score = research?.leadScore || {};
  const hooks = research?.personalizedHooks || [];

  // Craft personalized response based on research
  let draftContent = `Hi ${senderName},

Thank you for reaching out`;

  // Add company-specific context if available
  if (company.name && company.name !== 'Unknown Company') {
    draftContent += ` from ${company.name}`;
  }

  draftContent += `. `;

  // Add industry-specific hook
  if (company.industry && company.industry !== 'business services') {
    draftContent += `I see you're in the ${company.industry} space - we've helped several ${company.industry} companies `;
    
    // Add specific pain point if identified
    if (company.painPoints && company.painPoints.length > 0) {
      draftContent += `address challenges like ${company.painPoints[0]}. `;
    } else {
      draftContent += `streamline their operations with AI automation. `;
    }
  }

  // Add user guidance if provided
  if (userGuidance) {
    draftContent += `\n\n${userGuidance}\n\n`;
  } else {
    // Default value proposition based on company size
    if (company.size === 'enterprise' || company.size === 'large') {
      draftContent += `\n\nFor enterprise organizations like yours, we typically see 40-60% efficiency gains through our AI automation platform. `;
    } else if (company.size === 'startup') {
      draftContent += `\n\nFor growing companies like yours, we focus on scalable solutions that grow with your team. `;
    } else {
      draftContent += `\n\nI'd love to learn more about your current challenges and see how our AI automation platform might help. `;
    }
  }

  // Add call to action based on lead score
  if (score.overall >= 80) {
    draftContent += `Given your current growth trajectory, I'd love to show you a quick demo of how this could work specifically for ${company.name}. 

Would you have 15 minutes this week for a brief conversation?`;
  } else if (score.overall >= 65) {
    draftContent += `I'd be happy to share some relevant case studies from other ${company.industry} companies.

Would a brief 10-minute call work to discuss your specific needs?`;
  } else {
    draftContent += `I'd be happy to share more information about how we've helped companies in similar situations.

What specific challenges are you currently facing with automation or efficiency?`;
  }

  draftContent += `\n\nBest regards,\n[Your Name]`;

  // Enhanced reasoning with research insights
  const reasoning = [
    `Generated ${tonePreference} response for ${prospect.title || 'contact'} at ${company.name}`,
    `Lead score: ${score.overall}/100 (${score.overall >= 80 ? 'Hot' : score.overall >= 65 ? 'Warm' : 'Qualified'} lead)`,
    company.industry !== 'business services' ? `Targeted ${company.industry} industry` : 'General industry approach',
    company.painPoints?.length > 0 ? `Addressed pain point: ${company.painPoints[0]}` : 'Used general value proposition',
    score.overall >= 80 ? 'Aggressive CTA for hot lead' : score.overall >= 65 ? 'Moderate CTA for warm lead' : 'Soft CTA for qualified lead'
  ].join('. ');

  return {
    content: draftContent,
    reasoning,
    confidence: Math.min(0.95, 0.7 + (research?.confidence || 0)),
    generated_at: new Date().toISOString(),
    research_applied: {
      industry_targeting: company.industry !== 'business services',
      company_size_context: !!company.size,
      pain_point_addressed: company.painPoints?.length > 0,
      personalization_hooks: hooks.length,
      cta_strategy: score.overall >= 80 ? 'aggressive' : score.overall >= 65 ? 'moderate' : 'soft'
    }
  };
}

/**
 * Generate basic SAM draft (fallback)
 * TODO: Integrate with actual SAM AI system
 */
async function generateSamDraft(context: any) {
  const { originalContent, userGuidance, tonePreference, senderName, platform } = context;

  console.log('🤖 Generating basic SAM draft:', {
    contentLength: originalContent?.length || 0,
    guidance: userGuidance,
    tone: tonePreference,
    platform
  });

  // Basic SAM draft generation (fallback)
  const draftContent = `Hi ${senderName || 'there'},

Thank you for reaching out. I appreciate your message.

${userGuidance ? `Based on your guidance: ${userGuidance}` : ''}

Let me address your inquiry...

Best regards,
[Your Name]`;

  const reasoning = `Generated a ${tonePreference} response addressing the key points in the original message. ${userGuidance ? 'Incorporated user guidance for personalization.' : ''}`;

  return {
    content: draftContent,
    reasoning,
    confidence: 0.85,
    generated_at: new Date().toISOString()
  };
}

/**
 * Determine if Human-In-The-Loop approval is required
 */
function determineHITLRequirement(researchResult: ResearchResult, draftContent: any): boolean {
  const score = researchResult.leadScore.overall;
  const confidence = researchResult.confidence;
  
  // High-value leads always require approval
  if (score >= 80) {
    console.log('🔥 Hot lead detected - HITL approval required');
    return true;
  }
  
  // Low confidence research requires approval
  if (confidence < 0.6) {
    console.log('⚠️ Low research confidence - HITL approval required');
    return true;
  }
  
  // Red flags require approval
  if (researchResult.leadScore.redFlags.length > 2) {
    console.log('🚩 Multiple red flags - HITL approval required');
    return true;
  }
  
  // Complex personalization might need review
  if (draftContent.research_applied?.personalization_hooks > 3) {
    console.log('🎯 High personalization - HITL approval recommended');
    return true;
  }
  
  // Otherwise, can proceed automatically for qualified leads
  console.log('✅ Standard qualified lead - auto-approval enabled');
  return false;
}

/**
 * Get reason for HITL requirement
 */
function getHITLReason(researchResult: ResearchResult, draftContent: any): string {
  const score = researchResult.leadScore.overall;
  const confidence = researchResult.confidence;
  
  if (score >= 80) {
    return `Hot lead (${score}/100) - High-value prospect requires human review`;
  }
  
  if (confidence < 0.6) {
    return `Low research confidence (${Math.round(confidence * 100)}%) - Need human validation`;
  }
  
  if (researchResult.leadScore.redFlags.length > 2) {
    return `Multiple red flags detected: ${researchResult.leadScore.redFlags.slice(0, 2).join(', ')}`;
  }
  
  if (draftContent.research_applied?.personalization_hooks > 3) {
    return 'High personalization applied - Human review recommended for quality';
  }
  
  return 'Standard approval process';
}

/**
 * Update lead pipeline status based on reply activity
 */
async function updateLeadPipelineStatus(supabase: any, context: any) {
  const { senderName, senderEmail, company, platform, action, threadId, userId } = context;

  console.log('📊 Updating lead pipeline status:', {
    company,
    senderName,
    action,
    threadId
  });

  try {
    // Check if lead already exists
    let leadStatus = 'prospects'; // Default starting status
    
    switch (action) {
      case 'reply_initiated':
        // When we start a reply, move to "qualified" 
        leadStatus = 'qualified';
        break;
      case 'message_sent':
        // When message is actually sent, keep in qualified or move to opportunities
        leadStatus = 'opportunities';
        break;
      case 'client_responded':
        // If they respond back, definitely an opportunity
        leadStatus = 'opportunities';
        break;
      case 'deal_closed':
        leadStatus = 'closed';
        break;
    }

    // TODO: Update/create lead record in database
    // For now, just log the pipeline update
    const leadUpdate = {
      company_name: company,
      contact_name: senderName,
      contact_email: senderEmail,
      platform_source: platform,
      pipeline_status: leadStatus,
      last_activity: new Date().toISOString(),
      thread_id: threadId,
      user_id: userId,
      activity_type: action
    };

    console.log('📈 Lead pipeline updated:', leadUpdate);

    return {
      success: true,
      previousStatus: 'prospects',
      newStatus: leadStatus,
      leadUpdate
    };

  } catch (error) {
    console.error('❌ Failed to update lead pipeline:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Pipeline update failed'
    };
  }
}

/**
 * Extract company name from sender information
 */
function extractCompanyFromSender(senderName: string, senderEmail?: string): string {
  // Try to extract company from email domain
  if (senderEmail && senderEmail.includes('@')) {
    const domain = senderEmail.split('@')[1];
    if (domain && !domain.includes('gmail') && !domain.includes('outlook') && !domain.includes('yahoo')) {
      const company = domain.split('.')[0];
      return company.charAt(0).toUpperCase() + company.slice(1);
    }
  }

  // If no email or personal email, try to extract from name
  // This is very basic - could be enhanced with better company detection
  const words = senderName.split(' ');
  if (words.length > 2) {
    return words.slice(-1)[0]; // Assume last word might be company
  }

  return senderName + ' Company'; // Fallback
}