// Sync email replies from Jennifer's Unipile inbox to Airtable
// Flow: Unipile Inbox → Count Replies → Update Airtable Email Campaigns
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';
const JENNIFER_UNIPILE_ACCOUNT_ID = 'rV0czB_nTLC8KSRb69_zRg';

const AIRTABLE_API_KEY = 'patGjqqtngAUpsPPz.0b428b264625f558675671497d7a53a0eb0be01d1a8bb6365051c3d9839abdd7';
const AIRTABLE_BASE_ID = 'appo6ZgNqEWLtw66q';
const AIRTABLE_EMAIL_CAMPAIGNS_TABLE = 'tblvXRXztKCcyfvjP';

// Known campaign subject patterns from ReachInbox
// Format: { pattern: 'campaign_id' }
const CAMPAIGN_SUBJECTS = {
  'client acquisition strategy': 'IA/ Consulting',
  'Q1 pipeline': 'IA/ SMEs',
  'AI for your practice': 'IA/ Coaches',
  'predictable client pipeline': 'IA/ Financial',
  'build your client acquisition': 'IA/ Startup',
};

async function getJenniferInboxReplies() {
  console.log('📧 Fetching Jennifer inbox emails...');

  let allEmails = [];
  let cursor = null;
  let page = 1;

  // Paginate through all emails
  do {
    const url = `https://${UNIPILE_DSN}/api/v1/emails?account_id=${JENNIFER_UNIPILE_ACCOUNT_ID}&folder=INBOX&limit=100${cursor ? '&cursor=' + cursor : ''}`;

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (data.items) {
      allEmails = allEmails.concat(data.items);
    }

    cursor = data.cursor;
    console.log(`  Page ${page}: ${data.items?.length || 0} emails (total: ${allEmails.length})`);
    page++;

  } while (cursor && page <= 10); // Max 10 pages = 1000 emails

  // Filter to only replies (subjects starting with RE: or Re:)
  const replies = allEmails.filter(email => {
    const subject = email.subject || '';
    return subject.match(/^(RE:|Re:|re:)/i);
  });

  // Exclude bounces and system emails
  const validReplies = replies.filter(email => {
    const from = email.from_attendee?.identifier || '';
    const subject = email.subject || '';
    return !from.includes('mailer-daemon') &&
           !from.includes('postmaster') &&
           !subject.includes('Delivery Status') &&
           !subject.includes('Undeliverable') &&
           !subject.includes('Out of office') &&
           !subject.includes('AUTO:');
  });

  console.log(`  Total emails: ${allEmails.length}`);
  console.log(`  Replies (RE:): ${replies.length}`);
  console.log(`  Valid replies (excluding bounces): ${validReplies.length}`);

  return validReplies;
}

function categorizeReply(email) {
  const subject = (email.subject || '').toLowerCase();

  for (const [pattern, campaignPrefix] of Object.entries(CAMPAIGN_SUBJECTS)) {
    if (subject.includes(pattern.toLowerCase())) {
      return campaignPrefix;
    }
  }

  return 'Unknown';
}

async function updateAirtableReplies(replyCounts) {
  console.log('\n📊 Updating Airtable with reply counts...');

  // Get existing records from Airtable
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_EMAIL_CAMPAIGNS_TABLE}`,
    {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`
      }
    }
  );

  const data = await response.json();
  const records = data.records || [];

  // Update records with reply counts
  for (const record of records) {
    const campaignName = record.fields['Campaign Name'] || '';

    // Find matching reply count
    let replyCount = 0;
    for (const [prefix, count] of Object.entries(replyCounts)) {
      if (campaignName.startsWith(prefix)) {
        replyCount = count;
        break;
      }
    }

    if (replyCount > 0) {
      // Update this record
      await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_EMAIL_CAMPAIGNS_TABLE}/${record.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              'Emails Replied': replyCount,
              'Last Synced': new Date().toISOString()
            }
          })
        }
      );
      console.log(`  ✅ Updated ${campaignName}: ${replyCount} replies`);
    }
  }
}

async function sync() {
  console.log('=== Email Reply Sync (Unipile → Airtable) ===');
  console.log('Time:', new Date().toISOString());
  console.log('Account: Jennifer Fleming (jf@innovareai.com)');
  console.log('');

  try {
    // 1. Get replies from Jennifer's inbox
    const replies = await getJenniferInboxReplies();

    // 2. Categorize replies by campaign
    const replyCounts = {};
    const replyDetails = [];

    for (const reply of replies) {
      const category = categorizeReply(reply);
      replyCounts[category] = (replyCounts[category] || 0) + 1;
      replyDetails.push({
        from: reply.from_attendee?.display_name || reply.from_attendee?.identifier,
        email: reply.from_attendee?.identifier,
        subject: reply.subject?.substring(0, 60),
        date: reply.date,
        category
      });
    }

    console.log('\n📈 Reply Breakdown by Campaign:');
    for (const [category, count] of Object.entries(replyCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${category}: ${count} replies`);
    }

    console.log('\n📋 Recent Replies:');
    replyDetails.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.from} - ${r.subject}`);
      console.log(`     Category: ${r.category} | Date: ${r.date}`);
    });

    // 3. Update Airtable
    await updateAirtableReplies(replyCounts);

    // 4. Also store in Supabase for tracking
    console.log('\n💾 Storing reply summary in Supabase...');
    const { error } = await supabase
      .from('email_reply_tracking')
      .upsert({
        workspace_id: 'cd57981a-e63b-401c-bde1-ac71752c2293', // Jennifer
        sync_date: new Date().toISOString().split('T')[0],
        total_replies: replies.length,
        reply_breakdown: replyCounts,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,sync_date'
      });

    if (error && !error.message.includes('does not exist')) {
      console.log('  Note: email_reply_tracking table not created yet');
    }

    console.log('\n=== Sync Complete ===');
    console.log(`Total replies tracked: ${replies.length}`);

  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

sync().catch(console.error);
