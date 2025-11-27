/**
 * Test Reply Agent - Intent Classification + Draft Generation + RAG
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not set');
  process.exit(1);
}

// Test prospect replies with different intents
const testCases = [
  {
    name: 'Interested',
    reply: "This sounds interesting! I'd love to learn more about how SAM can help our sales team. When can we set up a quick call?",
    expected: 'interested'
  },
  {
    name: 'Question',
    reply: "How does the pricing work? Do you offer any discounts for startups?",
    expected: 'question'
  },
  {
    name: 'Objection',
    reply: "We already use HubSpot for this. Not sure we need another tool.",
    expected: 'objection'
  },
  {
    name: 'Timing',
    reply: "Interesting, but we're in the middle of a product launch right now. Maybe check back in Q2?",
    expected: 'timing'
  },
  {
    name: 'Not Interested',
    reply: "No thanks, not interested. Please remove me from your list.",
    expected: 'not_interested'
  }
];

async function classifyIntent(prospectReply, context = {}) {
  const INTENT_DEFINITIONS = {
    interested: 'Prospect shows clear interest in moving forward',
    curious: 'Prospect wants more information before committing',
    objection: 'Prospect raises a concern or pushback',
    timing: 'Prospect is interested but not right now',
    wrong_person: 'Prospect indicates they are not the decision maker',
    not_interested: 'Prospect clearly declines',
    question: 'Prospect asks a specific question',
    vague_positive: 'Positive but non-committal response'
  };

  const systemPrompt = `You are an expert at classifying the intent behind prospect replies in B2B sales conversations.

Classify the prospect's reply into ONE of these intents:

${Object.entries(INTENT_DEFINITIONS).map(([intent, def]) =>
  `**${intent}**: ${def}`
).join('\n')}

Respond in JSON format:
{
  "intent": "one of the 8 intents above",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of why this intent was chosen"
}`;

  const userPrompt = `Classify this prospect reply:

"${prospectReply}"

${context.originalOutreach ? `\nOriginal outreach message: "${context.originalOutreach}"` : ''}
${context.prospectName ? `\nProspect: ${context.prospectName}` : ''}

Return JSON only.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.meet-sam.com',
      'X-Title': 'SAM AI - Intent Classifier Test'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 200,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON in response');
  }

  return JSON.parse(jsonMatch[0]);
}

async function generateDraft(prospectReply, intent, prospect) {
  const systemPrompt = `You are SAM, an AI sales assistant. Generate a reply to a prospect's message.

RULES:
1. Keep it SHORT (2-3 sentences max)
2. Sound human and conversational, NOT salesy
3. Match the prospect's energy level
4. Don't use clichés like "I completely understand" or "Let me assure you"
5. Be direct and helpful

Prospect: ${prospect.name}${prospect.company ? ` from ${prospect.company}` : ''}
Intent detected: ${intent}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.meet-sam.com',
      'X-Title': 'SAM AI - Draft Generator Test'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Prospect replied: "${prospectReply}"\n\nGenerate a response.` }
      ],
      max_tokens: 300,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

async function runTests() {
  console.log('🧪 Testing Reply Agent with Opus 4.5\n');
  console.log('═'.repeat(60));

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log(`   Reply: "${testCase.reply.substring(0, 50)}..."`);

    try {
      // Step 1: Classify intent
      console.log('\n   🎯 Classifying intent...');
      const startIntent = Date.now();
      const classification = await classifyIntent(testCase.reply);
      const intentTime = Date.now() - startIntent;

      const match = classification.intent === testCase.expected;
      console.log(`   Intent: ${classification.intent} (expected: ${testCase.expected}) ${match ? '✅' : '❌'}`);
      console.log(`   Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
      console.log(`   Reasoning: ${classification.reasoning}`);
      console.log(`   Time: ${intentTime}ms`);

      // Step 2: Generate draft
      console.log('\n   📝 Generating draft...');
      const startDraft = Date.now();
      const draft = await generateDraft(testCase.reply, classification.intent, {
        name: 'Alex Thompson',
        company: 'TechCorp Inc'
      });
      const draftTime = Date.now() - startDraft;

      console.log(`   Draft: "${draft}"`);
      console.log(`   Time: ${draftTime}ms`);

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    console.log('\n' + '─'.repeat(60));
  }

  console.log('\n✅ All tests completed!');
}

runTests();
