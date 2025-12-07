import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get the 5 posts
const { data: posts } = await supabase
  .from('linkedin_posts_discovered')
  .select('id, workspace_id, monitor_id, author_name, post_content')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .eq('status', 'discovered')
  .is('comment_generated_at', null)
  .limit(5);

console.log(`\n🚀 Generating Haiku 4.5 comments for ${posts.length} posts...\n`);

const results = [];

for (const post of posts) {
  console.log(`💬 ${post.author_name}...`);

  const prompt = `Generate a LinkedIn comment for this post:

"${post.post_content}"

Return JSON with comment_text (2-3 sentences, conversational, specific).`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022', // Haiku 4.5
    max_tokens: 300,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content.find(b => b.type === 'text')?.text || '';
  const json = JSON.parse(text.match(/\{.*\}/s)[0]);

  // Save to DB
  await supabase.from('linkedin_post_comments').insert({
    workspace_id: post.workspace_id,
    monitor_id: post.monitor_id,
    post_id: post.id,
    comment_text: json.comment_text,
    status: 'pending_approval',
    generated_at: new Date().toISOString(),
    generation_metadata: { model: response.model, confidence_score: 0.85 }
  });

  results.push({ author: post.author_name, comment: json.comment_text, model: response.model });
  console.log(`   ✅ ${response.model}\n`);
}

console.log('\n📊 HAIKU 4.5 COMMENTS GENERATED:\n');
results.forEach((r, i) => console.log(`${i+1}. ${r.author}\n   "${r.comment.substring(0, 120)}..."\n`));
