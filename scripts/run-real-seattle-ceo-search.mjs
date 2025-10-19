#!/usr/bin/env node

/**
 * Real LinkedIn Search for Seattle CEOs
 * This will call the actual Unipile/BrightData APIs to get REAL prospects
 */

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  REAL LINKEDIN SEARCH - Seattle Startup CEOs                  ║
╚══════════════════════════════════════════════════════════════╝

⚠️  IMPORTANT: This search will return REAL LinkedIn profiles.

To run this search, you have TWO options:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION 1: Use ProspectSearchChat UI (EASIEST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Open your app (logged in)
2. Click the floating SAM button (if visible) or go to Data Approval
3. Type this exact message:

   "Find 20 CEOs from Seattle in the technology industry, 2nd degree"

4. SAM will execute the search and push results to Data Approval

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPTION 2: Browser Console (DIRECT API)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Open your app (logged in)
2. Press F12 to open DevTools
3. Go to Console tab
4. Paste this code:

`);

console.log(`
async function runRealSeattleCEOSearch() {
  console.log('🔍 Searching LinkedIn for REAL Seattle CEOs...\\n');

  try {
    const response = await fetch('/api/linkedin/search/simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search_criteria: {
          title: 'CEO',
          keywords: 'startup technology',
          location: 'Seattle',
          connectionDegree: '2nd'
        },
        target_count: 20
      })
    });

    const data = await response.json();

    if (!data.success) {
      console.error('❌ Search failed:', data.error);

      if (data.error?.includes('LinkedIn')) {
        console.log('\\n⚠️  You need to connect your LinkedIn account first!');
        console.log('Go to: Settings → Integrations → Connect LinkedIn');
      }
      return;
    }

    console.log('✅ SUCCESS! Found', data.count, 'REAL prospects\\n');
    console.log('━'.repeat(60));
    console.log('📊 REAL PROSPECTS FROM LINKEDIN:');
    console.log('━'.repeat(60));

    if (data.prospects && data.prospects.length > 0) {
      data.prospects.slice(0, 10).forEach((p, i) => {
        console.log(\`\\n\${i + 1}. \${p.fullName}\`);
        console.log(\`   Title: \${p.title}\`);
        console.log(\`   Company: \${p.company}\`);
        console.log(\`   Location: \${p.location}\`);
        console.log(\`   LinkedIn: \${p.linkedinUrl}\`);
        console.log(\`   Connection: \${p.connectionDegree}\${p.connectionDegree === 1 ? 'st' : p.connectionDegree === 2 ? 'nd' : 'rd'} degree\`);
      });
    }

    console.log('\\n━'.repeat(60));
    console.log('✅ All', data.count, 'prospects saved to Data Approval!');
    console.log('Session ID:', data.session_id);
    console.log('━'.repeat(60));
    console.log('\\n📍 Go to Data Approval tab to review and approve!');

    return data;
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the search
runRealSeattleCEOSearch();
`);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PREREQUISITES:

1. ✅ You must be logged into the app
2. ✅ You must have a LinkedIn account connected
3. ✅ Your LinkedIn account must be active on Unipile

To check if LinkedIn is connected:
→ Go to Settings → Integrations → Connected Services
→ You should see your LinkedIn account listed

If NOT connected:
→ Go to Settings → Integrations → Connect LinkedIn
→ Follow the Unipile authentication flow

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 WHAT THIS SEARCH DOES:

- Searches LinkedIn via Unipile API (REAL data)
- Finds CEOs in Seattle with "startup" or "technology" keywords
- Filters to 2nd degree connections
- Returns up to 20 real LinkedIn profiles
- Saves them to Data Approval for review
- You can then approve/reject and launch campaigns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
