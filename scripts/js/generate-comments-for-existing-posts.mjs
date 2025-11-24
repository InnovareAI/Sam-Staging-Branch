/**
 * Generate comments for existing discovered posts
 * Run this once to backfill comments for posts discovered before auto-generation was added
 */

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // InnovareAI workspace
const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com';

async function generateCommentsForExistingPosts() {
  console.log('🤖 Generating comments for existing discovered posts...\n');

  try {
    // Fetch all discovered posts without comments
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('📋 Fetching posts without comments...');

    const { data: posts, error: postsError } = await supabase
      .from('linkedin_posts_discovered')
      .select('id, monitor_id, author_name, post_content, created_at')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('status', 'discovered')
      .order('created_at', { ascending: false });

    if (postsError) {
      throw new Error(`Error fetching posts: ${postsError.message}`);
    }

    if (!posts || posts.length === 0) {
      console.log('✅ No posts found to generate comments for');
      return;
    }

    console.log(`📝 Found ${posts.length} posts:\n`);
    posts.forEach((post, i) => {
      console.log(`${i + 1}. ${post.author_name} - ${post.post_content.substring(0, 60)}...`);
    });

    // Group posts by monitor_id
    const postsByMonitor = posts.reduce((acc, post) => {
      if (!acc[post.monitor_id]) {
        acc[post.monitor_id] = [];
      }
      acc[post.monitor_id].push(post);
      return acc;
    }, {});

    console.log(`\n🎯 Processing ${Object.keys(postsByMonitor).length} monitors...\n`);

    // Generate comments for each monitor group
    let totalSuccess = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const [monitorId, monitorPosts] of Object.entries(postsByMonitor)) {
      console.log(`\n📍 Monitor ${monitorId.substring(0, 8)}... (${monitorPosts.length} posts)`);

      const response = await fetch(`${API_URL}/api/linkedin-commenting/auto-generate-comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          post_ids: monitorPosts.map(p => p.id),
          workspace_id: WORKSPACE_ID,
          monitor_id: monitorId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`   ❌ API Error: ${response.status} ${response.statusText}`);
        console.error(`   ${errorText}`);
        totalErrors += monitorPosts.length;
        continue;
      }

      const result = await response.json();
      console.log(`   ✅ Success: ${result.success_count}`);
      console.log(`   ⏭️  Skipped: ${result.skip_count}`);
      console.log(`   ❌ Errors: ${result.error_count}`);

      totalSuccess += result.success_count;
      totalSkipped += result.skip_count;
      totalErrors += result.error_count;

      // Show individual results
      if (result.results) {
        result.results.forEach((r, i) => {
          const post = monitorPosts.find(p => p.id === r.post_id);
          const prefix = r.status === 'success' ? '   ✅' : r.status === 'skipped' ? '   ⏭️ ' : '   ❌';
          console.log(`${prefix} ${i + 1}. ${post?.author_name}: ${r.status}${r.confidence_score ? ` (confidence: ${r.confidence_score.toFixed(2)})` : ''}`);
          if (r.reason) console.log(`        Reason: ${r.reason}`);
          if (r.error) console.log(`        Error: ${r.error}`);
        });
      }
    }

    console.log(`\n\n🎉 COMPLETE!`);
    console.log(`   Total posts: ${posts.length}`);
    console.log(`   ✅ Success: ${totalSuccess}`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`   ❌ Errors: ${totalErrors}`);

    // Verify comments were saved
    console.log('\n🔍 Verifying saved comments...');
    const { data: savedComments, error: commentsError } = await supabase
      .from('linkedin_post_comments')
      .select('id, status, comment_text')
      .eq('workspace_id', WORKSPACE_ID)
      .order('created_at', { ascending: false });

    if (commentsError) {
      console.error('❌ Error fetching comments:', commentsError.message);
    } else {
      console.log(`✅ Found ${savedComments?.length || 0} comments in database`);
      if (savedComments && savedComments.length > 0) {
        console.log('\nSample comments:');
        savedComments.slice(0, 3).forEach((c, i) => {
          console.log(`\n${i + 1}. Status: ${c.status}`);
          console.log(`   ${c.comment_text.substring(0, 100)}...`);
        });
      }
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
generateCommentsForExistingPosts();
