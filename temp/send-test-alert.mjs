import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function sendAlert() {
  // Get the Techstars campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id')
    .eq('id', '64663df2-3f12-47eb-aaa9-6287a5a07777')
    .single();

  if (!campaign) {
    console.log('Campaign not found');
    return;
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', campaign.workspace_id)
    .single();

  console.log('Campaign:', campaign.name);
  console.log('Workspace:', workspace?.name);

  // Send alert
  const webhookUrl = 'https://chat.googleapis.com/v1/spaces/AAQAJqjPkBY/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=hQHJlg-4CmazwyWTdiBO4IrbD5MpexRQoellhDjOKpc';
  const downloadUrl = 'https://app.meet-sam.com/api/campaigns/' + campaign.id + '/failed-prospects-csv';
  const resetUrl = 'https://app.meet-sam.com/api/campaigns/' + campaign.id + '/reset-failed';

  const message = {
    cardsV2: [{
      cardId: 'alert-' + Date.now(),
      card: {
        header: {
          title: '⚠️ Failed Prospects Alert',
          subtitle: new Date().toLocaleString(),
          imageType: 'CIRCLE'
        },
        sections: [
          {
            widgets: [
              { decoratedText: { topLabel: 'Campaign', text: '<b>' + campaign.name + '</b>', startIcon: { knownIcon: 'BOOKMARK' } } },
              { decoratedText: { topLabel: 'Workspace', text: workspace?.name || 'Unknown', startIcon: { knownIcon: 'PERSON' } } },
              { decoratedText: { topLabel: 'Failed (24h)', text: '<b>8</b> prospects', startIcon: { knownIcon: 'CLOCK' } } }
            ]
          },
          {
            header: 'Top Error',
            widgets: [
              { decoratedText: { topLabel: '8x', text: 'LinkedIn profile not found or inaccessible', startIcon: { knownIcon: 'BOOKMARK' } } }
            ]
          },
          {
            widgets: [{
              buttonList: {
                buttons: [
                  { text: '📥 Download CSV', onClick: { openLink: { url: downloadUrl } }, color: { red: 0.063, green: 0.722, blue: 0.506, alpha: 1 } },
                  { text: '🔄 Reset & Retry', onClick: { openLink: { url: resetUrl } }, color: { red: 0.937, green: 0.604, blue: 0.063, alpha: 1 } }
                ]
              }
            }]
          }
        ]
      }
    }]
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
  console.log('Alert sent:', res.ok ? 'SUCCESS' : 'FAILED');
}

sendAlert();
