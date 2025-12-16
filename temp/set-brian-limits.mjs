import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

async function setBrianLimits() {
  console.log('SETTING BRIAN\'S COMMENTING AGENT CONFIG');
  console.log('='.repeat(60));
  console.log('\nTarget: 10 options in digest, you pick 2 to post');
  console.log('Posting times: ~9 AM and ~3 PM Berlin time');

  // 1. Update monitor metadata
  console.log('\n1. UPDATING MONITOR SETTINGS...');

  const { data: monitors } = await supabase
    .from('linkedin_post_monitors')
    .select('id, name, metadata')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'active');

  for (const monitor of monitors || []) {
    const currentMetadata = monitor.metadata || {};

    const newMetadata = {
      ...currentMetadata,

      // GENERATION: 10 comments per day (for digest selection)
      daily_comment_limit: 10,

      // POSTING: 2 comments per day (user picks from 10)
      daily_post_limit: 2,

      // Posting schedule: Morning + Afternoon (Berlin time = UTC+1)
      // 9 AM Berlin = 8 AM UTC
      // 3 PM Berlin = 2 PM UTC
      posting_schedule: {
        timezone: 'Europe/Berlin',
        slots: [
          { hour: 9, minute: 0, label: 'morning' },
          { hour: 15, minute: 0, label: 'afternoon' }
        ]
      },

      // Relaxed filtering for datacenter industry content
      skip_job_posts: true,        // Skip "we're hiring" posts
      skip_milestone_posts: true,  // Skip "I'm happy to announce" posts
      skip_event_posts: false,     // ALLOW event/conference posts (relevant for datacenter)
      skip_video_posts: true,      // Skip video-only posts (AI can't analyze)

      // Allow company/industry news (important for datacenter)
      allowed_post_types: [
        'thought_leadership',
        'industry_news',
        'company_update',
        'product_launch',
        'analysis',
        'opinion',
        'event_recap'  // Allow event recaps (different from promos)
      ],

      // Auto-refill: trigger search when discovered posts < 10
      auto_refill_enabled: true,
      auto_refill_threshold: 10,

      // Randomizer settings
      randomizer_enabled: true,
      skip_day_probability: 0.05, // 5% chance to skip (almost never)
      comment_delay_min_hours: 1,  // Wait 1-3 hours before commenting
      comment_delay_max_hours: 3
    };

    const { error } = await supabase
      .from('linkedin_post_monitors')
      .update({ metadata: newMetadata })
      .eq('id', monitor.id);

    if (error) {
      console.error('Error updating ' + monitor.name + ':', error.message);
    } else {
      console.log('   ✅ Updated: ' + monitor.name);
      console.log('      Generation limit: 10/day');
      console.log('      Post limit: 2/day');
      console.log('      Posting: 9 AM + 3 PM Berlin');
    }
  }

  // 2. Reset incorrectly filtered posts
  console.log('\n2. RESETTING FILTERED DATACENTER POSTS...');

  const { data: skippedPosts } = await supabase
    .from('linkedin_posts_discovered')
    .select('id, author_name, post_content, status')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'skipped')
    .limit(50);

  const datacenterKeywords = ['datacenter', 'data center', 'data centre', 'cooling', 'hpc', 'infrastructure', 'nvidia', 'ai infrastructure', 'power', 'energy', 'liquid cooling', 'hyperscale'];

  const postsToReset = [];
  for (const post of skippedPosts || []) {
    const content = (post.post_content || '').toLowerCase();
    const isDatacenter = datacenterKeywords.some(kw => content.includes(kw));

    // Don't reset job announcements
    const isJob = content.includes('new position') || content.includes("i'm happy to share that i") || content.includes('hiring');

    if (isDatacenter && !isJob) {
      postsToReset.push(post.id);
      console.log('   Resetting: ' + post.author_name);
    }
  }

  if (postsToReset.length > 0) {
    await supabase
      .from('linkedin_posts_discovered')
      .update({ status: 'discovered', comment_generated_at: null })
      .in('id', postsToReset);
    console.log('   ✅ Reset ' + postsToReset.length + ' posts');
  }

  // 3. Show queue status
  console.log('\n3. CURRENT QUEUE STATUS:');

  const { count: discoveredCount } = await supabase
    .from('linkedin_posts_discovered')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'discovered');

  const { count: pendingCount } = await supabase
    .from('linkedin_post_comments')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'pending_approval');

  console.log('   Posts ready for comments: ' + discoveredCount);
  console.log('   Comments pending your approval: ' + pendingCount);

  console.log('\n' + '='.repeat(60));
  console.log('CONFIG COMPLETE');
  console.log('\n📧 Daily Digest Flow:');
  console.log('   1. You receive email with 10 posts + AI comments');
  console.log('   2. Click "Approve" on the 2 best ones');
  console.log('   3. First approved → posts at 9 AM Berlin');
  console.log('   4. Second approved → posts at 3 PM Berlin');
  console.log('\n⚠️  BLOCKER: Brian must connect LinkedIn account to post!');
}

setBrianLimits().catch(console.error);
