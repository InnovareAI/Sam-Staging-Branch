import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

async function checkComments() {
  console.log('CHECKING BRIAN\'S GENERATED COMMENTS');
  console.log('='.repeat(60));

  const { data: comments } = await supabase
    .from('linkedin_post_comments')
    .select('id, comment_text, generation_metadata, status')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .eq('status', 'pending_approval')
    .order('generated_at', { ascending: false })
    .limit(10);

  console.log('\nGENERATED COMMENTS:');
  for (const c of comments || []) {
    console.log('\n---');
    console.log('Comment: ' + c.comment_text);
    console.log('Metadata: ' + JSON.stringify(c.generation_metadata));
  }

  // Check for patterns
  console.log('\n\nPATTERN ANALYSIS:');
  const texts = (comments || []).map(c => c.comment_text);

  // Check starting words
  const starters = texts.map(t => t.split(' ').slice(0, 3).join(' '));
  console.log('Starting words:');
  for (const s of starters) {
    console.log('  - ' + s);
  }

  // Check for repeated phrases
  const phrases = ['Great insights', 'Thanks for sharing', 'This is exactly', 'Fascinating', 'Impressive', 'Exciting to see'];
  console.log('\nRepeated phrase check:');
  for (const phrase of phrases) {
    const count = texts.filter(t => t.toLowerCase().includes(phrase.toLowerCase())).length;
    if (count > 1) {
      console.log('  ⚠️  "' + phrase + '" appears in ' + count + ' comments');
    }
  }
}

checkComments().catch(console.error);
