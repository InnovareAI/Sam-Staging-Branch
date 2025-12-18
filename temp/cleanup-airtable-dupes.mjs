// Cleanup duplicate records from Airtable tables
// Keeps only the most recent record for each unique key

const AIRTABLE_API_KEY = 'patGjqqtngAUpsPPz.0b428b264625f558675671497d7a53a0eb0be01d1a8bb6365051c3d9839abdd7';
const BASE_ID = 'appo6ZgNqEWLtw66q';

const TABLES = {
  campaigns: 'tblQKOdJ5rZFmssLf',
  dailyStats: 'tbl61e5tMYhYrdZZL',
  workspaces: 'tblmrADivT0om9Shu',
  linkedinAccounts: 'tblnGEScrDDJefsho'
};

async function getAllRecords(tableId) {
  const records = [];
  let offset = null;

  do {
    const url = offset
      ? `https://api.airtable.com/v0/${BASE_ID}/${tableId}?offset=${offset}`
      : `https://api.airtable.com/v0/${BASE_ID}/${tableId}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });
    const data = await response.json();

    if (data.records) {
      records.push(...data.records);
    }
    offset = data.offset;
  } while (offset);

  return records;
}

async function deleteRecords(tableId, recordIds) {
  // Airtable allows max 10 deletes per request
  for (let i = 0; i < recordIds.length; i += 10) {
    const batch = recordIds.slice(i, i + 10);
    const params = batch.map(id => `records[]=${id}`).join('&');

    await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });
  }
}

async function cleanupTable(tableName, tableId, keyField) {
  console.log(`\n🧹 Cleaning ${tableName}...`);

  const records = await getAllRecords(tableId);
  console.log(`  Total records: ${records.length}`);

  // Group by key field
  const byKey = new Map();
  records.forEach(r => {
    const key = r.fields[keyField];
    if (!key) return;

    if (!byKey.has(key)) {
      byKey.set(key, []);
    }
    byKey.get(key).push(r);
  });

  // Find duplicates (keep the first one, delete the rest)
  const toDelete = [];
  byKey.forEach((recs, key) => {
    if (recs.length > 1) {
      // Sort by createdTime descending and keep the newest
      recs.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
      const dupes = recs.slice(1); // Skip the first (newest)
      dupes.forEach(r => toDelete.push(r.id));
      console.log(`  Found ${recs.length} records for "${key}", keeping 1, deleting ${dupes.length}`);
    }
  });

  if (toDelete.length === 0) {
    console.log(`  ✅ No duplicates found`);
    return;
  }

  console.log(`  Deleting ${toDelete.length} duplicate records...`);
  await deleteRecords(tableId, toDelete);
  console.log(`  ✅ Deleted ${toDelete.length} duplicates`);
}

async function cleanupDailyStats() {
  console.log(`\n🧹 Cleaning Daily Stats (by Campaign ID + Date)...`);

  const records = await getAllRecords(TABLES.dailyStats);
  console.log(`  Total records: ${records.length}`);

  // Group by Campaign ID + Date combo
  const byKey = new Map();
  records.forEach(r => {
    const campId = r.fields['Campaign ID'];
    const date = r.fields['Date'];
    if (!campId || !date) return;

    const key = `${campId}|${date}`;
    if (!byKey.has(key)) {
      byKey.set(key, []);
    }
    byKey.get(key).push(r);
  });

  // Find duplicates
  const toDelete = [];
  byKey.forEach((recs, key) => {
    if (recs.length > 1) {
      recs.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
      const dupes = recs.slice(1);
      dupes.forEach(r => toDelete.push(r.id));
      console.log(`  Found ${recs.length} records for "${key.substring(0, 20)}...", keeping 1, deleting ${dupes.length}`);
    }
  });

  if (toDelete.length === 0) {
    console.log(`  ✅ No duplicates found`);
    return;
  }

  console.log(`  Deleting ${toDelete.length} duplicate records...`);
  await deleteRecords(TABLES.dailyStats, toDelete);
  console.log(`  ✅ Deleted ${toDelete.length} duplicates`);
}

async function cleanup() {
  console.log('=== Airtable Duplicate Cleanup ===');
  console.log('Time:', new Date().toISOString());

  await cleanupTable('Workspaces', TABLES.workspaces, 'Workspace ID');
  await cleanupTable('LinkedIn Accounts', TABLES.linkedinAccounts, 'Account ID');
  await cleanupTable('Campaigns', TABLES.campaigns, 'Campaign ID');
  await cleanupDailyStats();

  console.log('\n=== Cleanup Complete ===');
}

cleanup().catch(console.error);
