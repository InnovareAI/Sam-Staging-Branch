import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const BRIAN_UNIPILE_ID = 'RFrEaJZOSGieognCTW0V6w';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

async function handleComments() {
  console.log('POSTING BRIAN\'S APPROVED COMMENTS');
  console.log('='.repeat(60));

  // 1. Get approved comments (status = 'scheduled')
  const { data: approved, error } = await supabase
    .from('linkedin_post_comments')
    .select(`
      id,
      comment_text,
      status,
      post:linkedin_posts_discovered!inner (
        id,
        social_id,
        share_url,
        author_name
      )
    `)
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'scheduled')
    .order('approved_at', { ascending: true });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('\nAPPROVED COMMENTS: ' + (approved?.length || 0));

  if (!approved || approved.length === 0) {
    console.log('No approved comments found');
    return;
  }

  for (const c of approved) {
    console.log('\n- ' + c.post.author_name);
    console.log('  ' + c.comment_text.substring(0, 80) + '...');
  }

  // 2. POST FIRST COMMENT NOW
  const firstComment = approved[0];
  console.log('\n\n' + '='.repeat(60));
  console.log('POSTING FIRST COMMENT NOW...');
  console.log('To: ' + firstComment.post.author_name);

  // Get post social_id - need to resolve activity ID to ugcPost ID
  let postSocialId = firstComment.post.social_id;

  // Extract from share_url if needed
  if (!postSocialId || !postSocialId.startsWith('urn:li:')) {
    const activityMatch = firstComment.post.share_url?.match(/activity-(\d+)/);
    if (activityMatch) {
      postSocialId = 'urn:li:activity:' + activityMatch[1];
    }
  }

  console.log('Post ID: ' + postSocialId);

  // Resolve to ugcPost ID
  const resolveResponse = await fetch(
    `https://${UNIPILE_DSN}/api/v1/posts/${encodeURIComponent(postSocialId)}?account_id=${BRIAN_UNIPILE_ID}`,
    {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!resolveResponse.ok) {
    console.error('Failed to resolve post ID:', await resolveResponse.text());
    return;
  }

  const postData = await resolveResponse.json();
  const ugcPostId = postData.social_id || postSocialId;
  console.log('Resolved to: ' + ugcPostId);

  // Post the comment
  const commentResponse = await fetch(
    `https://${UNIPILE_DSN}/api/v1/posts/${encodeURIComponent(ugcPostId)}/comments`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_id: BRIAN_UNIPILE_ID,
        text: firstComment.comment_text
      })
    }
  );

  if (!commentResponse.ok) {
    const errorText = await commentResponse.text();
    console.error('Failed to post comment:', errorText);

    // Update status to failed
    await supabase
      .from('linkedin_post_comments')
      .update({ status: 'failed', failure_reason: errorText })
      .eq('id', firstComment.id);
    return;
  }

  const commentResult = await commentResponse.json();
  console.log('✅ COMMENT POSTED!');
  console.log('LinkedIn Comment ID: ' + (commentResult.id || commentResult.object?.id));

  // Update DB
  await supabase
    .from('linkedin_post_comments')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      unipile_comment_id: commentResult.id || commentResult.object?.id
    })
    .eq('id', firstComment.id);

  await supabase
    .from('linkedin_posts_discovered')
    .update({ status: 'commented' })
    .eq('id', firstComment.post.id);

  // 3. SCHEDULE SECOND COMMENT FOR LATE AFTERNOON (4 PM Berlin = 3 PM UTC)
  if (approved.length >= 2) {
    const secondComment = approved[1];

    // 4 PM Berlin time today
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setUTCHours(15, 0, 0, 0); // 3 PM UTC = 4 PM Berlin (CET)

    // If it's already past 4 PM Berlin, schedule for tomorrow
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('SCHEDULING SECOND COMMENT FOR ' + scheduledTime.toISOString());
    console.log('To: ' + secondComment.post.author_name);

    await supabase
      .from('linkedin_post_comments')
      .update({
        scheduled_post_time: scheduledTime.toISOString()
      })
      .eq('id', secondComment.id);

    console.log('✅ Scheduled for 4 PM Berlin time');
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
}

handleComments().catch(console.error);
