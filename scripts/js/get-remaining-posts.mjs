#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read env from file
function getEnvVar(name) {
  try {
    const envContent = readFileSync('.env.local', 'utf8');
    const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

const url = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

if (!url || !key) {
  console.error('Missing Supabase URL or key');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  // Get discovered posts
  const { data: discovered, error: e1 } = await supabase
    .from('linkedin_posts_discovered')
    .select('id, post_content')
    .eq('workspace_id', workspaceId)
    .eq('status', 'discovered');

  if (e1) {
    console.error('Error:', e1);
    return;
  }

  // Get posts with comments
  const { data: withComments, error: e2 } = await supabase
    .from('linkedin_post_comments')
    .select('post_id')
    .eq('workspace_id', workspaceId);

  if (e2) {
    console.error('Error:', e2);
    return;
  }

  const hasCommentIds = new Set(withComments.map(c => c.post_id));
  const needsComments = discovered.filter(p => !hasCommentIds.has(p.id));

  console.log(`Total discovered: ${discovered.length}`);
  console.log(`Have comments: ${withComments.length}`);
  console.log(`Need comments: ${needsComments.length}`);

  if (needsComments.length > 0) {
    console.log('\nPost IDs needing comments:');
    console.log(JSON.stringify(needsComments.map(p => p.id)));

    // Show first 3 post contents for context
    console.log('\nSample posts:');
    needsComments.slice(0, 3).forEach((p, i) => {
      console.log(`\n${i+1}. ${p.id.substring(0, 8)}...`);
      console.log(`   "${p.post_content?.substring(0, 100)}..."`);
    });
  }
}

main();
