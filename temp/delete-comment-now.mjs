import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://latxadqrvrrrcvkktrog.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ');

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const BRIAN_UNIPILE_ID = 'RFrEaJZOSGieognCTW0V6w';

async function deleteComment() {
  // Find the just-posted comment
  const { data: posted } = await supabase
    .from('linkedin_post_comments')
    .select('id, unipile_comment_id, comment_text, post:linkedin_posts_discovered(social_id, share_url, author_name)')
    .eq('workspace_id', 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(1);

  if (!posted || posted.length === 0) {
    console.log('No posted comment found');
    return;
  }

  const comment = posted[0];
  console.log('DELETING COMMENT:');
  console.log('On post by:', comment.post?.author_name);
  console.log('Comment ID:', comment.unipile_comment_id);
  console.log('Text:', comment.comment_text?.substring(0, 50));

  if (comment.unipile_comment_id) {
    // Delete via Unipile API
    const res = await fetch(
      `https://${UNIPILE_DSN}/api/v1/posts/comments/${comment.unipile_comment_id}?account_id=${BRIAN_UNIPILE_ID}`,
      {
        method: 'DELETE',
        headers: { 'X-API-KEY': UNIPILE_API_KEY }
      }
    );

    console.log('Delete status:', res.status);
    const text = await res.text();
    console.log('Response:', text);

    if (res.ok || res.status === 204 || res.status === 200) {
      await supabase
        .from('linkedin_post_comments')
        .update({ status: 'deleted', deleted_at: new Date().toISOString() })
        .eq('id', comment.id);
      console.log('✅ DELETED FROM LINKEDIN');
    }
  } else {
    console.log('No Unipile comment ID - trying to find and delete manually');
    // Get the post social ID
    let postId = comment.post?.social_id;
    if (!postId && comment.post?.share_url) {
      const match = comment.post.share_url.match(/activity-(\d+)/);
      if (match) postId = 'urn:li:activity:' + match[1];
    }

    if (postId) {
      // Get comments on the post
      const commentsRes = await fetch(
        `https://${UNIPILE_DSN}/api/v1/posts/${encodeURIComponent(postId)}/comments?account_id=${BRIAN_UNIPILE_ID}`,
        { headers: { 'X-API-KEY': UNIPILE_API_KEY } }
      );

      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        console.log('Comments on post:', JSON.stringify(commentsData, null, 2));

        // Find Brian's comment
        const brianComment = commentsData.items?.find(c =>
          c.author?.id === 'ACoAAAD-i_IBPhZ311Obft4g7uzqA1W1rvR7s_E' ||
          c.text?.includes(comment.comment_text?.substring(0, 30))
        );

        if (brianComment) {
          console.log('Found Brian comment:', brianComment.id);
          const delRes = await fetch(
            `https://${UNIPILE_DSN}/api/v1/posts/comments/${brianComment.id}?account_id=${BRIAN_UNIPILE_ID}`,
            { method: 'DELETE', headers: { 'X-API-KEY': UNIPILE_API_KEY } }
          );
          console.log('Delete result:', delRes.status);
          if (delRes.ok || delRes.status === 204) {
            console.log('✅ DELETED FROM LINKEDIN');
          }
        }
      }
    }
  }
}

deleteComment().catch(console.error);
