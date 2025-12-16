import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

async function diagnoseBrian() {
  console.log('BRIAN NEIRBY WORKSPACE DIAGNOSTIC');
  console.log('Workspace ID: ' + BRIAN_WORKSPACE_ID);
  console.log('='.repeat(60));

  // 1. Brian's monitors
  console.log('\n1. BRIAN\'S MONITORS:');
  const { data: monitors, error: monitorsError } = await supabase
    .from('linkedin_post_monitors')
    .select('*')
    .eq('workspace_id', BRIAN_WORKSPACE_ID);

  if (monitorsError) {
    console.error('Error:', monitorsError.message);
  } else {
    console.log('   Found ' + monitors.length + ' monitors');
    for (const m of monitors) {
      console.log('\n   Monitor: ' + m.name);
      console.log('   Status: ' + m.status);
      console.log('   Hashtags: ' + JSON.stringify(m.hashtags));
      console.log('   Auto-approve: ' + m.auto_approve_enabled);
      console.log('   Created: ' + m.created_at);
    }
  }

  // 2. Brian's discovered posts
  console.log('\n\n2. BRIAN\'S DISCOVERED POSTS:');
  const { data: posts, error: postsError } = await supabase
    .from('linkedin_posts_discovered')
    .select('*')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (postsError) {
    console.error('Error:', postsError.message);
  } else if (!posts || posts.length === 0) {
    console.log('   ❌ NO POSTS DISCOVERED FOR BRIAN');
  } else {
    console.log('   Found ' + posts.length + ' posts');
    for (const p of posts) {
      console.log('\n   Post by: ' + p.author_name);
      console.log('   Status: ' + p.status);
      console.log('   Discovered: ' + p.created_at);
      console.log('   Content preview: ' + (p.post_content || '').substring(0, 100) + '...');
    }
  }

  // 3. Brian's comments
  console.log('\n\n3. BRIAN\'S GENERATED COMMENTS:');
  const { data: comments, error: commentsError } = await supabase
    .from('linkedin_post_comments')
    .select('*')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .order('generated_at', { ascending: false })
    .limit(10);

  if (commentsError) {
    console.error('Error:', commentsError.message);
  } else if (!comments || comments.length === 0) {
    console.log('   ❌ NO COMMENTS GENERATED FOR BRIAN');
  } else {
    console.log('   Found ' + comments.length + ' comments');
    for (const c of comments) {
      console.log('\n   Comment ID: ' + c.id);
      console.log('   Status: ' + c.status);
      console.log('   Generated: ' + c.generated_at);
      console.log('   Scheduled: ' + c.scheduled_post_time);
      console.log('   Posted: ' + c.posted_at);
      console.log('   Text: ' + (c.comment_text || '').substring(0, 150) + '...');
    }
  }

  // 4. Brian's brand guidelines
  console.log('\n\n4. BRIAN\'S BRAND GUIDELINES:');
  const { data: guidelines, error: guidelinesError } = await supabase
    .from('linkedin_brand_guidelines')
    .select('*')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .single();

  if (guidelinesError) {
    console.error('Error:', guidelinesError.message);
  } else if (!guidelines) {
    console.log('   ❌ NO BRAND GUIDELINES FOR BRIAN');
  } else {
    console.log('   Tone: ' + guidelines.tone_of_voice);
    console.log('   Created: ' + guidelines.created_at);
  }

  // 5. Check for unipile_accounts table (correct table name)
  console.log('\n\n5. LINKEDIN/UNIPILE ACCOUNTS:');
  const { data: unipileAccounts, error: unipileError } = await supabase
    .from('unipile_accounts')
    .select('*')
    .eq('workspace_id', BRIAN_WORKSPACE_ID);

  if (unipileError) {
    console.log('   unipile_accounts table error: ' + unipileError.message);
  } else if (!unipileAccounts || unipileAccounts.length === 0) {
    console.log('   ❌ NO UNIPILE ACCOUNTS FOR BRIAN');
  } else {
    console.log('   Found ' + unipileAccounts.length + ' accounts');
    for (const a of unipileAccounts) {
      console.log('   - ' + (a.account_name || a.provider_account_name || 'Unnamed'));
      console.log('     Status: ' + a.connection_status);
      console.log('     Account ID: ' + a.account_id);
    }
  }

  // Also check commenting_settings
  console.log('\n\n6. COMMENTING SETTINGS:');
  const { data: commentSettings, error: csError } = await supabase
    .from('linkedin_commenting_settings')
    .select('*')
    .eq('workspace_id', BRIAN_WORKSPACE_ID);

  if (csError) {
    console.log('   Table error: ' + csError.message);
  } else if (!commentSettings || commentSettings.length === 0) {
    console.log('   ❌ NO COMMENTING SETTINGS FOR BRIAN');
  } else {
    console.log('   Found settings:');
    for (const s of commentSettings) {
      console.log('   Enabled: ' + s.enabled);
      console.log('   Daily limit: ' + s.daily_limit);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSIS COMPLETE');
}

diagnoseBrian().catch(console.error);
