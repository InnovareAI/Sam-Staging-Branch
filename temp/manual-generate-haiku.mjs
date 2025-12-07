import { createClient } from '@supabase/supabase-js';
import { generateLinkedInComment } from '../lib/services/linkedin-commenting-agent.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get the 5 posts
const { data: posts } = await supabase
  .from('linkedin_posts_discovered')
  .select(`
    id,
    workspace_id,
    author_name,
    author_profile_id,
    author_title,
    post_content,
    linkedin_post_monitors!inner (
      id,
      auto_approve_enabled,
      metadata
    )
  `)
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .eq('status', 'discovered')
  .is('comment_generated_at', null)
  .limit(5);

console.log(`\n🚀 Generating Haiku 4.5 comments for ${posts.length} posts...\n`);

// Get brand guidelines
const { data: brandGuideline } = await supabase
  .from('linkedin_brand_guidelines')
  .select('*')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .single();

const results = [];

for (const post of posts) {
  console.log(`💬 Processing: ${post.author_name}...`);

  try {
    const context = {
      post: {
        id: post.id,
        post_linkedin_id: '',
        post_social_id: '',
        post_text: post.post_content,
        post_type: 'post',
        author: {
          linkedin_id: post.author_profile_id || '',
          name: post.author_name,
          title: post.author_title || '',
          company: '',
          profile_url: ''
        },
        engagement: { likes_count: 0, comments_count: 0, shares_count: 0 },
        posted_at: new Date()
      },
      workspace: {
        workspace_id: post.workspace_id,
        company_name: 'InnovareAI',
        expertise_areas: ['AI', 'Sales Automation'],
        products: ['SAM AI'],
        value_props: [],
        tone_of_voice: 'Professional but friendly',
        brand_guidelines: brandGuideline
      }
    };

    const comment = await generateLinkedInComment(context);

    // Save comment
    await supabase
      .from('linkedin_post_comments')
      .insert({
        workspace_id: post.workspace_id,
        monitor_id: post.linkedin_post_monitors.id,
        post_id: post.id,
        comment_text: comment.comment_text,
        status: 'pending_approval',
        generated_at: new Date().toISOString(),
        generation_metadata: {
          model: comment.generation_metadata.model,
          confidence_score: comment.confidence_score
        }
      });

    results.push({
      author: post.author_name,
      comment: comment.comment_text,
      model: comment.generation_metadata.model,
      confidence: comment.confidence_score
    });

    console.log(`   ✅ Generated (${comment.generation_metadata.model})\n`);
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}\n`);
  }
}

console.log('\n📊 HAIKU 4.5 RESULTS:\n');
results.forEach((r, i) => {
  console.log(`${i+1}. ${r.author} (${r.model}, confidence: ${r.confidence.toFixed(2)})`);
  console.log(`   "${r.comment.substring(0, 120)}..."\n`);
});
