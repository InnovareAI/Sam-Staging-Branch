#!/usr/bin/env node

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';
const IRISH_ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

async function unipileRequest(endpoint, options = {}) {
  const url = `https://${UNIPILE_DSN}${endpoint}`;
  console.log(`\n📡 Request: ${options.method || 'GET'} ${url}`);

  if (options.body) {
    console.log('📦 Body:', JSON.stringify(options.body, null, 2));
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Api-Key': UNIPILE_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status} ${response.statusText}`);
      console.log('🔴 Error Response:', JSON.stringify(data, null, 2));
      return { error: data, status: response.status };
    }

    console.log('✅ Success Response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('🔥 Network Error:', error.message);
    return { error: error.message };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 CHECKING WITHDRAWN INVITATIONS FOR IRISH MAGUAD');
  console.log('='.repeat(80));

  // Test the ACTUAL URLs from the prospects
  const testProspects = [
    {
      name: 'Adam Fry',
      url: 'https://www.linkedin.com/in/adam-h-fry?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAASEFSgBmAsKhHk1EZVHn93R--zoSI16F0c',
      cleanUrl: 'https://www.linkedin.com/in/adam-h-fry',
      urn: 'urn:li:fs_miniProfile:ACoAAASEFSgBmAsKhHk1EZVHn93R--zoSI16F0c'
    },
    {
      name: 'Ruben Mayer',
      url: 'https://www.linkedin.com/in/rubenmayer?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAABeQoWMBkLV9L4lY6dFY-wYg1E_9Upnj2II',
      cleanUrl: 'https://www.linkedin.com/in/rubenmayer',
      urn: 'urn:li:fs_miniProfile:ACoAABeQoWMBkLV9L4lY6dFY-wYg1E_9Upnj2II'
    }
  ];

  for (const prospect of testProspects) {
    console.log('\n' + '='.repeat(60));
    console.log(`📌 TESTING: ${prospect.name}`);
    console.log('='.repeat(60));

    // Try with full URL (including miniProfileUrn)
    console.log('\n1️⃣ Testing with FULL URL (with miniProfileUrn):');
    const fullUrlProfile = await unipileRequest(
      `/api/v1/users/profile?account_id=${IRISH_ACCOUNT_ID}&identifier=${encodeURIComponent(prospect.url)}`
    );

    if (!fullUrlProfile.error) {
      console.log('\n📊 Profile from FULL URL:');
      console.log('  - Name:', fullUrlProfile.first_name, fullUrlProfile.last_name);
      console.log('  - Provider ID:', fullUrlProfile.provider_id);
      console.log('  - Network Distance:', fullUrlProfile.network_distance);
      console.log('  - Invitation Type:', fullUrlProfile.invitation?.type);
      console.log('  - Invitation Status:', fullUrlProfile.invitation?.status);

      if (fullUrlProfile.invitation?.status === 'WITHDRAWN') {
        console.log('\n🔴 FOUND THE ISSUE: Invitation was WITHDRAWN!');
        console.log('  This explains the "Should delay new invitation" error.');
        console.log('  LinkedIn has a cooldown period after withdrawing invitations.');
      }
    }

    // Try with clean URL (without miniProfileUrn)
    console.log('\n2️⃣ Testing with CLEAN URL (no miniProfileUrn):');
    const cleanUrlProfile = await unipileRequest(
      `/api/v1/users/profile?account_id=${IRISH_ACCOUNT_ID}&identifier=${encodeURIComponent(prospect.cleanUrl)}`
    );

    if (!cleanUrlProfile.error) {
      console.log('\n📊 Profile from CLEAN URL:');
      console.log('  - Name:', cleanUrlProfile.first_name, cleanUrlProfile.last_name);
      console.log('  - Provider ID:', cleanUrlProfile.provider_id);
      console.log('  - Network Distance:', cleanUrlProfile.network_distance);
      console.log('  - Invitation Type:', cleanUrlProfile.invitation?.type);
      console.log('  - Invitation Status:', cleanUrlProfile.invitation?.status);

      if (cleanUrlProfile.invitation?.status === 'WITHDRAWN') {
        console.log('\n🔴 FOUND THE ISSUE: Invitation was WITHDRAWN!');
        console.log('  This explains the "Should delay new invitation" error.');
        console.log('  LinkedIn has a cooldown period after withdrawing invitations.');
      }
    }

    // Compare results
    if (!fullUrlProfile.error && !cleanUrlProfile.error) {
      const fullId = fullUrlProfile.provider_id;
      const cleanId = cleanUrlProfile.provider_id;

      if (fullId !== cleanId) {
        console.log('\n⚠️  WARNING: Different profiles returned!');
        console.log('  Full URL provider_id:', fullId);
        console.log('  Clean URL provider_id:', cleanId);
        console.log('  Full URL name:', fullUrlProfile.first_name, fullUrlProfile.last_name);
        console.log('  Clean URL name:', cleanUrlProfile.first_name, cleanUrlProfile.last_name);
      }
    }
  }

  // Check for withdrawn invitations in relations
  console.log('\n' + '='.repeat(80));
  console.log('📌 CHECKING ALL RELATIONS (INCLUDING WITHDRAWN)');
  console.log('='.repeat(80));

  // Try different relation types
  const relationTypes = ['WITHDRAWN', 'SENT', 'PENDING', 'ALL'];

  for (const type of relationTypes) {
    console.log(`\n🔍 Checking ${type} relations...`);
    const relations = await unipileRequest(
      `/api/v1/users/relations?account_id=${IRISH_ACCOUNT_ID}${type !== 'ALL' ? `&type=${type}` : ''}&limit=100`
    );

    if (!relations.error && relations.items) {
      console.log(`  Found ${relations.items.length} ${type} relations`);

      // Look for Adam and Ruben
      const adam = relations.items.find(r =>
        r.first_name === 'Adam' && r.last_name === 'Fry'
      );
      const ruben = relations.items.find(r =>
        r.first_name === 'Ruben' && r.last_name === 'Mayer'
      );

      if (adam) {
        console.log(`\n  🎯 Found Adam Fry in ${type}!`);
        console.log('    Details:', JSON.stringify(adam, null, 2));
      }
      if (ruben) {
        console.log(`\n  🎯 Found Ruben Mayer in ${type}!`);
        console.log('    Details:', JSON.stringify(ruben, null, 2));
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('💡 DIAGNOSIS COMPLETE');
  console.log('='.repeat(80));
  console.log('\nThe "Should delay new invitation" error occurs when:');
  console.log('1. An invitation was previously WITHDRAWN to this person');
  console.log('2. LinkedIn enforces a cooldown period (typically 3-4 weeks)');
  console.log('3. The person may also be in pending invitations from before');
  console.log('\nSOLUTION: Wait for the cooldown period or use InMail instead');
}

main().catch(console.error);