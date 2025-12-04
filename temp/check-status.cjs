const https = require('https');

const options = {
  hostname: 'latxadqrvrrrcvkktrog.supabase.co',
  path: '/rest/v1/send_queue?select=prospect_id&status=eq.sent&message_type=eq.connection_request',
  headers: {
    apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
  }
};

https.get(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const items = JSON.parse(body);
    console.log('Total sent CRs in queue:', items.length);

    const ids = items.map(i => i.prospect_id).slice(0, 50);
    const idsParam = ids.map(id => 'id.eq.' + id).join(',');

    const options2 = {
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: '/rest/v1/campaign_prospects?select=id,status,first_name&or=(' + idsParam + ')',
      headers: options.headers
    };

    https.get(options2, res2 => {
      let body2 = '';
      res2.on('data', chunk => body2 += chunk);
      res2.on('end', () => {
        const prospects = JSON.parse(body2);
        const byStatus = {};
        prospects.forEach(p => byStatus[p.status] = (byStatus[p.status] || 0) + 1);
        console.log('Status breakdown:', byStatus);

        const valid = ['connection_request_sent', 'connected', 'replied', 'messaging', 'already_invited'];
        const wrong = prospects.filter(p => !valid.includes(p.status));
        console.log('Wrong status count:', wrong.length);
        if (wrong.length > 0) {
          console.log('To fix:', wrong.map(p => ({id: p.id, status: p.status, name: p.first_name})));
        }
      });
    });
  });
});
