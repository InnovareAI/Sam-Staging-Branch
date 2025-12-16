import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const OPENROUTER_API_KEY = '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';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

// Brian's comment templates with variance
const COMMENT_TEMPLATES = [
  { type: 'clarifying_addon', starter: "Great post. I'd add one nuance we've seen in the field:", style: 'add missing detail or edge case, invite validation' },
  { type: 'best_practices', starter: "Totally agree. From our side, here are", style: 'numbered list of 2-3 areas where coordination matters' },
  { type: 'deployment_insight', starter: "This aligns with what we saw during our", style: 'share real field experience, offer to share resources' },
  { type: 'gaps_questions', starter: "This is solid. One question we're still exploring:", style: 'acknowledge strength, ask exploratory question' },
];

// Length variance (Brian's max is 300 chars)
const LENGTH_TARGETS = [
  { chars: 120, probability: 0.2 },  // Short
  { chars: 200, probability: 0.5 },  // Medium
  { chars: 280, probability: 0.3 },  // Long (near max)
];

function getRandomTemplate() {
  return COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
}

function getRandomLength() {
  const rand = Math.random();
  let cumulative = 0;
  for (const l of LENGTH_TARGETS) {
    cumulative += l.probability;
    if (rand <= cumulative) return l.chars;
  }
  return 200;
}

async function regenerate() {
  console.log('REGENERATING BRIAN\'S COMMENTS WITH PROPER GUIDELINES');
  console.log('='.repeat(60));

  // 1. Delete bad comments
  console.log('\n1. DELETING BAD COMMENTS...');
  const { data: deleted } = await supabase
    .from('linkedin_post_comments')
    .delete()
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'pending_approval')
    .select();

  console.log('   Deleted ' + (deleted?.length || 0) + ' comments');

  // Reset posts to discovered status
  if (deleted && deleted.length > 0) {
    const postIds = deleted.map(d => d.post_id);
    await supabase
      .from('linkedin_posts_discovered')
      .update({ status: 'discovered', comment_generated_at: null })
      .in('id', postIds);
  }

  // 2. Get fresh posts
  console.log('\n2. GETTING FRESH POSTS...');
  const { data: posts } = await supabase
    .from('linkedin_posts_discovered')
    .select('id, author_name, author_title, post_content, share_url, workspace_id, monitor_id')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'discovered')
    .is('comment_generated_at', null)
    .order('created_at', { ascending: false })
    .limit(12);

  // Filter job posts
  const goodPosts = posts.filter(p => {
    const content = (p.post_content || '').toLowerCase();
    return !content.includes('new position') && !content.includes("i'm happy to share that i") && !content.includes('hiring');
  }).slice(0, 10);

  console.log('   Found ' + goodPosts.length + ' posts');

  // 3. Generate with Brian's voice
  console.log('\n3. GENERATING WITH BRIAN\'S VOICE...');

  const BRIAN_SYSTEM_PROMPT = `You are Brian Neirby, Product Expert and Content Manager at ChillMine.

YOUR VOICE:
- Methodical, detail-oriented, quietly assertive
- Structured and precise – organizing complex input into something clear
- Inclusive and collaborative – actively integrates feedback and invites perspectives

YOUR EXPERTISE:
- High-density liquid cooling for AI/HPC data centers (50kW+ racks)
- Deployment coordination and best practices documentation
- Cross-team alignment (facilities, IT, sustainability)
- Temperature precision (±0.5°C), CDU metrics, waste heat reuse

SIGNATURE PHRASES:
- "After reviewing our latest deployments..."
- "I'd add one nuance we've seen in the field..."
- "From our side, here are [X] areas where..."
- "This aligns with what we saw during our [location] rollout..."
- "What's missing from your perspective?"

RULES:
- Max 300 characters
- Use structured language when listing (bullets or numbers)
- Reference real deployments and field experience
- Keep tone collaborative and quietly confident
- NEVER be vague or generic
- DO NOT use phrases like "Great insights" or "Thanks for sharing"`;

  for (let i = 0; i < goodPosts.length; i++) {
    const post = goodPosts[i];
    const template = getRandomTemplate();
    const targetLength = getRandomLength();

    console.log('\n   [' + (i+1) + '] ' + post.author_name);
    console.log('       Template: ' + template.type);
    console.log('       Target: ~' + targetLength + ' chars');

    const userPrompt = `Write a LinkedIn comment on this post. Use this template style: ${template.type}

TEMPLATE STARTER: "${template.starter}"
STYLE: ${template.style}

POST BY: ${post.author_name}${post.author_title ? ' - ' + post.author_title : ''}
POST CONTENT:
"""
${(post.post_content || '').substring(0, 1000)}
"""

Write the comment. Target ~${targetLength} characters. Max 300 chars. Return ONLY the comment text.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          messages: [
            { role: 'system', content: BRIAN_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 150,
          temperature: 0.8
        })
      });

      const result = await response.json();
      const commentText = result.choices?.[0]?.message?.content?.trim();

      if (commentText && commentText.length > 20 && commentText.length <= 350) {
        // Save to DB
        await supabase
          .from('linkedin_post_comments')
          .insert({
            workspace_id: post.workspace_id,
            monitor_id: post.monitor_id,
            post_id: post.id,
            comment_text: commentText,
            status: 'pending_approval',
            generated_at: new Date().toISOString(),
            generation_metadata: {
              model: 'claude-sonnet-4',
              template: template.type,
              target_length: targetLength,
              actual_length: commentText.length,
              uses_brian_guidelines: true
            }
          });

        await supabase
          .from('linkedin_posts_discovered')
          .update({ status: 'processing', comment_generated_at: new Date().toISOString() })
          .eq('id', post.id);

        console.log('       ✅ ' + commentText.substring(0, 60) + '...');
        console.log('       Length: ' + commentText.length + ' chars');
      } else {
        console.log('       ❌ Invalid: ' + (commentText?.length || 0) + ' chars');
      }

      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error('       ❌ Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE - Comments regenerated with Brian\'s voice');
}

regenerate().catch(console.error);
