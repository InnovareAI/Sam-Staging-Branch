const https = require('https');

const options = {
  hostname: 'latxadqrvrrrcvkktrog.supabase.co',
  path: '/rest/v1/reply_agent_drafts?id=eq.4b95c0bf-3b17-417b-8dbe-3c5ea18937e0&select=draft_text,research_linkedin_profile,research_company_profile,research_website',
  method: 'GET',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data)[0];
    console.log('=== DRAFT TEXT ===');
    console.log(result.draft_text);
    console.log('\n=== LINKEDIN RESEARCH ===');
    console.log(JSON.stringify(result.research_linkedin_profile, null, 2));
    console.log('\n=== COMPANY RESEARCH ===');
    console.log(JSON.stringify(result.research_company_profile, null, 2));
    console.log('\n=== WEBSITE RESEARCH ===');
    console.log(JSON.stringify(result.research_website, null, 2));
  });
});
req.end();
