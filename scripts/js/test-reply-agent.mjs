#!/usr/bin/env node
/**
 * Test Reply Agent - Sends HITL email to inbox
 * Run: node scripts/js/test-reply-agent.mjs
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// Configuration
const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjQxODQ1NywiZXhwIjoyMDQxOTk0NDU3fQ.p3JfhRUypABG6zhBAf_LnVGN0PBSNYzM7l8KpvVTFq0';
const POSTMARK_API_KEY = process.env.POSTMARK_SERVER_TOKEN || '0fb0b25b-17a6-4e38-926d-d34f5b76f3f4';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const APP_URL = 'https://app.meet-sam.com';
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

// Claude Opus 4.5 model
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// Initialize Anthropic client
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

/**
 * Generate contextual greeting based on current date/time
 * Makes replies feel human without over-personalizing
 */
function getContextualGreeting() {
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Mock prospect data - Toggle between STARTUP and CONSULTANT for testing
const TEST_MODE = 'CONSULTANT'; // Change to 'STARTUP' to test startup tone

const mockProspect = TEST_MODE === 'STARTUP' ? {
  first_name: 'John',
  last_name: 'Smith',
  title: 'VP of Sales',
  company: 'TechStart Inc',
  linkedin_url: 'https://www.linkedin.com/in/johnsmith-sales',
  linkedin_user_id: 'test-sender-123'
} : {
  first_name: 'Sarah',
  last_name: 'Mitchell',
  title: 'Founder & Executive Coach',
  company: 'Mitchell Leadership Group',
  linkedin_url: 'https://www.linkedin.com/in/sarahmitchell-coach',
  linkedin_user_id: 'test-sender-456'
};

// Mock research data
const mockResearch = TEST_MODE === 'STARTUP' ? {
  linkedin: {
    headline: 'VP of Sales at TechStart Inc | B2B SaaS | Revenue Growth',
    summary: 'Passionate about building high-performing sales teams. 15+ years in B2B SaaS.',
    experience: [
      { title: 'VP of Sales', company: 'TechStart Inc', duration: '2 years' },
      { title: 'Sales Director', company: 'DataFlow', duration: '4 years' }
    ],
    recent_posts: ['Excited to announce we hit $5M ARR!', 'Cold outreach is dead - or is it?']
  },
  company: {
    name: 'TechStart Inc',
    size: '50-100 employees',
    industry: 'B2B SaaS',
    description: 'Cloud-based project management for remote teams',
    founded: 2019
  },
  website: 'https://techstartinc.com - Project management platform for distributed teams. Key features: async collaboration, time tracking, resource planning.'
} : {
  linkedin: {
    headline: 'Executive Coach | Helping Leaders Navigate Transitions | ICF PCC',
    summary: '20+ years helping C-suite executives and senior leaders through career transitions, team dynamics, and leadership development. Former Fortune 500 HR executive.',
    experience: [
      { title: 'Founder & Executive Coach', company: 'Mitchell Leadership Group', duration: '8 years' },
      { title: 'VP Human Resources', company: 'Accenture', duration: '12 years' }
    ],
    recent_posts: ['The hardest leadership lesson: knowing when to let go', 'Why most executive coaching fails (and how to fix it)']
  },
  company: {
    name: 'Mitchell Leadership Group',
    size: '1-10 employees',
    industry: 'Executive Coaching & Leadership Development',
    description: 'Boutique executive coaching practice specializing in C-suite transitions and leadership team alignment',
    founded: 2016
  },
  website: 'https://mitchellleadership.com - Executive coaching for leaders in transition. Services: 1:1 coaching, team offsites, leadership assessments. Clients include Fortune 500 executives and fast-growing startups.'
};

// Mock inbound message - also different per type
const mockInboundMessage = TEST_MODE === 'STARTUP' ? {
  id: `test-msg-${Date.now()}`,
  text: "Hey, this looks interesting! We're a SaaS company looking to automate our outbound. What kind of results do your clients typically see?",
  timestamp: new Date().toISOString(),
  sender_id: 'test-sender-123',
  sender_name: 'John Smith',
  is_inbound: true
} : {
  id: `test-msg-${Date.now()}`,
  text: "Thanks for reaching out. I'm always looking for ways to grow my practice without spending all my time on business development. How does this work exactly?",
  timestamp: new Date().toISOString(),
  sender_id: 'test-sender-456',
  sender_name: 'Sarah Mitchell',
  is_inbound: true
};

async function detectIntent(messageText) {
  console.log('Detecting intent...');

  if (!anthropic) {
    console.log('   No ANTHROPIC_API_KEY - using mock intent: QUESTION');
    return 'QUESTION';
  }

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `Classify this prospect reply into one of these intents:
- INTERESTED: They want to learn more, book a call, or try the product
- QUESTION: They're asking about features, pricing, integrations, etc.
- OBJECTION: They have concerns or pushback
- TIMING: Not now, maybe later
- NOT_INTERESTED: Clear rejection
- VAGUE_POSITIVE: Thumbs up, thanks, etc.
- UNCLEAR: Cannot determine intent

Prospect reply: "${messageText}"

Respond with just the intent category.`
        }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const intent = textBlock?.text?.trim().toUpperCase().replace(/[^A-Z_]/g, '') || 'UNCLEAR';
    console.log(`   Detected intent: ${intent}`);
    return intent;
  } catch (error) {
    console.error('   Intent detection error:', error.message);
    return 'QUESTION';
  }
}

async function generateReply(messageText, prospect, research, intent) {
  console.log('Generating AI reply...');

  if (!anthropic) {
    console.log('   No ANTHROPIC_API_KEY - using mock reply');
    return `Hi ${prospect.first_name},

Great question! Our clients typically see 3-5x response rates compared to traditional cold outreach. Given that TechStart is growing fast in the B2B SaaS space, I think you'd find our AI-powered personalization particularly valuable.

I noticed you recently hit $5M ARR - congrats! At that stage, scaling outbound efficiently becomes crucial.

Would a 15-minute call this week work to show you some specific results from similar companies?`;
  }

  try {
    // Get contextual greeting (Happy Friday, Hope you had a great Thanksgiving, etc.)
    const contextGreeting = getContextualGreeting();

    const systemPrompt = `You are a sales rep for SAM AI, an AI-powered LinkedIn outreach automation platform.

## STEP 0: ADD A HUMAN TOUCH (IF APPROPRIATE)
${contextGreeting ? `
Today's contextual greeting: "${contextGreeting}"

You may optionally START your reply with this greeting if it feels natural. Don't force it if the prospect's message is urgent or business-focused. Use your judgment.
` : `
No special greeting needed today - just dive into your response naturally.
`}

## STEP 1: UNDERSTAND WHO YOU'RE TALKING TO

**Their company:** ${research.company.name}
**Industry:** ${research.company.industry}
**What they do:** ${research.company.description}
**Size:** ${research.company.size}
**Website:** ${research.website}

**Their LinkedIn:**
${JSON.stringify(research.linkedin, null, 2)}

## STEP 2: ADAPT YOUR TONE TO THEIR WORLD

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

## STEP 3: WHAT SAM DOES FOR THEM

SAM AI automates personalized LinkedIn outreach:
- Reach more prospects without hiring
- AI writes personalized messages based on research
- Handles follow-ups automatically
- Tracks engagement and replies

## RESPONSE RULES

1. START by referencing something SPECIFIC about their business/approach
2. Connect to a SAM benefit that makes sense for THEIR world
3. Keep it SHORT (3-4 sentences max)
4. End with simple CTA

## UNIVERSAL TONE RULES

- Sound human, not templated
- NO corporate buzzwords (leverage, synergy, robust, cutting-edge)
- NO fake enthusiasm ("Thanks so much!", "Love what you're doing!")
- NO "bodies" or "headcount" language for professional services
- Match their level of formality

## EXAMPLES BY TYPE:

**Startup (casual):**
"Hey John - took a look at TechStart's PM tool. Smart how you built async for remote teams. Guessing scaling outbound is next? SAM handles the LinkedIn reach so your team focuses on closing. Quick 15 min to show you how?"

**Consultant (peer-level):**
"John - I looked at your advisory practice around digital transformation. Curious how you're currently reaching new clients. SAM helps consultants like yourself maintain consistent outreach without it eating into billable hours. Worth a conversation?"

**Coach (warm, outcomes):**
"John - saw your work helping executives with leadership transitions. Powerful stuff. Many coaches we work with struggle to find time for business development while serving clients. SAM keeps the pipeline warm so you can focus on transformations. Interested in seeing how?"

**SME (clear value):**
"John - I looked at TechStart's services. Impressive client list. Wondering if growing your sales pipeline is on the radar. SAM automates LinkedIn outreach so you reach more prospects without adding staff. Happy to show you how it works."`;

    const userPrompt = `Generate a highly personalized reply to this prospect.

PROSPECT:
- Name: ${prospect.first_name} ${prospect.last_name}
- Title: ${prospect.title}
- Company: ${prospect.company}

THEIR MESSAGE: "${messageText}"

DETECTED INTENT: ${intent}

IMPORTANT: Your reply MUST mention something specific about their company/product that shows you researched them. No generic responses.

Reply:`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const reply = textBlock?.text?.trim() || '';
    console.log('   Generated reply');
    return reply;
  } catch (error) {
    console.error('   Reply generation error:', error.message);
    return `Hi ${prospect.first_name}, thanks for reaching out! I would love to discuss how SAM AI can help TechStart scale your outbound. Would you have time for a quick call this week?`;
  }
}

async function saveDraft(draft) {
  console.log('Saving draft to database...');

  const { data, error } = await supabase
    .from('reply_agent_drafts')
    .insert(draft)
    .select()
    .single();

  if (error) {
    console.error('   Save error:', error.message);
    throw error;
  }

  console.log(`   Draft saved: ${data.id}`);
  return data;
}

async function sendHITLEmail(draft, prospect, inboundText) {
  console.log('Sending HITL email via Postmark...');

  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('role', 'owner')
    .limit(1);

  if (!members?.length) {
    throw new Error('No workspace owner found');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('email')
    .eq('id', members[0].user_id)
    .single();

  let ownerEmail = userData?.email;

  if (!ownerEmail) {
    const { data: authUser } = await supabase.auth.admin.getUserById(members[0].user_id);
    ownerEmail = authUser?.user?.email;
  }

  if (!ownerEmail) {
    throw new Error('No owner email found');
  }

  console.log(`   Sending to: ${ownerEmail}`);

  const approveUrl = `${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=approve`;
  const rejectUrl = `${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=reject`;

  const emailBody = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .message-box { background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #667eea; }
    .draft-box { background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #10b981; }
    .research-box { background: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #f59e0b; }
    .button { display: inline-block; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 8px 8px 8px 0; }
    .approve { background: #10b981; color: white; }
    .reject { background: #ef4444; color: white; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .intent { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">New Reply Needs Approval</h2>
      <p style="margin:8px 0 0 0; opacity:0.9;">${prospect.first_name || 'A prospect'} replied to your campaign</p>
    </div>
    <div class="content">
      <p><strong>From:</strong> ${draft.prospect_name || 'Unknown'}</p>
      <p><strong>Title:</strong> ${prospect.title || 'Unknown'}</p>
      <p><strong>Company:</strong> ${draft.prospect_company || 'Unknown'}</p>
      <p><strong>Intent:</strong> <span class="intent">${draft.intent_detected || 'UNCLEAR'}</span></p>

      <h3>Their Message:</h3>
      <div class="message-box">${inboundText}</div>

      <h3>Research Summary:</h3>
      <div class="research-box">
        <p><strong>LinkedIn:</strong> ${draft.research_linkedin_profile?.headline || 'N/A'}</p>
        <p><strong>Company:</strong> ${draft.research_company_profile?.name || 'N/A'} - ${draft.research_company_profile?.industry || 'N/A'}</p>
        <p><strong>Website:</strong> ${draft.research_website || 'N/A'}</p>
      </div>

      <h3>SAM Draft Reply:</h3>
      <div class="draft-box">${draft.draft_text.replace(/\n/g, '<br>')}</div>

      <div style="margin-top: 24px;">
        <a href="${approveUrl}" class="button approve">Approve and Send</a>
        <a href="${rejectUrl}" class="button reject">Reject</a>
      </div>

      <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">This draft will expire in 48 hours if not actioned.</p>
    </div>
    <div class="footer">
      <p>Sent by SAM AI - <a href="${APP_URL}">app.meet-sam.com</a></p>
      <p style="font-size: 10px; color: #9ca3af;">Test email generated at ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>`;

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
      Subject: `[TEST] ${draft.prospect_name || 'Prospect'} replied - Review SAM draft`,
      HtmlBody: emailBody,
      TextBody: `New reply from ${draft.prospect_name}:\n\n"${inboundText}"\n\nSAM draft reply:\n\n"${draft.draft_text}"\n\nApprove: ${approveUrl}\nReject: ${rejectUrl}`,
      MessageStream: 'outbound'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Postmark error: ${errorText}`);
  }

  const result = await response.json();
  console.log(`   Email sent! MessageID: ${result.MessageID}`);
  return result;
}

async function main() {
  console.log('============================================================');
  console.log('Reply Agent Test - HITL Email Demo');
  console.log('============================================================');
  console.log(`Workspace: ${WORKSPACE_ID}`);
  console.log(`App URL: ${APP_URL}`);
  console.log('');

  try {
    const intent = await detectIntent(mockInboundMessage.text);
    const replyText = await generateReply(mockInboundMessage.text, mockProspect, mockResearch, intent);

    console.log('');
    console.log('Generated Reply:');
    console.log('----------------------------------------');
    console.log(replyText);
    console.log('----------------------------------------');
    console.log('');

    const draftData = {
      workspace_id: WORKSPACE_ID,
      campaign_id: null,
      prospect_id: null,
      inbound_message_id: mockInboundMessage.id,
      inbound_message_text: mockInboundMessage.text,
      inbound_message_at: mockInboundMessage.timestamp,
      channel: 'linkedin',
      prospect_name: `${mockProspect.first_name} ${mockProspect.last_name}`,
      prospect_linkedin_url: mockProspect.linkedin_url,
      prospect_company: mockProspect.company,
      prospect_title: mockProspect.title,
      draft_text: replyText,
      intent_detected: intent,
      ai_model: 'claude-opus-4-5-20251101',
      research_linkedin_profile: mockResearch.linkedin,
      research_company_profile: mockResearch.company,
      research_website: mockResearch.website,
      status: 'pending_approval'
    };

    const savedDraft = await saveDraft(draftData);
    await sendHITLEmail(savedDraft, mockProspect, mockInboundMessage.text);

    console.log('');
    console.log('============================================================');
    console.log('TEST COMPLETE');
    console.log('============================================================');
    console.log('');
    console.log('Check your inbox for the HITL approval email!');
    console.log('');
    console.log('Draft Details:');
    console.log(`  ID: ${savedDraft.id}`);
    console.log(`  Token: ${savedDraft.approval_token}`);
    console.log(`  Intent: ${savedDraft.intent_detected}`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
