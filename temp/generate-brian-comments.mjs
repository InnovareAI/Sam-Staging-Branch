import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';
const OPENROUTER_API_KEY = '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';

async function generateComments() {
  console.log('GENERATING COMMENTS FOR BRIAN');
  console.log('='.repeat(60));

  // 1. Get 10 best datacenter posts
  console.log('\n1. FINDING BEST DATACENTER POSTS...');

  const { data: posts, error: postsError } = await supabase
    .from('linkedin_posts_discovered')
    .select('id, author_name, author_title, post_content, share_url, workspace_id, monitor_id')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'discovered')
    .is('comment_generated_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (postsError) {
    console.error('Error:', postsError.message);
    return;
  }

  // Filter out job posts and milestones
  const jobPatterns = ['new position', "i'm happy to share", 'hiring', 'join our team', 'we are hiring'];
  const goodPosts = posts.filter(p => {
    const content = (p.post_content || '').toLowerCase();
    return !jobPatterns.some(pat => content.includes(pat));
  }).slice(0, 10);

  console.log('   Found ' + goodPosts.length + ' posts to comment on');

  // 2. Generate comments using AI
  console.log('\n2. GENERATING AI COMMENTS...');

  const generatedComments = [];

  for (const post of goodPosts) {
    console.log('\n   Processing: ' + post.author_name);

    // Generate comment via OpenRouter
    const prompt = `You are a senior datacenter infrastructure professional engaging on LinkedIn.

POST AUTHOR: ${post.author_name}${post.author_title ? ' - ' + post.author_title : ''}

POST CONTENT:
"""
${(post.post_content || '').substring(0, 1500)}
"""

Generate a thoughtful LinkedIn comment that:
1. Adds value to the discussion (insight, experience, or relevant question)
2. Is 2-4 sentences, conversational but professional
3. Does NOT be generic like "Great post!" or "Thanks for sharing!"
4. Does NOT promote any product or service
5. Shows genuine expertise in datacenter/infrastructure topics

Return ONLY the comment text, nothing else.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + OPENROUTER_API_KEY,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://app.meet-sam.com',
          'X-Title': 'SAM AI'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.7
        })
      });

      const result = await response.json();
      const commentText = result.choices?.[0]?.message?.content?.trim();

      if (commentText && commentText.length > 20) {
        generatedComments.push({
          post_id: post.id,
          workspace_id: post.workspace_id,
          monitor_id: post.monitor_id,
          comment_text: commentText,
          author_name: post.author_name,
          post_preview: (post.post_content || '').substring(0, 100)
        });
        console.log('   ✅ Generated: ' + commentText.substring(0, 60) + '...');
      } else {
        console.log('   ❌ Failed: No valid comment generated');
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
      console.error('   ❌ Error:', error.message);
    }
  }

  // 3. Save comments to database
  console.log('\n3. SAVING COMMENTS TO DATABASE...');

  for (const comment of generatedComments) {
    const { error: insertError } = await supabase
      .from('linkedin_post_comments')
      .insert({
        workspace_id: comment.workspace_id,
        monitor_id: comment.monitor_id,
        post_id: comment.post_id,
        comment_text: comment.comment_text,
        status: 'pending_approval',
        generated_at: new Date().toISOString(),
        generation_metadata: {
          model: 'claude-sonnet-4',
          manual_generation: true
        }
      });

    if (insertError) {
      console.error('   ❌ Error saving for ' + comment.author_name + ':', insertError.message);
    } else {
      console.log('   ✅ Saved comment for ' + comment.author_name);

      // Mark post as processed
      await supabase
        .from('linkedin_posts_discovered')
        .update({
          status: 'processing',
          comment_generated_at: new Date().toISOString()
        })
        .eq('id', comment.post_id);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE: Generated ' + generatedComments.length + ' comments');
  console.log('\nThese are now pending approval in the digest email.');
}

generateComments().catch(console.error);
