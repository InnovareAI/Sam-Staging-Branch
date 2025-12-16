import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

async function diagnose() {
  console.log('BRIAN COMMENTING AGENT - DEEP DIVE');
  console.log('='.repeat(60));

  // 1. Find the correct accounts table
  console.log('\n1. FINDING LINKEDIN ACCOUNTS TABLE...');

  // Try different table names
  const tableNames = [
    'workspace_linkedin_accounts',
    'workspace_unipile_connections',
    'linkedin_integrations',
    'integrations',
    'connected_accounts'
  ];

  for (const table of tableNames) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('workspace_id', BRIAN_WORKSPACE_ID)
      .limit(5);

    if (!error) {
      console.log('   ✅ Found table: ' + table);
      console.log('   Data: ' + JSON.stringify(data, null, 2));
    }
  }

  // 2. Check why today's posts weren't processed
  console.log('\n\n2. TODAY\'S POSTS ANALYSIS:');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: todaysPosts, error: postsError } = await supabase
    .from('linkedin_posts_discovered')
    .select('id, author_name, status, post_content, comment_generated_at, comment_eligible_at, created_at')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });

  if (postsError) {
    console.error('Error:', postsError.message);
  } else {
    console.log('   Found ' + todaysPosts.length + ' posts discovered today');
    for (const p of todaysPosts) {
      console.log('\n   Post by: ' + p.author_name);
      console.log('   Status: ' + p.status);
      console.log('   Comment generated: ' + (p.comment_generated_at || 'NO'));
      console.log('   Comment eligible at: ' + (p.comment_eligible_at || 'NOT SET'));
      console.log('   Content: ' + (p.post_content || '').substring(0, 80) + '...');

      // Check if it's a job/milestone post
      const content = (p.post_content || '').toLowerCase();
      if (content.includes('new position') || content.includes('happy to share')) {
        console.log('   ⚠️  LIKELY FILTERED: Job/Milestone announcement');
      }
      if (content.includes('thanks to everyone')) {
        console.log('   ⚠️  LIKELY FILTERED: Social pleasantry');
      }
    }
  }

  // 3. Check comment generation timestamps
  console.log('\n\n3. RECENT COMMENT GENERATION ACTIVITY:');
  const { data: recentComments, error: commentsError } = await supabase
    .from('linkedin_post_comments')
    .select('id, workspace_id, status, generated_at')
    .order('generated_at', { ascending: false })
    .limit(10);

  if (commentsError) {
    console.error('Error:', commentsError.message);
  } else {
    console.log('   Last 10 comments generated:');
    for (const c of recentComments) {
      const isBrian = c.workspace_id === BRIAN_WORKSPACE_ID;
      console.log('   - ' + c.generated_at + ' (' + c.status + ')' + (isBrian ? ' [BRIAN]' : ''));
    }
  }

  // 4. Check if cron ran today
  console.log('\n\n4. CHECKING FOR PROCESSING EVIDENCE:');
  const { data: processedPosts } = await supabase
    .from('linkedin_posts_discovered')
    .select('id, status, comment_generated_at')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .not('comment_generated_at', 'is', null)
    .order('comment_generated_at', { ascending: false })
    .limit(5);

  if (processedPosts && processedPosts.length > 0) {
    console.log('   Last processed posts:');
    for (const p of processedPosts) {
      console.log('   - ' + p.comment_generated_at + ' (' + p.status + ')');
    }
  } else {
    console.log('   ❌ No posts have been processed yet');
  }

  // 5. Check workspace members for Brian's account
  console.log('\n\n5. WORKSPACE INTEGRATIONS:');
  const { data: integrations } = await supabase
    .from('workspace_integrations')
    .select('*')
    .eq('workspace_id', BRIAN_WORKSPACE_ID);

  if (integrations && integrations.length > 0) {
    console.log('   Found ' + integrations.length + ' integrations');
    for (const i of integrations) {
      console.log('   - ' + JSON.stringify(i));
    }
  } else {
    console.log('   No integrations found in workspace_integrations');
  }

  console.log('\n' + '='.repeat(60));
}

diagnose().catch(console.error);
