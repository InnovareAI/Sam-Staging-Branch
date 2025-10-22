/**
 * Test if message length causes 422 error
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const BASE_ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

async function testMessageLength() {
  console.log('🧪 Testing message length limits...\n');

  // First get a valid provider_id
  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/williamhgates?account_id=${BASE_ACCOUNT_ID}`;
  const profileResponse = await fetch(profileUrl, {
    method: 'GET',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!profileResponse.ok) {
    console.error('❌ Failed to get profile');
    return;
  }

  const profileData = await profileResponse.json();
  console.log(`✅ Got provider ID: ${profileData.provider_id}\n`);

  // Test different message lengths
  const messages = [
    {
      name: "Short (50 chars)",
      text: "Hi Bill, would love to connect and exchange ideas!"
    },
    {
      name: "Medium (150 chars)",
      text: "Hi Bill, I noticed your amazing work in technology and philanthropy. I'd love to connect and discuss potential collaborations in AI and healthcare innovation."
    },
    {
      name: "Long (250 chars)",
      text: "Hi Bill, I've been following your incredible work in technology innovation and global health initiatives. Your insights on AI and sustainable development are truly inspiring. I'd love to connect and explore potential collaborations in these areas."
    },
    {
      name: "Exactly 300 chars (LinkedIn limit)",
      text: "Hi Bill, I've been following your incredible work in technology innovation, global health initiatives, and sustainable development. Your insights on artificial intelligence, vaccine development, and climate change are truly inspiring. I would absolutely love to connect with you and explore potential opportunities."
    },
    {
      name: "Over limit (350 chars)",
      text: "Hi Bill, I've been following your incredible work in technology innovation, global health initiatives, and sustainable development for many years now. Your insights on artificial intelligence, vaccine development, climate change, and renewable energy are truly inspiring and have influenced countless people worldwide. I would absolutely love to connect with you."
    }
  ];

  const inviteUrl = `https://${UNIPILE_DSN}/api/v1/users/invite`;

  for (const msg of messages) {
    console.log(`\n📝 Testing: ${msg.name} (${msg.text.length} characters)`);
    console.log(`   Message: "${msg.text.substring(0, 60)}..."`);

    const requestBody = {
      provider_id: profileData.provider_id,
      account_id: BASE_ACCOUNT_ID,
      message: msg.text
    };

    try {
      const response = await fetch(inviteUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ SUCCESS (${response.status}): ${result.invitation_id || 'No ID'}`);
      } else {
        const errorText = await response.text();
        console.log(`   ❌ FAILED (${response.status}): ${errorText.substring(0, 150)}`);

        if (response.status === 422) {
          console.log(`   🔍 422 ERROR - This is the error we're seeing in production!`);
          try {
            const errorData = JSON.parse(errorText);
            console.log(`   Error details:`, JSON.stringify(errorData, null, 2));
          } catch {
            console.log(`   Raw error:`, errorText);
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Wait 2 seconds between requests to avoid rate limiting
    if (msg !== messages[messages.length - 1]) {
      console.log('   ⏳ Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

testMessageLength();
