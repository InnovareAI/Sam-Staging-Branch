import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const BRIAN_UNIPILE_ID = 'RFrEaJZOSGieognCTW0V6w';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

async function postGoodComments() {
  console.log('POSTING GOOD COMMENTS');
  console.log('='.repeat(60));

  // Get scheduled comments with Brian's voice
  const { data: scheduled } = await supabase
    .from('linkedin_post_comments')
    .select(`
      id,
      comment_text,
      generation_metadata,
      post:linkedin_posts_discovered!inner (
        id,
        social_id,
        share_url,
        author_name
      )
    `)
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'scheduled');

  const goodComments = scheduled?.filter(c => c.generation_metadata?.uses_brian_guidelines) || [];

  console.log('\nGOOD SCHEDULED COMMENTS: ' + goodComments.length);
  for (const c of goodComments) {
    console.log('\n- ' + c.post.author_name + ':');
    console.log('  ' + c.comment_text.substring(0, 80) + '...');
  }

  if (goodComments.length === 0) {
    console.log('No good comments to post');
    return;
  }

  // POST FIRST GOOD COMMENT NOW
  const first = goodComments[0];
  console.log('\n\n' + '='.repeat(60));
  console.log('POSTING NOW: ' + first.post.author_name);

  let postSocialId = first.post.social_id;
  if (!postSocialId || !postSocialId.startsWith('urn:li:')) {
    const match = first.post.share_url?.match(/activity-(\d+)/);
    if (match) postSocialId = 'urn:li:activity:' + match[1];
  }

  // Resolve post ID
  const resolveRes = await fetch(
    `https://${UNIPILE_DSN}/api/v1/posts/${encodeURIComponent(postSocialId)}?account_id=${BRIAN_UNIPILE_ID}`,
    { headers: { 'X-API-KEY': UNIPILE_API_KEY } }
  );

  if (!resolveRes.ok) {
    console.error('Failed to resolve:', await resolveRes.text());
    return;
  }

  const postData = await resolveRes.json();
  const ugcPostId = postData.social_id || postSocialId;

  // Post comment
  const postRes = await fetch(
    `https://${UNIPILE_DSN}/api/v1/posts/${encodeURIComponent(ugcPostId)}/comments`,
    {
      method: 'POST',
      headers: { 'X-API-KEY': UNIPILE_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: BRIAN_UNIPILE_ID, text: first.comment_text })
    }
  );

  if (!postRes.ok) {
    console.error('Failed to post:', await postRes.text());
    return;
  }

  const result = await postRes.json();
  console.log('✅ POSTED!');

  await supabase
    .from('linkedin_post_comments')
    .update({ status: 'posted', posted_at: new Date().toISOString() })
    .eq('id', first.id);

  await supabase
    .from('linkedin_posts_discovered')
    .update({ status: 'commented' })
    .eq('id', first.post.id);

  // SCHEDULE SECOND FOR 4PM BERLIN TODAY
  if (goodComments.length >= 2) {
    const second = goodComments[1];

    // 4 PM Berlin = 3 PM UTC
    const today = new Date();
    const scheduled = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      15, 0, 0 // 3 PM UTC = 4 PM Berlin
    ));

    console.log('\n\n' + '='.repeat(60));
    console.log('SCHEDULING FOR 4PM BERLIN: ' + second.post.author_name);
    console.log('Time: ' + scheduled.toISOString());

    await supabase
      .from('linkedin_post_comments')
      .update({ scheduled_post_time: scheduled.toISOString() })
      .eq('id', second.id);

    console.log('✅ Scheduled');
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
}

postGoodComments().catch(console.error);
