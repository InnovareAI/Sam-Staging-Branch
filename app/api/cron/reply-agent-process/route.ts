import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { getClaudeClient } from '@/lib/llm/claude-client';
import { sendReplyAgentHITLNotification } from '@/lib/notifications/google-chat';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || '792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0';
const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const POSTMARK_API_KEY = process.env.POSTMARK_SERVER_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

interface UnipileMessage {
  id: string;
  text: string;
  timestamp: string;
  sender_id: string;
  sender_name?: string;
  is_inbound: boolean;
}

/**
 * Generate contextual greeting based on current date/time
 * Makes replies feel human without over-personalizing
 */
function getContextualGreeting(): string | null {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 5 = Friday
  const month = now.getMonth(); // 0 = Jan, 11 = Dec
  const date = now.getDate();
  const hour = now.getHours();

  // Check for holidays (US-centric)
  // Thanksgiving: 4th Thursday of November
  if (month === 10) { // November
    const firstThursday = new Date(now.getFullYear(), 10, 1);
    while (firstThursday.getDay() !== 4) firstThursday.setDate(firstThursday.getDate() + 1);
    const thanksgiving = firstThursday.getDate() + 21; // 4th Thursday

    if (date >= thanksgiving && date <= thanksgiving + 4) {
      return "Hope you had a great Thanksgiving!";
    }
    if (date >= thanksgiving - 7 && date < thanksgiving) {
      return "Hope you have a great Thanksgiving week!";
    }
  }

  // Christmas/New Year period
  if (month === 11 && date >= 20) {
    if (date >= 26) return "Hope you're enjoying the holiday week!";
    return "Hope you have a great holiday season!";
  }
  if (month === 0 && date <= 5) {
    return "Happy New Year!";
  }

  // Day of week greetings
  if (day === 1) return "Hope your Monday is off to a good start!";
  if (day === 5) return "Happy Friday!";

  // Time-based for other days
  if (hour < 12) return "Hope your morning is going well!";
  if (hour >= 12 && hour < 17) return "Hope your afternoon is going well!";

  // Default - no greeting (some messages don't need one)
  return null;
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('x-cron-secret');
  if (authHeader !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const results: any[] = [];

  try {
    // PHASE 1: Process existing pending_generation drafts (created by poll-message-replies)
    // These drafts already have the inbound message - we just need to generate AI reply
    const pendingGenerationResults = await processPendingGenerationDrafts(supabase);
    results.push(...pendingGenerationResults);

    // PHASE 2: Get all workspaces with Reply Agent enabled
    const { data: enabledConfigs, error: configError } = await supabase
      .from('workspace_reply_agent_config')
      .select('*, workspaces(id, name)')
      .eq('enabled', true);

    if (configError || !enabledConfigs?.length) {
      return NextResponse.json({
        message: 'No workspaces with Reply Agent enabled',
        processed: 0
      });
    }

    for (const config of enabledConfigs) {
      const workspaceId = config.workspace_id;

      // 2. Get active campaigns for this workspace
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, campaign_name')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

      if (!campaigns?.length) continue;

      // 3. Get prospects who have been contacted (might reply)
      const campaignIds = campaigns.map(c => c.id);
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('*, campaigns(campaign_name)')
        .in('campaign_id', campaignIds)
        .in('status', ['connection_request_sent', 'connected', 'message_sent', 'followed_up']);

      if (!prospects?.length) continue;

      // 4. Get LinkedIn account for this workspace
      const { data: linkedinAccount } = await supabase
        .from('campaign_linkedin_accounts')
        .select('unipile_account_id')
        .in('campaign_id', campaignIds)
        .limit(1)
        .single();

      if (!linkedinAccount?.unipile_account_id) continue;

      // 5. Check for new messages from Unipile
      for (const prospect of prospects) {
        if (!prospect.linkedin_user_id) continue;

        try {
          // Check if we already processed this prospect recently
          const { data: existingDraft } = await supabase
            .from('reply_agent_drafts')
            .select('id')
            .eq('prospect_id', prospect.id)
            .eq('status', 'pending_approval')
            .single();

          if (existingDraft) continue; // Already have pending draft

          // Fetch recent messages from Unipile
          const messagesResponse = await fetch(
            `https://${UNIPILE_DSN}/api/v1/messages?account_id=${linkedinAccount.unipile_account_id}&attendee_id=${prospect.linkedin_user_id}&limit=5`,
            {
              headers: {
                'X-API-KEY': UNIPILE_API_KEY!,
                'Accept': 'application/json'
              }
            }
          );

          if (!messagesResponse.ok) continue;

          const messagesData = await messagesResponse.json();
          const messages: UnipileMessage[] = messagesData.items || [];

          // Find unprocessed inbound messages
          const inboundMessages = messages.filter(m => m.is_inbound);
          if (!inboundMessages.length) continue;

          const latestInbound = inboundMessages[0];

          // Check if we already processed this message
          const { data: processedMessage } = await supabase
            .from('reply_agent_drafts')
            .select('id')
            .eq('inbound_message_id', latestInbound.id)
            .single();

          if (processedMessage) continue; // Already processed

          // 6. Generate AI reply
          const draft = await generateAIReply(
            latestInbound,
            prospect,
            config,
            supabase
          );

          if (!draft) continue;

          // 7. Save draft to database
          const { data: savedDraft, error: saveError } = await supabase
            .from('reply_agent_drafts')
            .insert({
              workspace_id: workspaceId,
              campaign_id: prospect.campaign_id,
              prospect_id: prospect.id,
              inbound_message_id: latestInbound.id,
              inbound_message_text: latestInbound.text,
              inbound_message_at: latestInbound.timestamp,
              channel: 'linkedin',
              prospect_name: prospect.first_name ? `${prospect.first_name} ${prospect.last_name || ''}`.trim() : latestInbound.sender_name,
              prospect_linkedin_url: prospect.linkedin_url,
              prospect_company: prospect.company,
              prospect_title: prospect.title,
              draft_text: draft.text,
              intent_detected: draft.intent,
              ai_model: config.ai_model || 'claude-opus-4-5-20251101',
              research_linkedin_profile: draft.research?.linkedin,
              research_company_profile: draft.research?.company,
            })
            .select()
            .single();

          if (saveError) {
            console.error('Error saving draft:', saveError);
            continue;
          }

          // 8. Send HITL email via Postmark (if manual approval mode)
          if (config.approval_mode === 'manual') {
            await sendHITLEmail(savedDraft, config, prospect, latestInbound.text, supabase);
          } else {
            // Auto-approve mode - send immediately
            await autoSendReply(savedDraft, linkedinAccount.unipile_account_id, supabase);
          }

          results.push({
            workspace_id: workspaceId,
            prospect: prospect.first_name,
            draft_id: savedDraft.id,
            mode: config.approval_mode
          });

        } catch (prospectError) {
          console.error(`Error processing prospect ${prospect.id}:`, prospectError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      drafts: results
    });

  } catch (error) {
    console.error('Reply Agent cron error:', error);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}

async function generateAIReply(
  inboundMessage: UnipileMessage,
  prospect: any,
  config: any,
  supabase: any
): Promise<{ text: string; intent: string; research?: any } | null> {
  try {
    const claude = getClaudeClient();

    // Detect intent first
    const intentPrompt = `Classify this prospect reply into one of these intents:
- INTERESTED: They want to learn more, book a call, or try the product
- QUESTION: They're asking about features, pricing, integrations, etc.
- OBJECTION: They have concerns or pushback
- TIMING: Not now, maybe later
- NOT_INTERESTED: Clear rejection
- VAGUE_POSITIVE: Thumbs up, thanks, etc.
- UNCLEAR: Can't determine intent

Prospect reply: "${inboundMessage.text}"

Respond with just the intent category (e.g., "INTERESTED").`;

    const intentResponse = await claude.complete(intentPrompt, {
      maxTokens: 50,
      temperature: 0
    });
    const intent = intentResponse.trim().toUpperCase().replace(/[^A-Z_]/g, '');

    // If not interested, don't generate a reply
    if (intent === 'NOT_INTERESTED') {
      return { text: '', intent, research: null };
    }

    // Build context for reply generation
    const prospectName = `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim();
    const prospectCompany = prospect.company_name || prospect.company || 'Unknown';
    const prospectTitle = prospect.title || 'Unknown';

    // Fetch research data if we have LinkedIn URL
    let research: { linkedin?: any; company?: any } | null = null;
    if (prospect.linkedin_url) {
      try {
        const researchResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/sam/prospect-intelligence`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'linkedin_url_research',
              data: { url: prospect.linkedin_url },
              user_id: 'system' // Server-to-server auth
            })
          }
        );
        if (researchResponse.ok) {
          const researchData = await researchResponse.json();
          if (researchData.success && researchData.data) {
            research = {
              linkedin: researchData.data.prospect,
              company: researchData.data.insights?.company
            };
            console.log(`   📊 Research fetched for ${prospectName}`);
          }
        }
      } catch (researchError) {
        console.log(`   ⚠️ Research fetch failed for ${prospectName}:`, researchError);
        // Continue without research - it's optional
      }
    }

    // Get contextual greeting (Happy Friday, Hope you had a great Thanksgiving, etc.)
    const contextGreeting = getContextualGreeting();

    // Use custom guidelines if set, otherwise use default industry-adaptive prompt
    const systemPrompt = config.reply_guidelines || `You are a sales rep for SAM AI, an AI-powered LinkedIn outreach automation platform.

## ADD A HUMAN TOUCH (IF APPROPRIATE)
${contextGreeting ? `
Today's contextual greeting: "${contextGreeting}"

You may optionally START your reply with this greeting if it feels natural. Don't force it if the prospect's message is urgent or business-focused. Use your judgment.
` : `
No special greeting needed today - just dive into your response naturally.
`}

## WHO YOU'RE TALKING TO

**Name:** ${prospectName}
**Title:** ${prospectTitle}
**Company:** ${prospectCompany}

## ADAPT YOUR TONE TO THEIR WORLD

Match your language to their industry and company type:

| Industry/Type | Tone | Language Style |
|---------------|------|----------------|
| **Tech/SaaS Startup** | Casual, direct | "Hey", short sentences, no fluff |
| **Consulting/Advisory** | Professional, peer-level | Speak as equals, reference methodology |
| **Coaching/Training** | Warm, outcomes-focused | Focus on client transformation |
| **SME/Traditional** | Respectful, clear value | No jargon, concrete benefits |
| **Enterprise** | Polished, strategic | Business impact, ROI language |
| **Solo/Founder** | Personal, time-aware | Respect their bandwidth |
| **Agency** | Creative, results-driven | Portfolio thinking, client wins |

## WHAT SAM DOES FOR THEM

SAM AI automates personalized LinkedIn outreach:
- Reach more prospects without additional staff
- AI writes personalized messages based on research
- Handles follow-ups automatically
- Tracks engagement and replies

## RESPONSE RULES

1. Reference something SPECIFIC about their business/role
2. Connect to a SAM benefit that makes sense for THEIR world
3. Keep it SHORT (3-4 sentences max)
4. End with simple CTA

## UNIVERSAL TONE RULES

- Sound human, not templated
- NO corporate buzzwords (leverage, synergy, robust)
- NO fake enthusiasm ("Thanks so much!", "Love what you're doing!")
- NO "bodies" or "headcount" language for professional services
- Match their level of formality

## EXAMPLES BY TYPE:

**Startup:** "Hey ${prospect.first_name} - scaling outbound at ${prospectCompany}? That's what we built SAM for. Quick 15 min to show you how?"

**Consultant:** "${prospect.first_name} - curious how you're currently reaching new clients. SAM helps consultants maintain consistent outreach without eating billable hours. Worth a conversation?"

**Coach:** "${prospect.first_name} - many coaches we work with struggle to find time for business development. SAM keeps the pipeline warm so you can focus on clients. Interested?"

**SME:** "${prospect.first_name} - wondering if growing your sales pipeline is on the radar. SAM automates LinkedIn outreach so you reach more prospects without adding staff. Happy to show you."`;

    // Build research context if available
    let researchContext = '';
    if (research?.linkedin) {
      researchContext += `\n## LINKEDIN RESEARCH:
- Headline: ${research.linkedin.headline || 'N/A'}
- Summary: ${research.linkedin.summary || 'N/A'}
- Recent Activity: ${research.linkedin.recentPosts?.slice(0, 2).join(', ') || 'N/A'}`;
    }
    if (research?.company) {
      researchContext += `\n## COMPANY RESEARCH:
- Industry: ${research.company.industry || 'N/A'}
- Size: ${research.company.size || 'N/A'}
- Description: ${research.company.description || 'N/A'}`;
    }

    const userPrompt = `Generate a highly personalized reply to this prospect.

PROSPECT:
- Name: ${prospectName}
- Title: ${prospectTitle}
- Company: ${prospectCompany}
${researchContext}

THEIR MESSAGE: "${inboundMessage.text}"

DETECTED INTENT: ${intent}

IMPORTANT: Sound human and conversational. Reference specific details from their profile/company if research is available. No generic responses.

Reply:`;

    const replyResponse = await claude.complete(userPrompt, {
      system: systemPrompt,
      maxTokens: 300,
      temperature: 0.7
    });

    return {
      text: replyResponse.trim(),
      intent,
      research
    };

  } catch (error) {
    console.error('Error generating AI reply:', error);
    return null;
  }
}

async function sendHITLEmail(
  draft: any,
  config: any,
  prospect: any,
  inboundText: string,
  supabase: any
): Promise<void> {
  if (!POSTMARK_API_KEY) {
    console.error('POSTMARK_API_KEY not configured');
    return;
  }

  try {
    // Get workspace owner's email
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, users(email)')
      .eq('workspace_id', draft.workspace_id)
      .eq('role', 'owner')
      .limit(1);

    const ownerEmail = members?.[0]?.users?.email;
    if (!ownerEmail) {
      console.error('No owner email found for workspace');
      return;
    }

    const approveUrl = `${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=approve`;
    const rejectUrl = `${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=reject`;
    const editUrl = `${APP_URL}/reply-agent/edit?id=${draft.id}&token=${draft.approval_token}`;
    const instructionsUrl = `${APP_URL}/reply-agent/instructions?id=${draft.id}&token=${draft.approval_token}`;

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .message-box { background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #667eea; }
    .draft-box { background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #10b981; }
    .button { display: inline-block; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 8px 8px 8px 0; }
    .approve { background: #10b981; color: white; }
    .reject { background: #ef4444; color: white; }
    .edit { background: #6b7280; color: white; }
    .instructions { background: #7c3aed; color: white; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .intent { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">📬 New Reply Needs Approval</h2>
      <p style="margin:8px 0 0 0; opacity:0.9;">${prospect.first_name || 'A prospect'} replied to your campaign</p>
    </div>
    <div class="content">
      <p><strong>From:</strong> ${draft.prospect_name || 'Unknown'}</p>
      <p><strong>Company:</strong> ${draft.prospect_company || 'Unknown'}</p>
      <p><strong>Intent:</strong> <span class="intent">${draft.intent_detected || 'UNCLEAR'}</span></p>

      <h3>Their Message:</h3>
      <div class="message-box">
        ${inboundText}
      </div>

      <h3>SAM's Draft Reply:</h3>
      <div class="draft-box">
        ${draft.draft_text}
      </div>

      <div style="margin-top: 24px;">
        <a href="${approveUrl}" class="button approve">✓ Approve & Send</a>
        <a href="${rejectUrl}" class="button reject">✗ Reject</a>
      </div>
      <div style="margin-top: 12px;">
        <a href="${editUrl}" class="button edit">✏️ Edit Reply</a>
        <a href="${instructionsUrl}" class="button instructions">💬 Add Instructions</a>
      </div>

      <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
        This draft will expire in 48 hours if not actioned.
      </p>
    </div>
    <div class="footer">
      <p>Sent by SAM AI • <a href="${APP_URL}">app.meet-sam.com</a></p>
    </div>
  </div>
</body>
</html>
`;

    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_API_KEY
      },
      body: JSON.stringify({
        From: 'sam@innovareai.com',
        To: ownerEmail,
        Subject: `📬 ${draft.prospect_name || 'Prospect'} replied - Review SAM's draft`,
        HtmlBody: emailBody,
        TextBody: `New reply from ${draft.prospect_name}:\n\n"${inboundText}"\n\nSAM's draft reply:\n\n"${draft.draft_text}"\n\nApprove: ${approveUrl}\nReject: ${rejectUrl}\n\nEdit Reply: ${editUrl}\nAdd Instructions: ${instructionsUrl}`,
        MessageStream: 'outbound'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Postmark error:', error);
    }

    // Only send to Google Chat if workspace has chat channel enabled (enterprise feature)
    const notificationChannels = config.notification_channels || ['email'];
    if (notificationChannels.includes('chat')) {
      await sendReplyAgentHITLNotification({
        draftId: draft.id,
        approvalToken: draft.approval_token,
        prospectName: draft.prospect_name || 'Unknown',
        prospectTitle: prospect.title,
        prospectCompany: draft.prospect_company,
        inboundMessage: inboundText,
        draftReply: draft.draft_text,
        intent: draft.intent_detected || 'UNCLEAR',
        appUrl: APP_URL,
      });
    }

  } catch (error) {
    console.error('Error sending HITL email:', error);
  }
}

async function autoSendReply(
  draft: any,
  accountId: string,
  supabase: any
): Promise<void> {
  // TODO: Implement auto-send via Unipile
  // For now, just mark as approved
  await supabase
    .from('reply_agent_drafts')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString()
    })
    .eq('id', draft.id);
}

/**
 * Process drafts created by poll-message-replies with status 'pending_generation'
 * These drafts already have the inbound message but need AI reply generation
 */
async function processPendingGenerationDrafts(supabase: any): Promise<any[]> {
  const results: any[] = [];

  try {
    // Get all drafts awaiting AI generation
    const { data: pendingDrafts, error: draftsError } = await supabase
      .from('reply_agent_drafts')
      .select('*, campaigns(campaign_name)')
      .eq('status', 'pending_generation')
      .limit(20); // Process max 20 per run

    if (draftsError || !pendingDrafts?.length) {
      return results;
    }

    console.log(`📝 Processing ${pendingDrafts.length} pending_generation drafts...`);

    for (const draft of pendingDrafts) {
      try {
        // Get workspace config
        const { data: config } = await supabase
          .from('workspace_reply_agent_config')
          .select('*')
          .eq('workspace_id', draft.workspace_id)
          .eq('enabled', true)
          .single();

        if (!config) {
          // Reply Agent disabled - mark draft as skipped
          await supabase
            .from('reply_agent_drafts')
            .update({ status: 'skipped', updated_at: new Date().toISOString() })
            .eq('id', draft.id);
          continue;
        }

        // Get prospect details
        const { data: prospect } = await supabase
          .from('campaign_prospects')
          .select('*')
          .eq('id', draft.prospect_id)
          .single();

        if (!prospect) {
          await supabase
            .from('reply_agent_drafts')
            .update({ status: 'error', error_message: 'Prospect not found', updated_at: new Date().toISOString() })
            .eq('id', draft.id);
          continue;
        }

        // Generate AI reply using the inbound message stored in draft
        const inboundMessage: UnipileMessage = {
          id: draft.inbound_message_id,
          text: draft.inbound_message_text,
          timestamp: draft.inbound_message_at,
          sender_id: prospect.linkedin_user_id || '',
          sender_name: draft.prospect_name,
          is_inbound: true
        };

        const aiReply = await generateAIReply(inboundMessage, prospect, config, supabase);

        if (!aiReply) {
          await supabase
            .from('reply_agent_drafts')
            .update({ status: 'error', error_message: 'AI generation failed', updated_at: new Date().toISOString() })
            .eq('id', draft.id);
          continue;
        }

        // Update draft with AI reply
        const { error: updateError } = await supabase
          .from('reply_agent_drafts')
          .update({
            draft_text: aiReply.text,
            intent_detected: aiReply.intent,
            ai_model: config.ai_model || 'claude-opus-4-5-20251101',
            status: 'pending_approval',
            updated_at: new Date().toISOString()
          })
          .eq('id', draft.id);

        if (updateError) {
          console.error(`Error updating draft ${draft.id}:`, updateError);
          continue;
        }

        // Get updated draft with all fields
        const { data: updatedDraft } = await supabase
          .from('reply_agent_drafts')
          .select('*')
          .eq('id', draft.id)
          .single();

        // Send HITL notification
        if (config.approval_mode === 'manual') {
          await sendHITLEmail(updatedDraft, config, prospect, draft.inbound_message_text, supabase);
          console.log(`✅ Draft ${draft.id} processed - HITL notification sent`);
        } else {
          // Get LinkedIn account for auto-send
          const { data: linkedinAccount } = await supabase
            .from('campaign_linkedin_accounts')
            .select('unipile_account_id')
            .eq('campaign_id', draft.campaign_id)
            .single();

          if (linkedinAccount?.unipile_account_id) {
            await autoSendReply(updatedDraft, linkedinAccount.unipile_account_id, supabase);
            console.log(`✅ Draft ${draft.id} auto-approved`);
          }
        }

        results.push({
          source: 'pending_generation',
          draft_id: draft.id,
          prospect: draft.prospect_name,
          intent: aiReply.intent,
          mode: config.approval_mode
        });

      } catch (draftError) {
        console.error(`Error processing draft ${draft.id}:`, draftError);
        await supabase
          .from('reply_agent_drafts')
          .update({ status: 'error', error_message: String(draftError), updated_at: new Date().toISOString() })
          .eq('id', draft.id);
      }
    }

  } catch (error) {
    console.error('Error in processPendingGenerationDrafts:', error);
  }

  return results;
}
