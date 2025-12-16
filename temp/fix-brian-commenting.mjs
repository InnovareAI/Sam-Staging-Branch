import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

async function fixBrian() {
  console.log('FIXING BRIAN\'S COMMENTING AGENT');
  console.log('='.repeat(60));

  // 1. Enable auto-approve on Brian's main monitor
  console.log('\n1. ENABLING AUTO-APPROVE ON BRIAN\'S MONITORS...');
  const { data: monitors, error: monitorsError } = await supabase
    .from('linkedin_post_monitors')
    .update({ auto_approve_enabled: true })
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .select();

  if (monitorsError) {
    console.error('Error updating monitors:', monitorsError.message);
  } else {
    console.log('   ✅ Updated ' + monitors.length + ' monitors to auto_approve_enabled = true');
  }

  // 2. Find good posts that should have comments (not filtered by leadership)
  console.log('\n2. FINDING COMMENTABLE POSTS...');
  const { data: posts } = await supabase
    .from('linkedin_posts_discovered')
    .select('id, author_name, post_content, status')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'discovered')
    .is('comment_generated_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  // Filter patterns (same as cron)
  const jobPatterns = ["we're hiring", "we are hiring", "open role", "open position", "join our team", "apply now", "looking for a", "job opening", "career opportunity", "now hiring", "hiring for", "apply today", "join us as", "seeking a", "looking to hire"];
  const milestonePatterns = ["work anniversary", "celebrating my", "years at", "thrilled to join", "excited to announce i've joined", "excited to share that i've joined", "new role", "new chapter", "thrilled to announce", "excited to start", "first day at", "officially joined", "joining the team", "i'm happy to share that i'm starting a new position"];
  const eventPatterns = ["register now", "webinar", "join us live", "live event", "conference", "summit", "sign up now", "rsvp", "register today", "save your spot", "grab your seat", "limited seats", "panel", "panelist", "keynote", "speaker at", "speaking at"];
  const socialPatterns = ["thanks to everyone", "thank you all", "grateful for"];

  const goodPosts = [];
  const filteredPosts = [];

  for (const p of posts || []) {
    const content = (p.post_content || '').toLowerCase();
    let filterReason = null;

    if (jobPatterns.some(pat => content.includes(pat))) filterReason = 'job_post';
    else if (milestonePatterns.some(pat => content.includes(pat))) filterReason = 'milestone';
    else if (eventPatterns.some(pat => content.includes(pat))) filterReason = 'event';
    else if (socialPatterns.some(pat => content.includes(pat))) filterReason = 'social';

    if (filterReason) {
      filteredPosts.push({ ...p, filterReason });
    } else {
      goodPosts.push(p);
    }
  }

  console.log('   Found ' + goodPosts.length + ' good posts (not filtered)');
  console.log('   Filtered out ' + filteredPosts.length + ' posts');

  if (filteredPosts.length > 0) {
    console.log('\n   Filtered posts:');
    for (const p of filteredPosts.slice(0, 5)) {
      console.log('   - ' + p.author_name + ' (' + p.filterReason + ')');
    }
  }

  if (goodPosts.length > 0) {
    console.log('\n   Good posts ready for comments:');
    for (const p of goodPosts.slice(0, 10)) {
      console.log('   - ' + p.author_name + ': ' + (p.post_content || '').substring(0, 60) + '...');
    }
  }

  // 3. Check if there's a LinkedIn account for Brian
  console.log('\n\n3. CHECKING FOR LINKEDIN ACCOUNT...');

  // Check all possible account tables
  const { data: wsIntegrations } = await supabase
    .from('workspace_linkedin_accounts')
    .select('*')
    .eq('workspace_id', BRIAN_WORKSPACE_ID);

  if (wsIntegrations && wsIntegrations.length > 0) {
    console.log('   ✅ Found LinkedIn account in workspace_linkedin_accounts');
    console.log('   ' + JSON.stringify(wsIntegrations[0]));
  } else {
    // Try unified_accounts
    const { data: unified } = await supabase
      .from('unified_accounts')
      .select('*')
      .eq('workspace_id', BRIAN_WORKSPACE_ID);

    if (unified && unified.length > 0) {
      console.log('   ✅ Found account in unified_accounts');
      for (const u of unified) {
        console.log('   - ' + (u.provider || 'unknown') + ': ' + (u.provider_account_name || u.account_id));
      }
    } else {
      console.log('   ❌ No LinkedIn account found for Brian');
      console.log('   Brian needs to connect his LinkedIn account in Settings → Integrations');
    }
  }

  // 4. Approve Brian's pending comments so they can be posted
  console.log('\n\n4. AUTO-APPROVING BRIAN\'S PENDING COMMENTS...');
  const { data: approved, error: approveError } = await supabase
    .from('linkedin_post_comments')
    .update({
      status: 'scheduled',
      approved_at: new Date().toISOString(),
      scheduled_post_time: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min from now
    })
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'pending_approval')
    .select();

  if (approveError) {
    console.error('Error approving comments:', approveError.message);
  } else if (approved && approved.length > 0) {
    console.log('   ✅ Approved ' + approved.length + ' comments');
    console.log('   First comment scheduled for: ' + approved[0].scheduled_post_time);
  } else {
    console.log('   No pending comments to approve');
  }

  console.log('\n' + '='.repeat(60));
  console.log('FIXES APPLIED');
  console.log('\nNext steps:');
  console.log('1. The auto-generate cron will process Brian\'s posts in the next 30 min run');
  console.log('2. ' + (approved?.length || 0) + ' comments are now scheduled to post');
  console.log('3. Verify Brian has a LinkedIn account connected');
}

fixBrian().catch(console.error);
