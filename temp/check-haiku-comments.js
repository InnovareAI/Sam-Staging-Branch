const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('linkedin_post_comments')
    .select('id, comment_text, generation_metadata, status, created_at')
    .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n🎯 HAIKU 4.5 GENERATED COMMENTS:\n');
  data.forEach((comment, i) => {
    const model = comment.generation_metadata?.model || 'unknown';
    const confidence = comment.generation_metadata?.confidence_score || 0;
    console.log(`${i+1}. Model: ${model} | Confidence: ${confidence.toFixed(2)}`);
    console.log(`   "${comment.comment_text.substring(0, 150)}..."\n`);
  });
})();
