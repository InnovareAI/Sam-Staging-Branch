/**
 * Reply Draft Generator - Full System Prompt Implementation
 * Based on Reply Agent Spec with "Cheese Filter" and intent-specific handling
 * Enhanced with Opus 4.5 prospect research for deep personalization
 */

import { classifyIntent, ReplyIntent, IntentClassification } from './intent-classifier';
import { researchProspect, formatResearchForPrompt, ProspectResearch } from './prospect-researcher';

export interface ReplyAgentSettings {
  enabled?: boolean;
  sam_description?: string;
  sam_differentiators?: string;
  ideal_customer?: string;
  objection_handling?: Array<{ objection: string; response: string }>;
  proof_points?: string;
  pricing_guidance?: string;
  voice_reference?: string;
  tone_of_voice?: string;
  writing_style?: string;
  dos_and_donts?: string;
  default_cta?: string;
  calendar_link?: string;
  pushiness_level?: 'soft' | 'balanced' | 'direct';
  handle_not_interested?: string;
  handle_pricing?: string;
  system_prompt_override?: string;
  // Research settings
  enable_research?: boolean;
  research_depth?: 'quick' | 'standard' | 'deep';
}

export interface DraftContext {
  prospectReply: string;
  prospect: {
    name: string;
    role?: string;
    company?: string;
    industry?: string;
    companySize?: string;
    crmContext?: string;
    linkedInUrl?: string;
    companyLinkedInUrl?: string;
    websiteUrl?: string;
  };
  campaign: {
    name: string;
    channel: 'linkedin' | 'email';
    goal?: string;
    originalOutreach?: string;
  };
  userName: string;
  settings: ReplyAgentSettings;
}

export interface GeneratedDraft {
  intent: IntentClassification;
  draft: string;
  research?: ProspectResearch;
  metadata: {
    model: string;
    tokensUsed: number;
    generationTimeMs: number;
    cheeseFilterPassed: boolean;
    researchTimeMs?: number;
    researchEnabled: boolean;
    icpFitScore?: number;
  };
}

/**
 * Generate a reply draft with full spec implementation
 * Now includes Opus 4.5 prospect research for deep personalization
 */
export async function generateReplyDraft(context: DraftContext): Promise<GeneratedDraft> {
  const startTime = Date.now();
  let researchTimeMs = 0;
  let research: ProspectResearch | undefined;

  // Step 0: Research prospect if enabled (uses Opus 4.5)
  const enableResearch = context.settings.enable_research !== false; // Default to enabled
  if (enableResearch) {
    const researchStart = Date.now();
    console.log('🔬 Researching prospect with Opus 4.5...');
    research = await researchProspect({
      prospectName: context.prospect.name,
      prospectTitle: context.prospect.role,
      prospectCompany: context.prospect.company,
      linkedInUrl: context.prospect.linkedInUrl,
      companyLinkedInUrl: context.prospect.companyLinkedInUrl,
      websiteUrl: context.prospect.websiteUrl,
      prospectReply: context.prospectReply,
      originalOutreach: context.campaign.originalOutreach
    });
    researchTimeMs = Date.now() - researchStart;
    console.log(`✅ Research complete in ${researchTimeMs}ms - ICP Fit: ${research.icpAnalysis?.fitScore || 'N/A'}%`);
  }

  // Step 1: Classify intent
  console.log('🎯 Classifying intent...');
  const intent = await classifyIntent(context.prospectReply, {
    originalOutreach: context.campaign.originalOutreach,
    prospectName: context.prospect.name,
    prospectCompany: context.prospect.company
  });
  console.log(`✅ Intent: ${intent.intent} (${(intent.confidence * 100).toFixed(0)}% confidence)`);

  // Step 2: Build system prompt (now includes research context)
  const systemPrompt = buildSystemPrompt(context, intent, research);

  // Step 3: Generate draft
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
      'X-Title': 'SAM AI - Reply Draft Generator'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4', // Can upgrade to Opus for complex cases
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a reply to this message:\n\n"${context.prospectReply}"` }
      ],
      max_tokens: 400,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  let draft = data.choices[0]?.message?.content?.trim() || '';

  // Step 4: Run Cheese Filter
  const cheeseFilterResult = runCheeseFilter(draft);
  if (!cheeseFilterResult.passed) {
    console.log('🧀 Cheese filter triggered, regenerating...');
    // Regenerate with stricter prompt
    const stricterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
        'X-Title': 'SAM AI - Reply Draft Generator (Strict)'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          { role: 'system', content: systemPrompt + CHEESE_FILTER_ADDENDUM },
          { role: 'user', content: `Generate a reply to this message. Your previous draft was rejected for being too salesy: "${cheeseFilterResult.triggers.join(', ')}". Write something more natural.\n\nProspect's message: "${context.prospectReply}"` }
        ],
        max_tokens: 400,
        temperature: 0.8
      })
    });

    if (stricterResponse.ok) {
      const stricterData = await stricterResponse.json();
      draft = stricterData.choices[0]?.message?.content?.trim() || draft;
    }
  }

  const generationTime = Date.now() - startTime;

  return {
    intent,
    draft,
    research,
    metadata: {
      model: 'claude-sonnet-4',
      tokensUsed: data.usage?.total_tokens || 0,
      generationTimeMs: generationTime,
      cheeseFilterPassed: cheeseFilterResult.passed,
      researchTimeMs: enableResearch ? researchTimeMs : undefined,
      researchEnabled: enableResearch,
      icpFitScore: research?.icpAnalysis?.fitScore
    }
  };
}

/**
 * Build the full system prompt based on context, settings, and research
 */
function buildSystemPrompt(context: DraftContext, intent: IntentClassification, research?: ProspectResearch): string {
  const { settings, prospect, campaign, userName } = context;

  // Format research insights for inclusion in prompt
  const researchContext = research ? formatResearchForPrompt(research) : '';

  // Check for system prompt override
  if (settings.system_prompt_override) {
    return settings.system_prompt_override
      .replace(/\{\{user_name\}\}/g, userName)
      .replace(/\{\{prospect_name\}\}/g, prospect.name)
      .replace(/\{\{prospect_company\}\}/g, prospect.company || 'their company')
      .replace(/\{\{campaign_name\}\}/g, campaign.name)
      .replace(/\{\{intent\}\}/g, intent.intent);
  }

  return `You are ${userName}, replying to inbound responses from ${campaign.channel === 'linkedin' ? 'LinkedIn' : 'cold email'} outreach campaigns for SAM, an AI-as-a-Service sales automation platform.

You are not a sales bot. You are a founder/operator who built something useful and is talking to someone who might benefit from it.

---

## ABOUT SAM

${settings.sam_description || 'SAM is an AI-powered B2B sales automation platform that helps teams automate outreach while maintaining a personal touch.'}

Key differentiators:
${settings.sam_differentiators || '- AI-generated personalized messages\n- Multi-channel campaigns (LinkedIn + Email)\n- Human-in-the-loop approval system'}

Who it's for:
${settings.ideal_customer || 'B2B sales teams, SDRs, and founders who want to scale outreach without losing authenticity.'}

${settings.objection_handling?.length ? `Common objections and responses:
${settings.objection_handling.map(o => `- "${o.objection}" → ${o.response}`).join('\n')}` : ''}

${settings.proof_points ? `Proof points:\n${settings.proof_points}` : ''}

${settings.pricing_guidance ? `Pricing guidance:\n${settings.pricing_guidance}` : ''}

---

## YOUR VOICE

Tone: ${settings.tone_of_voice || 'Confident but not pushy, helpful but not desperate'}

Style: ${settings.writing_style || 'Short sentences. No fluff. Get to the point.'}

${settings.voice_reference ? `Channel this energy: ${settings.voice_reference}` : ''}

Hard rules:
${settings.dos_and_donts || '- Never use exclamation points excessively\n- Never say "just checking in"\n- Never be sycophantic'}

---

## THIS CONVERSATION

Campaign: ${campaign.name}
Channel: ${campaign.channel === 'linkedin' ? 'LinkedIn' : 'Email'}
Campaign goal: ${campaign.goal || 'Book a call'}

${campaign.originalOutreach ? `Original outreach:\n"${campaign.originalOutreach}"` : ''}

---

## PROSPECT CONTEXT

Name: ${prospect.name}
Role: ${prospect.role || 'Professional'}
Company: ${prospect.company || 'Unknown'}
Industry: ${prospect.industry || 'Not specified'}
${prospect.companySize ? `Company size: ${prospect.companySize}` : ''}

${prospect.crmContext ? `CRM context:\n${prospect.crmContext}` : ''}

${researchContext ? `---

## DEEP RESEARCH INSIGHTS (Opus 4.5 Analysis)

${researchContext}` : ''}

---

## DETECTED INTENT: ${intent.intent.toUpperCase()}

Confidence: ${(intent.confidence * 100).toFixed(0)}%
Reasoning: ${intent.reasoning}

Recommended strategy: ${intent.suggestedStrategy}

---

## YOUR TASK

Craft a reply that:
- Matches their energy (don't be more enthusiastic than they are)
- Answers any question directly
- Handles any objection without being defensive
- Advances toward ${campaign.goal || 'booking a call'} if appropriate
- Exits gracefully if they're not interested
- Sounds like a human who has better things to do than write sales emails

Keep it short. Most replies should be 2-4 sentences. Only go longer if they asked a detailed question.

End with ONE clear next step. Not two options. Not "let me know." One thing.

---

## REPLY CALIBRATION

Pushiness level: ${settings.pushiness_level || 'balanced'}

- **Soft**: Offer value, make next step optional, no pressure
- **Balanced**: Clear CTA but not aggressive, respect their pace
- **Direct**: Confident ask, assumes they want to move forward

${settings.calendar_link ? `\nCalendar link (use if appropriate): ${settings.calendar_link}` : ''}

---

## THE CHEESE FILTER - INSTANT REJECTION TRIGGERS

DO NOT use ANY of these phrases:
- "Thanks so much for getting back to me!"
- "I really appreciate you taking the time..."
- "I'd love to learn more about your challenges..."
- "Would you be open to a quick call to explore..."
- "I think SAM could be a great fit for..."
- "Let me know what works for you!"
- Any sentence that sounds like a sales playbook
- Exclamation points everywhere
- "Happy to" anything
- "Absolutely!" as an opener
- "Great question!"

**The Test:**
Read it back. Does it sound like a real person or a sequence? If sequence, rewrite.

---

## WHAT NEVER TO DO

- Don't thank them profusely for replying
- Don't say "I appreciate you taking the time"
- Don't use "just" as a minimizer ("just a quick call")
- Don't ask "would you be open to..." — either ask directly or don't
- Don't pitch features they didn't ask about
- Don't use exclamation points unless they did first
- Don't be longer than you need to be
- Don't ignore what they said and pivot to your agenda
- Don't sound like a sequence
- Don't use their first name multiple times
- Don't end with "Let me know!"

---

## HANDLING SPECIFIC INTENTS

${intent.intent === 'question' && settings.pricing_guidance ? `**Pricing question handling:**\n${settings.pricing_guidance}\nDefault: "Depends on setup — easier to walk through on a quick call. ${settings.calendar_link || '[Calendar link]'}"` : ''}

${intent.intent === 'wrong_person' ? `**Wrong person handling:**\n"No worries — who should I reach out to instead?"\nOr: "Got it. Mind forwarding this to whoever handles [relevant area]?"` : ''}

${intent.intent === 'not_interested' ? `**Not interested handling:**\n"Understood. Appreciate the reply either way."\nThen stop. Don't try to save it.` : ''}

${intent.intent === 'vague_positive' ? `**Vague positive handling:**\nMirror + soft clarify: "Glad it caught your eye. What specifically stood out?"\nOr go direct: "Want to jump on a call? ${settings.calendar_link || '[Calendar link]'}"` : ''}

---

## OUTPUT FORMAT

Write only the reply message. No preamble, no "Here's my suggestion:", just the message itself.`;
}

const CHEESE_FILTER_ADDENDUM = `

CRITICAL: Your previous response was flagged for sounding like a sales sequence.

Rewrite to sound like an actual human having a real conversation. No corporate speak. No fake enthusiasm. Just be direct and helpful.

If you catch yourself writing something that sounds like it came from a sales playbook, delete it and write what a normal person would say.`;

/**
 * The Cheese Filter - detect sales-y language
 */
const CHEESE_TRIGGERS = [
  'thanks so much for getting back',
  'appreciate you taking the time',
  'would you be open to',
  'i\'d love to',
  'let me know what works',
  'let me know!',
  'happy to',
  'great question!',
  'absolutely!',
  'just checking in',
  'touching base',
  'circle back',
  'synergy',
  'leverage',
  'pain points',
  'value proposition',
  'game changer',
  'deep dive',
  'low-hanging fruit',
  'move the needle',
  'best-in-class',
  'thought leader'
];

const EXCLAMATION_THRESHOLD = 2;

interface CheeseFilterResult {
  passed: boolean;
  triggers: string[];
}

function runCheeseFilter(draft: string): CheeseFilterResult {
  const lower = draft.toLowerCase();
  const triggers: string[] = [];

  // Check for cheese trigger phrases
  for (const trigger of CHEESE_TRIGGERS) {
    if (lower.includes(trigger)) {
      triggers.push(trigger);
    }
  }

  // Check for excessive exclamation points
  const exclamationCount = (draft.match(/!/g) || []).length;
  if (exclamationCount > EXCLAMATION_THRESHOLD) {
    triggers.push(`${exclamationCount} exclamation points`);
  }

  // Check for multiple uses of prospect's name
  // (Would need prospect name passed in for this check)

  return {
    passed: triggers.length === 0,
    triggers
  };
}

/**
 * Get default settings for a workspace
 */
export function getDefaultSettings(): ReplyAgentSettings {
  return {
    enabled: true,
    sam_description: 'SAM is an AI-powered B2B sales automation platform that helps teams automate outreach while maintaining a personal touch.',
    sam_differentiators: '- AI-generated personalized messages that don\'t sound like AI\n- Multi-channel campaigns (LinkedIn + Email)\n- Human-in-the-loop approval for quality control\n- Intent detection and smart follow-ups',
    ideal_customer: 'B2B sales teams, SDRs, and founders who want to scale outreach without losing authenticity.',
    tone_of_voice: 'Confident but not pushy, helpful but not desperate, conversational but professional',
    writing_style: 'Short sentences. No fluff. Get to the point. One idea per paragraph.',
    dos_and_donts: '- Never use exclamation points excessively\n- Never say "just checking in" or "touching base"\n- Never be sycophantic or over-the-top with praise\n- Always address their specific question first\n- Keep replies under 100 words unless they asked a detailed question',
    default_cta: 'book_call',
    pushiness_level: 'balanced',
    // Research settings - uses Opus 4.5 for deep prospect analysis
    enable_research: true,
    research_depth: 'standard',
    handle_not_interested: 'graceful_exit',
    handle_pricing: 'deflect_to_call'
  };
}
