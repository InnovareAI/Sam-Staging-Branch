import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnose() {
  console.log('LINKEDIN COMMENTING AGENT DIAGNOSTIC');
  console.log('='.repeat(60));

  // 1. Check all monitors
  console.log('\n1. ALL MONITORS:');
  const { data: monitors, error: monitorsError } = await supabase
    .from('linkedin_post_monitors')
    .select('id, workspace_id, name, status, hashtags, created_at')
    .order('created_at', { ascending: false });

  if (monitorsError) {
    console.error('Error fetching monitors:', monitorsError.message);
  } else if (!monitors || monitors.length === 0) {
    console.log('   ❌ NO MONITORS FOUND - This is the problem!');
  } else {
    console.log('   Found ' + monitors.length + ' monitors');
    for (const m of monitors) {
      console.log('   - ' + (m.name || 'Unnamed') + ' (' + m.status + ')');
      console.log('     Workspace: ' + m.workspace_id);
      console.log('     Hashtags: ' + JSON.stringify(m.hashtags));
    }
  }

  // 2. Check discovered posts
  console.log('\n2. DISCOVERED POSTS (last 20):');
  const { data: posts, error: postsError } = await supabase
    .from('linkedin_posts_discovered')
    .select('id, workspace_id, monitor_id, author_name, status, created_at, comment_generated_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (postsError) {
    console.error('Error fetching posts:', postsError.message);
  } else if (!posts || posts.length === 0) {
    console.log('   ❌ NO POSTS DISCOVERED - Discovery cron may not be running');
  } else {
    const statusCount = {};
    for (const p of posts) {
      statusCount[p.status] = (statusCount[p.status] || 0) + 1;
    }
    console.log('   Status breakdown: ' + JSON.stringify(statusCount));
    console.log('   Latest 5 posts:');
    for (const p of posts.slice(0, 5)) {
      console.log('   - ' + p.author_name + ' (' + p.status + ') - ' + p.created_at);
    }
  }

  // 3. Check generated comments
  console.log('\n3. GENERATED COMMENTS (last 20):');
  const { data: comments, error: commentsError } = await supabase
    .from('linkedin_post_comments')
    .select('id, workspace_id, status, generated_at, scheduled_post_time, posted_at')
    .order('generated_at', { ascending: false })
    .limit(20);

  if (commentsError) {
    console.error('Error fetching comments:', commentsError.message);
  } else if (!comments || comments.length === 0) {
    console.log('   ❌ NO COMMENTS GENERATED - Auto-generate cron may not be running');
  } else {
    const statusCount = {};
    for (const c of comments) {
      statusCount[c.status] = (statusCount[c.status] || 0) + 1;
    }
    console.log('   Status breakdown: ' + JSON.stringify(statusCount));
    console.log('   Latest 5 comments:');
    for (const c of comments.slice(0, 5)) {
      console.log('   - ' + c.status + ' - Generated: ' + c.generated_at + ' - Posted: ' + (c.posted_at || 'not yet'));
    }
  }

  // 4. Check workspaces with commenting enabled
  console.log('\n4. BRAND GUIDELINES:');
  const { data: settings, error: settingsError } = await supabase
    .from('linkedin_brand_guidelines')
    .select('workspace_id, tone_of_voice, created_at');

  if (settingsError) {
    console.error('Error fetching settings:', settingsError.message);
  } else if (!settings || settings.length === 0) {
    console.log('   ❌ NO BRAND GUIDELINES SET - Users need to configure commenting settings');
  } else {
    console.log('   ' + settings.length + ' workspaces have brand guidelines');
    for (const s of settings) {
      console.log('   - Workspace: ' + s.workspace_id);
    }
  }

  // 5. Check LinkedIn accounts
  console.log('\n5. LINKEDIN ACCOUNTS:');
  const { data: accounts, error: accountsError } = await supabase
    .from('linkedin_accounts')
    .select('id, workspace_id, account_name, connection_status, unipile_account_id');

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError.message);
  } else if (!accounts || accounts.length === 0) {
    console.log('   ❌ NO LINKEDIN ACCOUNTS - Cannot post comments');
  } else {
    console.log('   Found ' + accounts.length + ' LinkedIn accounts');
    for (const a of accounts) {
      console.log('   - ' + (a.account_name || 'Unnamed') + ' (' + a.connection_status + ')');
      console.log('     Workspace: ' + a.workspace_id);
    }
  }

  // 6. Check workspaces
  console.log('\n6. WORKSPACES:');
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name');

  if (wsError) {
    console.error('Error fetching workspaces:', wsError.message);
  } else {
    console.log('   Found ' + workspaces.length + ' workspaces');
    for (const w of workspaces) {
      console.log('   - ' + w.name + ' (' + w.id + ')');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSIS COMPLETE');
}

diagnose().catch(console.error);
