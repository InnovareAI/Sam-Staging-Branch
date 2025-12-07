import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Find the Ladybug post
const { data: posts } = await supabase
  .from('linkedin_posts_discovered')
  .select('id, author_name, post_content')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .ilike('post_content', '%Ladybug Unplugged%')
  .limit(1);

if (!posts || posts.length === 0) {
  console.log('❌ Ladybug post not found');
  process.exit(0);
}

const post = posts[0];

console.log('\n📝 POST BY:', post.author_name);
console.log('Content:', post.post_content.substring(0, 200), '...\n');

// Test with BEFORE prompt (simulate old behavior)
const oldPrompt = `You are a LinkedIn engagement specialist. Generate a comment that sounds like a sharp, trusted friend—confident, human, and curious.

**Comment Framework**: ACA+I: Acknowledge their point → Add your insight/nuance → Drop an I-statement from experience → Ask a warm question

**Tone**: Candid, relatable, story-driven. Shows the mess behind the magic.

**Post**: ${post.post_content}

Return JSON: { "comment_text": "..." }`;

console.log('🔴 OLD PROMPT RESULT:\n');
const oldResponse = await anthropic.messages.create({
  model: 'claude-3-5-haiku-20241022',
  max_tokens: 300,
  temperature: 0.7,
  messages: [{ role: 'user', content: oldPrompt }]
});
const oldText = oldResponse.content.find(b => b.type === 'text')?.text || '';
const oldJson = JSON.parse(oldText.match(/\{.*\}/s)[0]);
console.log(`"${oldJson.comment_text}"\n`);

// Test with NEW improved prompt
const newPrompt = `You are a LinkedIn engagement specialist. Generate a comment that sounds like a sharp, trusted friend—confident, human, and curious.

**Comment Framework**: ACA+I: Acknowledge their point → Add your insight/nuance → Drop an I-statement from experience → Ask a warm question

**Tone**: Candid, relatable, story-driven. Shows the mess behind the magic.

**🚨 AVOID SOUNDING LIKE A BOT**:
- ❌ Forced analogies: "This is the new X of 2012" - sounds fake
- ❌ Overly complex questions: Don't ask multi-part technical questions with jargon
- ❌ Trying too hard: Don't use unnecessarily technical language
- ❌ Consultant-speak: Avoid phrases like "orchestration complexity"

**✅ SOUND LIKE A REAL PERSON**:
- ✅ Use simple, direct language
- ✅ Ask ONE clear question, not multiple
- ✅ Share a quick personal experience
- ✅ Be casual and conversational
- ✅ It's okay to be imperfect

**Post**: ${post.post_content}

Return JSON: { "comment_text": "..." }`;

console.log('✅ NEW IMPROVED PROMPT RESULT:\n');
const newResponse = await anthropic.messages.create({
  model: 'claude-3-5-haiku-20241022',
  max_tokens: 300,
  temperature: 0.7,
  messages: [{ role: 'user', content: newPrompt }]
});
const newText = newResponse.content.find(b => b.type === 'text')?.text || '';
const newJson = JSON.parse(newText.match(/\{.*\}/s)[0]);
console.log(`"${newJson.comment_text}"\n`);

console.log('📊 COMPARISON:');
console.log(`Old: ${oldJson.comment_text.length} chars`);
console.log(`New: ${newJson.comment_text.length} chars`);
