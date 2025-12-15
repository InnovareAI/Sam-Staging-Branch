const https = require('https');
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

// Get 5 recent discovered posts that can be commented on
const req = https.request({
  hostname: 'latxadqrvrrrcvkktrog.supabase.co',
  path: '/rest/v1/linkedin_posts_discovered?select=id,author_name,author_headline,post_content,share_url,status,hashtags,created_at&status=in.(discovered,processing)&order=created_at.desc&limit=10',
  method: 'GET',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const posts = JSON.parse(data);
    console.log('📬 Available Posts to Comment On\n');
    console.log('================================\n');

    if (!Array.isArray(posts) || posts.length === 0) {
      console.log('No posts found with discovered/processing status.');
      console.log('Checking all recent posts...\n');

      // Try fetching all recent posts regardless of status
      const req2 = https.request({
        hostname: 'latxadqrvrrrcvkktrog.supabase.co',
        path: '/rest/v1/linkedin_posts_discovered?select=id,author_name,author_headline,post_content,share_url,status,hashtags,created_at&order=created_at.desc&limit=10',
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY
        }
      }, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          const allPosts = JSON.parse(data2);
          if (!Array.isArray(allPosts) || allPosts.length === 0) {
            console.log('No posts in database. Need to run discovery.');
            return;
          }

          console.log('Found ' + allPosts.length + ' posts (any status):\n');
          allPosts.slice(0, 5).forEach((p, idx) => {
            console.log('POST ' + (idx + 1) + ': ' + p.author_name);
            console.log('   Headline: ' + (p.author_headline || 'N/A').substring(0, 60));
            console.log('   Content: ' + (p.post_content || '').substring(0, 150) + '...');
            console.log('   Status: ' + p.status);
            console.log('   ID: ' + p.id);
            console.log('');
          });
        });
      });
      req2.end();
      return;
    }

    posts.slice(0, 5).forEach((p, idx) => {
      console.log('POST ' + (idx + 1) + ': ' + p.author_name);
      console.log('   Headline: ' + (p.author_headline || 'N/A').substring(0, 60));
      console.log('   Content: ' + (p.post_content || '').substring(0, 150) + '...');
      console.log('   Status: ' + p.status);
      console.log('   ID: ' + p.id);
      console.log('');
    });
  });
});
req.end();
