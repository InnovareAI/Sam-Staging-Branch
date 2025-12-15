const https = require('https');
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const brianId = 'b7c12560-9e24-4430-9ff9-bf738ba9c235';
const tvonlinzId = '4796a8c0-c5da-4894-804c-88e1217afdb9';

function supabaseGet(path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: path,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ error: data });
        }
      });
    });
    req.end();
  });
}

async function check() {
  console.log('🔍 Checking Commenting Agent Status\n');
  console.log('=====================================\n');

  // 1. Check monitors
  console.log('📊 MONITORS:');
  const monitors = await supabaseGet('/rest/v1/linkedin_post_monitors?select=id,name,status,last_scraped_at&or=(id.eq.' + brianId + ',id.eq.' + tvonlinzId + ')');

  if (Array.isArray(monitors)) {
    monitors.forEach(m => {
      const icon = m.status === 'active' ? '✅' : '⏸️';
      console.log(`   ${icon} ${m.name}`);
      console.log(`      Status: ${m.status}`);
      console.log(`      Last scraped: ${m.last_scraped_at || 'Never'}`);
      console.log('');
    });
  }

  // 2. Check discovered posts for these monitors
  console.log('📬 DISCOVERED POSTS:');
  const posts = await supabaseGet('/rest/v1/linkedin_posts_discovered?select=id,monitor_id,share_url,author_name,status,approval_status,created_at&or=(monitor_id.eq.' + brianId + ',monitor_id.eq.' + tvonlinzId + ')&order=created_at.desc&limit=10');

  if (Array.isArray(posts) && posts.length > 0) {
    posts.forEach(p => {
      const monitorName = p.monitor_id === brianId ? 'Brian' : 'tvonlinz';
      console.log(`   [${monitorName}] ${p.author_name}`);
      console.log(`      Status: ${p.status} | Approval: ${p.approval_status}`);
      console.log(`      Created: ${p.created_at}`);
      console.log('');
    });
  } else {
    console.log('   No posts discovered yet for these monitors.\n');
  }

  // 3. Check comments
  console.log('💬 COMMENTS:');
  const comments = await supabaseGet('/rest/v1/linkedin_post_comments?select=id,post_id,comment_text,status,created_at&order=created_at.desc&limit=10');

  if (Array.isArray(comments) && comments.length > 0) {
    // Filter to only show comments for our monitors' posts
    const ourPostIds = Array.isArray(posts) ? posts.map(p => p.id) : [];
    const ourComments = comments.filter(c => ourPostIds.includes(c.post_id));

    if (ourComments.length > 0) {
      ourComments.forEach(c => {
        console.log(`   Status: ${c.status}`);
        console.log(`   Comment: ${c.comment_text?.substring(0, 100)}...`);
        console.log(`   Created: ${c.created_at}`);
        console.log('');
      });
    } else {
      console.log('   No comments generated for Brian/tvonlinz posts yet.\n');
    }

    console.log(`   (Total comments in system: ${comments.length})`);
  } else {
    console.log('   No comments in system.\n');
  }

  // 4. Summary
  console.log('\n=====================================');
  console.log('📋 SUMMARY');
  console.log('=====================================\n');

  const activeMonitors = Array.isArray(monitors) ? monitors.filter(m => m.status === 'active').length : 0;
  const postCount = Array.isArray(posts) ? posts.length : 0;

  console.log(`   Active monitors: ${activeMonitors}/2`);
  console.log(`   Discovered posts: ${postCount}`);

  if (postCount === 0) {
    console.log('\n   ⚠️  No posts discovered yet.');
    console.log('   The commenting agent needs to scrape LinkedIn for posts.');
    console.log('   This typically happens via N8N workflow or manual trigger.\n');
  }
}

check();
