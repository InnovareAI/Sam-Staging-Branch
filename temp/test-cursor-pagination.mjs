const UNIPILE_API_KEY = 'aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw'; // Sales Nav account

// Your actual saved search URL
const SAVED_SEARCH_URL = 'https://www.linkedin.com/sales/search/people?query=(spellCorrectionEnabled%3Atrue%2CrecentSearchParam%3A(id%3A4920282770%2CdoLogHistory%3Atrue)%2Cfilters%3AList((type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList((id%3AB%2Ctext%3A1-10%2CselectionType%3AINCLUDED)))%2C(type%3AINDUSTRY%2Cvalues%3AList((id%3A4%2Ctext%3ASoftware%2520Development%2CselectionType%3AINCLUDED)))%2C(type%3AREGION%2Cvalues%3AList((id%3A90000084%2Ctext%3ASan%2520Francisco%2520Bay%2520Area%2CselectionType%3AINCLUDED)))%2C(type%3AFUNCTION%2Cvalues%3AList((id%3A25%2Ctext%3ASales%2CselectionType%3AINCLUDED))))%2Ckeywords%3Astartup)&sessionId=byDRa9iuRZWuGed%2FJdb4Dw%3D%3D';

async function testCursorPagination() {
  const searchUrl = `https://${UNIPILE_DSN}/api/v1/linkedin/search`;

  let cursor = null;
  let totalProspects = 0;
  let batchCount = 0;
  const targetProspects = 100;

  console.log('🔄 Testing cursor-based pagination\n');
  console.log(`Target: ${targetProspects} prospects`);
  console.log(`Batch size: 25\n`);

  while (totalProspects < targetProspects && batchCount < 5) {
    batchCount++;

    console.log(`\n📦 Batch ${batchCount}`);
    console.log(`═══════════════════════════════════════════════════════════`);

    const params = new URLSearchParams({
      account_id: ACCOUNT_ID,
      limit: '25'
    });

    if (cursor) {
      params.append('cursor', cursor);
      console.log(`Using cursor: ${cursor.substring(0, 50)}...`);
    } else {
      console.log(`No cursor (first batch)`);
    }

    const payload = { url: SAVED_SEARCH_URL };

    try {
      const response = await fetch(`${searchUrl}?${params}`, {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log(`Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Error: ${errorText}`);
        break;
      }

      const data = await response.json();
      const batchProspects = data.items || [];
      totalProspects += batchProspects.length;

      console.log(`Prospects in batch: ${batchProspects.length}`);
      console.log(`Total prospects: ${totalProspects}`);

      // Check cursor
      console.log(`\nCursor value type: ${typeof data.cursor}`);
      console.log(`Cursor value: ${JSON.stringify(data.cursor)}`);

      if (data.cursor) {
        cursor = data.cursor;
        console.log(`✅ Cursor returned: ${cursor.substring(0, 50)}...`);
      } else {
        console.log(`❌ No cursor returned (value is ${data.cursor})`);
        console.log(`\nFull response structure:`);
        console.log(JSON.stringify(Object.keys(data), null, 2));
      }

      // Check for other pagination indicators
      if (data.has_more !== undefined) {
        console.log(`has_more: ${data.has_more}`);
      }
      if (data.next !== undefined) {
        console.log(`next: ${data.next}`);
      }
      if (data.page !== undefined) {
        console.log(`page: ${data.page}`);
      }
      if (data.paging) {
        console.log(`\nPaging info:`);
        console.log(JSON.stringify(data.paging, null, 2));
      }

      // Stop if no cursor
      if (!cursor || batchProspects.length === 0) {
        console.log(`\n🏁 Stopping: ${!cursor ? 'No cursor' : 'No prospects in batch'}`);
        break;
      }

      // Small delay
      if (totalProspects < targetProspects) {
        console.log(`⏳ Waiting 500ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.log(`❌ Exception: ${error.message}`);
      break;
    }
  }

  console.log(`\n\n✅ FINAL RESULTS`);
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`Total batches: ${batchCount}`);
  console.log(`Total prospects: ${totalProspects}`);
  console.log(`Target reached: ${totalProspects >= targetProspects ? 'Yes' : 'No'}`);
}

testCursorPagination();
