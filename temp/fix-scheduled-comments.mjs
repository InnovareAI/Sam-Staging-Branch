import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

async function fixComments() {
  console.log('CLEANING UP BRIAN\'S COMMENTS');
  console.log('='.repeat(60));

  // 1. Get all scheduled comments
  const { data: scheduled } = await supabase
    .from('linkedin_post_comments')
    .select('id, comment_text, status, generation_metadata')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'scheduled');

  console.log('\nSCHEDULED COMMENTS:');
  const badComments = [];
  const goodComments = [];

  for (const c of scheduled || []) {
    const isBrianVoice = c.generation_metadata?.uses_brian_guidelines === true;
    const isGeneric = c.comment_text.includes('exactly what the industry needs') ||
                      c.comment_text.includes('Great insights') ||
                      c.comment_text.includes('Fascinating perspective') ||
                      c.comment_text.includes('Thanks for sharing');

    if (isGeneric || !isBrianVoice) {
      badComments.push(c);
      console.log('\n❌ BAD (generic): ' + c.comment_text.substring(0, 60) + '...');
    } else {
      goodComments.push(c);
      console.log('\n✅ GOOD (Brian\'s voice): ' + c.comment_text.substring(0, 60) + '...');
    }
  }

  // 2. Delete bad comments
  if (badComments.length > 0) {
    console.log('\n\nDELETING ' + badComments.length + ' BAD COMMENTS...');
    const badIds = badComments.map(c => c.id);
    await supabase
      .from('linkedin_post_comments')
      .delete()
      .in('id', badIds);
    console.log('✅ Deleted');
  }

  // 3. Show remaining good comments
  console.log('\n\nREMAINING GOOD COMMENTS:');
  for (const c of goodComments) {
    console.log('\n- ' + c.comment_text);
  }

  // 4. Get pending_approval comments with Brian's voice
  console.log('\n\n' + '='.repeat(60));
  console.log('PENDING APPROVAL (Brian\'s voice):');

  const { data: pending } = await supabase
    .from('linkedin_post_comments')
    .select(`
      id,
      comment_text,
      generation_metadata,
      post:linkedin_posts_discovered(author_name)
    `)
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'pending_approval');

  for (const c of pending || []) {
    const isBrianVoice = c.generation_metadata?.uses_brian_guidelines === true;
    if (isBrianVoice) {
      console.log('\n✅ ' + c.post.author_name + ':');
      console.log('   ' + c.comment_text);
    }
  }

  console.log('\n' + '='.repeat(60));
}

fixComments().catch(console.error);
