/**
 * Test Reply Agent - FULL Pipeline with Research
 * Tests: LinkedIn Profile + Company LinkedIn + Website → Intent → Draft
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

console.log('🔧 Environment check:');
console.log(`   OPENROUTER_API_KEY: ${OPENROUTER_API_KEY ? '✅' : '❌'}`);
console.log(`   UNIPILE_DSN: ${UNIPILE_DSN ? '✅ ' + UNIPILE_DSN : '❌'}`);
console.log(`   UNIPILE_API_KEY: ${UNIPILE_API_KEY ? '✅' : '❌'}`);

if (!OPENROUTER_API_KEY) {
  console.error('\n❌ OPENROUTER_API_KEY not set');
  process.exit(1);
}

// Real test case - use REAL LinkedIn profiles and Unipile account
const UNIPILE_ACCOUNT_ID = '4Vv6oZ73RvarImDN6iYbbg'; // Stan's LinkedIn account

const testProspect = {
  name: 'Stan Bounev',
  linkedInUrl: 'https://www.linkedin.com/in/stanbounev',
  company: 'BlueLabel',
  companyLinkedInUrl: 'https://www.linkedin.com/company/bluelabel-ai',
  websiteUrl: 'https://bluelabel.ai',
  reply: "Interesting timing - we've been struggling with our outbound process lately. Using a mix of tools but nothing cohesive. What makes SAM different from something like Apollo or Outreach?",
  originalOutreach: "Hi Stan, noticed BlueLabel is scaling the cybersecurity AI platform. SAM helps B2B teams automate personalized outreach while keeping it human. Worth a quick chat?"
};

/**
 * Fetch LinkedIn profile via Unipile
 */
async function fetchLinkedInProfile(linkedInUrl) {
  if (!linkedInUrl || !UNIPILE_DSN || !UNIPILE_API_KEY) {
    console.log('   ⚠️ Skipping LinkedIn profile (no URL or credentials)');
    return null;
  }

  try {
    const vanityMatch = linkedInUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    if (!vanityMatch) return null;

    const vanity = vanityMatch[1];
    console.log(`   📥 Fetching LinkedIn profile: ${vanity}`);

    // Use account_id for reliable profile fetch
    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/users/${encodeURIComponent(vanity)}?account_id=${UNIPILE_ACCOUNT_ID}`, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ⚠️ LinkedIn profile fetch failed: ${response.status} - ${errorText.substring(0, 100)}`);
      return null;
    }

    const profile = await response.json();
    console.log(`   ✅ Got profile: ${profile.first_name} ${profile.last_name}`);
    return formatLinkedInProfile(profile);
  } catch (error) {
    console.log(`   ⚠️ LinkedIn error: ${error.message}`);
    return null;
  }
}

function formatLinkedInProfile(profile) {
  if (!profile) return '';
  const sections = [];
  if (profile.first_name || profile.last_name) {
    sections.push(`Name: ${profile.first_name || ''} ${profile.last_name || ''}`);
  }
  if (profile.headline) sections.push(`Headline: ${profile.headline}`);
  if (profile.summary) sections.push(`Summary: ${profile.summary}`);
  if (profile.current_position) {
    sections.push(`Current Role: ${profile.current_position.title} at ${profile.current_position.company_name}`);
  }
  if (profile.positions?.length > 0) {
    const roles = profile.positions.slice(0, 3).map(p =>
      `- ${p.title} at ${p.company_name}`
    );
    sections.push(`Experience:\n${roles.join('\n')}`);
  }
  if (profile.skills?.length > 0) {
    sections.push(`Skills: ${profile.skills.slice(0, 10).join(', ')}`);
  }
  return sections.join('\n\n');
}

/**
 * Fetch website content
 */
async function fetchWebsiteContent(websiteUrl) {
  if (!websiteUrl) {
    console.log('   ⚠️ Skipping website (no URL)');
    return null;
  }

  try {
    console.log(`   📥 Fetching website: ${websiteUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SAM-AI/1.0)'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`   ⚠️ Website fetch failed: ${response.status}`);
      return null;
    }

    const html = await response.text();
    return extractWebsiteContent(html, websiteUrl);
  } catch (error) {
    console.log(`   ⚠️ Website error: ${error.message}`);
    return null;
  }
}

function extractWebsiteContent(html, url) {
  const sections = [`URL: ${url}`];

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) sections.push(`Title: ${titleMatch[1].trim()}`);

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) sections.push(`Description: ${descMatch[1].trim()}`);

  // Extract headings
  const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi) || [];
  const h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];

  const headings = [...h1Matches, ...h2Matches.slice(0, 5)]
    .map(h => h.replace(/<[^>]+>/g, '').trim())
    .filter(h => h.length > 0 && h.length < 100);

  if (headings.length > 0) {
    sections.push(`Key Headings:\n${headings.map(h => `- ${h}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Research prospect with Opus 4.5
 */
async function researchProspect(linkedInData, websiteData, prospect) {
  console.log('\n🔬 Analyzing research with Opus 4.5...');

  const researchPrompt = `Analyze this prospect to help craft a highly relevant reply.

## PROSPECT INFO
Name: ${prospect.name}
Company: ${prospect.company}

## PROSPECT'S MESSAGE
"${prospect.reply}"

## OUR ORIGINAL OUTREACH
"${prospect.originalOutreach}"

## LINKEDIN PROFILE DATA
${linkedInData || 'Not available'}

## COMPANY WEBSITE DATA
${websiteData || 'Not available'}

---

Provide analysis in JSON format:

{
  "personal": {
    "headline": "Their headline or title",
    "connectionPoints": ["Things we can reference in reply"],
    "communicationStyle": "direct/casual/formal"
  },
  "company": {
    "description": "What they do",
    "industry": "Their industry",
    "painPoints": ["Likely challenges SAM could solve"],
    "techStack": ["Tools they likely use"]
  },
  "website": {
    "valueProposition": "Their core value prop",
    "products": ["Main products/services"],
    "targetAudience": "Who they sell to"
  },
  "icpAnalysis": {
    "fitScore": 0-100,
    "fitReason": "Why good/bad fit",
    "buyingSignals": ["Signals from their message"],
    "recommendedApproach": "How to reply",
    "keyTalkingPoints": ["Specific points to mention"]
  }
}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.meet-sam.com',
      'X-Title': 'SAM AI - Prospect Research'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4',
      messages: [
        {
          role: 'system',
          content: 'You are a B2B sales research analyst. Analyze prospect data and provide actionable insights. Always respond with valid JSON.'
        },
        { role: 'user', content: researchPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.3
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.statusText}`);

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  return JSON.parse(jsonMatch[0]);
}

/**
 * Classify intent with Opus 4.5
 */
async function classifyIntent(reply) {
  console.log('\n🎯 Classifying intent...');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.meet-sam.com',
      'X-Title': 'SAM AI - Intent Classifier'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4',
      messages: [
        {
          role: 'system',
          content: `Classify intent into: interested, curious, objection, timing, wrong_person, not_interested, question, vague_positive.
Respond JSON: {"intent": "...", "confidence": 0-1, "reasoning": "..."}`
        },
        { role: 'user', content: `Classify: "${reply}"` }
      ],
      max_tokens: 200,
      temperature: 0.1
    })
  });

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch[0]);
}

/**
 * Generate draft with research context
 */
async function generateDraft(prospect, intent, research) {
  console.log('\n📝 Generating personalized draft...');

  const systemPrompt = `You are SAM, replying to a prospect's LinkedIn message.

## RESEARCH INSIGHTS
${research.personal?.headline ? `Headline: ${research.personal.headline}` : ''}
${research.company?.description ? `Company: ${research.company.description}` : ''}
${research.company?.painPoints?.length ? `Pain points: ${research.company.painPoints.join(', ')}` : ''}
${research.website?.valueProposition ? `Their value prop: ${research.website.valueProposition}` : ''}
${research.website?.products?.length ? `Products: ${research.website.products.join(', ')}` : ''}

## ICP ANALYSIS
Fit Score: ${research.icpAnalysis?.fitScore || 'N/A'}/100
${research.icpAnalysis?.fitReason || ''}
${research.icpAnalysis?.buyingSignals?.length ? `Buying signals: ${research.icpAnalysis.buyingSignals.join(', ')}` : ''}
${research.icpAnalysis?.keyTalkingPoints?.length ? `Key points to mention:\n${research.icpAnalysis.keyTalkingPoints.map(p => `- ${p}`).join('\n')}` : ''}

## DETECTED INTENT: ${intent.intent.toUpperCase()}
${intent.reasoning}

## RULES
1. Keep it SHORT (2-4 sentences)
2. Sound human, NOT salesy
3. Reference something specific from research
4. Answer their question directly
5. End with ONE clear next step
6. NO cheese: "thanks so much", "would you be open to", "I'd love to"`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.meet-sam.com',
      'X-Title': 'SAM AI - Draft Generator'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Prospect ${prospect.name} from ${prospect.company} replied:\n\n"${prospect.reply}"\n\nGenerate a personalized reply using the research insights.` }
      ],
      max_tokens: 400,
      temperature: 0.7
    })
  });

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

/**
 * Main test
 */
async function runFullTest() {
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 FULL REPLY AGENT TEST - Research → Intent → Draft');
  console.log('═'.repeat(70));

  console.log(`\n👤 Prospect: ${testProspect.name}`);
  console.log(`🏢 Company: ${testProspect.company}`);
  console.log(`💬 Reply: "${testProspect.reply}"`);

  const startTime = Date.now();

  // Step 1: Gather research data (parallel)
  console.log('\n' + '─'.repeat(70));
  console.log('📊 STEP 1: GATHERING RESEARCH DATA');
  console.log('─'.repeat(70));

  const [linkedInData, websiteData] = await Promise.all([
    fetchLinkedInProfile(testProspect.linkedInUrl),
    fetchWebsiteContent(testProspect.websiteUrl)
  ]);

  if (linkedInData) {
    console.log('\n   ✅ LinkedIn Profile:');
    console.log(linkedInData.split('\n').map(l => `      ${l}`).join('\n'));
  }

  if (websiteData) {
    console.log('\n   ✅ Website Data:');
    console.log(websiteData.split('\n').slice(0, 8).map(l => `      ${l}`).join('\n'));
  }

  // Step 2: Analyze with Opus 4.5
  console.log('\n' + '─'.repeat(70));
  console.log('🔬 STEP 2: OPUS 4.5 RESEARCH ANALYSIS');
  console.log('─'.repeat(70));

  const research = await researchProspect(linkedInData, websiteData, testProspect);

  console.log(`\n   ICP Fit Score: ${research.icpAnalysis?.fitScore || 'N/A'}/100`);
  console.log(`   Fit Reason: ${research.icpAnalysis?.fitReason || 'N/A'}`);

  if (research.icpAnalysis?.buyingSignals?.length) {
    console.log(`   Buying Signals:`);
    research.icpAnalysis.buyingSignals.forEach(s => console.log(`      - ${s}`));
  }

  if (research.icpAnalysis?.keyTalkingPoints?.length) {
    console.log(`   Key Talking Points:`);
    research.icpAnalysis.keyTalkingPoints.forEach(p => console.log(`      - ${p}`));
  }

  // Step 3: Classify intent
  console.log('\n' + '─'.repeat(70));
  console.log('🎯 STEP 3: INTENT CLASSIFICATION');
  console.log('─'.repeat(70));

  const intent = await classifyIntent(testProspect.reply);
  console.log(`\n   Intent: ${intent.intent}`);
  console.log(`   Confidence: ${(intent.confidence * 100).toFixed(0)}%`);
  console.log(`   Reasoning: ${intent.reasoning}`);

  // Step 4: Generate draft
  console.log('\n' + '─'.repeat(70));
  console.log('📝 STEP 4: PERSONALIZED DRAFT');
  console.log('─'.repeat(70));

  const draft = await generateDraft(testProspect, intent, research);

  console.log('\n   GENERATED REPLY:');
  console.log('   ┌' + '─'.repeat(66) + '┐');
  draft.split('\n').forEach(line => {
    console.log(`   │ ${line.padEnd(64)} │`);
  });
  console.log('   └' + '─'.repeat(66) + '┘');

  const totalTime = Date.now() - startTime;

  console.log('\n' + '═'.repeat(70));
  console.log('✅ TEST COMPLETE');
  console.log('═'.repeat(70));
  console.log(`   Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   Research: ${linkedInData ? '✅' : '⚠️'} LinkedIn | ${websiteData ? '✅' : '⚠️'} Website`);
  console.log(`   ICP Score: ${research.icpAnalysis?.fitScore || 'N/A'}/100`);
  console.log(`   Intent: ${intent.intent} (${(intent.confidence * 100).toFixed(0)}%)`);
}

runFullTest().catch(console.error);
