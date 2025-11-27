/**
 * Intent Classifier for Reply Agent
 * Uses Opus 4.5 for accurate intent classification
 */

export type ReplyIntent =
  | 'interested'
  | 'curious'
  | 'objection'
  | 'timing'
  | 'wrong_person'
  | 'not_interested'
  | 'question'
  | 'vague_positive';

export interface IntentClassification {
  intent: ReplyIntent;
  confidence: number;
  reasoning: string;
  suggestedStrategy: string;
}

const INTENT_DEFINITIONS = {
  interested: {
    description: 'Prospect shows clear interest in moving forward',
    examples: ['This looks interesting, tell me more', 'Yes, I\'d like to learn more', 'Sounds good, when can we talk?'],
    strategy: 'Don\'t oversell. They\'re in. Make booking easy. One clear CTA.'
  },
  curious: {
    description: 'Prospect wants more information before committing',
    examples: ['What exactly does this do?', 'How does it work?', 'Can you explain more?'],
    strategy: 'Answer the question, but don\'t dump everything. Create curiosity for the call.'
  },
  objection: {
    description: 'Prospect raises a concern or pushback',
    examples: ['We already have something for this', 'Too expensive', 'Not sure it fits our needs'],
    strategy: 'Acknowledge, don\'t argue. Reframe if possible. Ask a question to understand.'
  },
  timing: {
    description: 'Prospect is interested but not right now',
    examples: ['Not right now, maybe later', 'We\'re in the middle of a project', 'Check back in Q2'],
    strategy: 'Respect it. Offer to follow up. Don\'t push.'
  },
  wrong_person: {
    description: 'Prospect indicates they\'re not the decision maker',
    examples: ['I\'m not the right person', 'You should talk to our IT team', 'Let me forward this'],
    strategy: 'Thank them, ask who the right person is. Make it easy to forward.'
  },
  not_interested: {
    description: 'Prospect clearly declines',
    examples: ['Not interested', 'Please remove me', 'No thanks', 'Unsubscribe'],
    strategy: 'Thank them, exit gracefully. No begging.'
  },
  question: {
    description: 'Prospect asks a specific question (pricing, features, etc.)',
    examples: ['How does pricing work?', 'Does it integrate with X?', 'What\'s the implementation time?'],
    strategy: 'Answer directly, then bridge to next step.'
  },
  vague_positive: {
    description: 'Positive but non-committal response',
    examples: ['👍', 'Thanks', 'Looks interesting', 'Cool'],
    strategy: 'Mirror the energy, ask a soft clarifying question.'
  }
};

/**
 * Classify the intent of a prospect's reply using Opus 4.5
 */
export async function classifyIntent(
  prospectReply: string,
  context?: {
    originalOutreach?: string;
    prospectName?: string;
    prospectCompany?: string;
  }
): Promise<IntentClassification> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    // Fallback to keyword-based classification
    return classifyIntentFallback(prospectReply);
  }

  const systemPrompt = `You are an expert at classifying the intent behind prospect replies in B2B sales conversations.

Classify the prospect's reply into ONE of these intents:

${Object.entries(INTENT_DEFINITIONS).map(([intent, def]) =>
  `**${intent}**: ${def.description}
  Examples: ${def.examples.join(', ')}`
).join('\n\n')}

Respond in JSON format:
{
  "intent": "one of the 8 intents above",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of why this intent was chosen"
}`;

  const userPrompt = `Classify this prospect reply:

"${prospectReply}"

${context?.originalOutreach ? `\nOriginal outreach message: "${context.originalOutreach}"` : ''}
${context?.prospectName ? `\nProspect: ${context.prospectName}` : ''}
${context?.prospectCompany ? `\nCompany: ${context.prospectCompany}` : ''}

Return JSON only.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
        'X-Title': 'SAM AI - Intent Classifier'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-opus-4', // Using Opus 4.5 for highest accuracy
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 200,
        temperature: 0.1 // Low temp for consistent classification
      })
    });

    if (!response.ok) {
      console.error('Intent classification API error:', response.statusText);
      return classifyIntentFallback(prospectReply);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return classifyIntentFallback(prospectReply);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const intent = parsed.intent as ReplyIntent;

    // Validate intent is one of our defined types
    if (!INTENT_DEFINITIONS[intent]) {
      return classifyIntentFallback(prospectReply);
    }

    return {
      intent,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.8)),
      reasoning: parsed.reasoning || 'Classified by AI',
      suggestedStrategy: INTENT_DEFINITIONS[intent].strategy
    };

  } catch (error) {
    console.error('Intent classification error:', error);
    return classifyIntentFallback(prospectReply);
  }
}

/**
 * Fallback keyword-based intent classification
 */
function classifyIntentFallback(text: string): IntentClassification {
  const lower = text.toLowerCase().trim();

  // Not interested - check first (strongest signal)
  if (
    lower.includes('not interested') ||
    lower.includes('no thanks') ||
    lower.includes('unsubscribe') ||
    lower.includes('remove me') ||
    lower.includes('stop contacting') ||
    lower === 'no'
  ) {
    return {
      intent: 'not_interested',
      confidence: 0.9,
      reasoning: 'Contains clear rejection language',
      suggestedStrategy: INTENT_DEFINITIONS.not_interested.strategy
    };
  }

  // Wrong person
  if (
    lower.includes('not the right person') ||
    lower.includes('wrong person') ||
    lower.includes('you should talk to') ||
    lower.includes('forward this to') ||
    lower.includes('not my area')
  ) {
    return {
      intent: 'wrong_person',
      confidence: 0.85,
      reasoning: 'Indicates they are not the decision maker',
      suggestedStrategy: INTENT_DEFINITIONS.wrong_person.strategy
    };
  }

  // Timing
  if (
    lower.includes('not right now') ||
    lower.includes('maybe later') ||
    lower.includes('check back') ||
    lower.includes('busy right now') ||
    lower.includes('next quarter') ||
    lower.includes('in a few months')
  ) {
    return {
      intent: 'timing',
      confidence: 0.85,
      reasoning: 'Indicates timing is not right',
      suggestedStrategy: INTENT_DEFINITIONS.timing.strategy
    };
  }

  // Objection
  if (
    lower.includes('already have') ||
    lower.includes('already use') ||
    lower.includes('too expensive') ||
    lower.includes('budget') ||
    lower.includes('not sure') ||
    lower.includes('competitor')
  ) {
    return {
      intent: 'objection',
      confidence: 0.8,
      reasoning: 'Contains objection language',
      suggestedStrategy: INTENT_DEFINITIONS.objection.strategy
    };
  }

  // Question (pricing, features, etc.)
  if (
    lower.includes('how much') ||
    lower.includes('pricing') ||
    lower.includes('cost') ||
    lower.includes('does it') ||
    lower.includes('can it') ||
    lower.includes('integrate') ||
    lower.includes('how does') ||
    lower.includes('?')
  ) {
    return {
      intent: 'question',
      confidence: 0.75,
      reasoning: 'Contains question',
      suggestedStrategy: INTENT_DEFINITIONS.question.strategy
    };
  }

  // Interested
  if (
    lower.includes('interested') ||
    lower.includes('sounds good') ||
    lower.includes('let\'s talk') ||
    lower.includes('schedule') ||
    lower.includes('call') ||
    lower.includes('demo') ||
    lower.includes('yes')
  ) {
    return {
      intent: 'interested',
      confidence: 0.8,
      reasoning: 'Shows clear interest',
      suggestedStrategy: INTENT_DEFINITIONS.interested.strategy
    };
  }

  // Curious
  if (
    lower.includes('tell me more') ||
    lower.includes('more information') ||
    lower.includes('explain') ||
    lower.includes('what is') ||
    lower.includes('how does')
  ) {
    return {
      intent: 'curious',
      confidence: 0.75,
      reasoning: 'Seeking more information',
      suggestedStrategy: INTENT_DEFINITIONS.curious.strategy
    };
  }

  // Vague positive (default for short positive responses)
  if (
    lower.length < 20 ||
    lower === '👍' ||
    lower === 'thanks' ||
    lower === 'ok' ||
    lower === 'cool' ||
    lower.includes('looks interesting')
  ) {
    return {
      intent: 'vague_positive',
      confidence: 0.6,
      reasoning: 'Short or vague response',
      suggestedStrategy: INTENT_DEFINITIONS.vague_positive.strategy
    };
  }

  // Default to curious if can't determine
  return {
    intent: 'curious',
    confidence: 0.5,
    reasoning: 'Could not determine clear intent',
    suggestedStrategy: INTENT_DEFINITIONS.curious.strategy
  };
}

/**
 * Get strategy for a given intent
 */
export function getIntentStrategy(intent: ReplyIntent): string {
  return INTENT_DEFINITIONS[intent]?.strategy || 'Respond appropriately based on context.';
}

/**
 * Get all intent definitions (for UI display)
 */
export function getIntentDefinitions() {
  return INTENT_DEFINITIONS;
}
