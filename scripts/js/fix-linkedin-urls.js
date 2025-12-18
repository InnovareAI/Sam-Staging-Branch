#!/usr/bin/env node

/**
 * Fix LinkedIn URLs in send_queue table
 * Extracts slugs from full LinkedIn URLs and updates the database
 */

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

/**
 * Extract LinkedIn slug from URL
 */
function extractSlug(url) {
  if (!url) return null;

  // Pattern: /in/slug or /in/slug/ (with optional trailing slash and query params)
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Fetch all queue items with LinkedIn URLs
 */
async function fetchItemsWithUrls() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/send_queue?linkedin_user_id=like.*linkedin.com*&select=id,linkedin_user_id,status&limit=1000`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Update a single queue item
 */
async function updateQueueItem(id, slug, shouldResetStatus) {
  const updates = {
    linkedin_user_id: slug
  };

  // Reset failed items to pending so they can be retried
  if (shouldResetStatus) {
    updates.status = 'pending';
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/send_queue?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(updates)
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update item ${id}: ${response.statusText}`);
  }

  return true;
}

/**
 * Main execution
 */
async function main() {
  console.log('Fetching queue items with LinkedIn URLs...');

  const items = await fetchItemsWithUrls();
  console.log(`Found ${items.length} items with LinkedIn URLs\n`);

  let successCount = 0;
  let failedCount = 0;
  let resetCount = 0;
  const errors = [];

  for (const item of items) {
    const slug = extractSlug(item.linkedin_user_id);

    if (!slug) {
      console.log(`❌ Could not extract slug from: ${item.linkedin_user_id}`);
      errors.push({ id: item.id, url: item.linkedin_user_id, reason: 'No slug found' });
      failedCount++;
      continue;
    }

    try {
      const shouldReset = item.status === 'failed';
      await updateQueueItem(item.id, slug, shouldReset);

      if (shouldReset) {
        console.log(`✅ Fixed & reset: ${item.linkedin_user_id} -> ${slug}`);
        resetCount++;
      } else {
        console.log(`✅ Fixed: ${item.linkedin_user_id} -> ${slug}`);
      }

      successCount++;
    } catch (error) {
      console.log(`❌ Error updating ${item.id}: ${error.message}`);
      errors.push({ id: item.id, url: item.linkedin_user_id, reason: error.message });
      failedCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n=== Summary ===');
  console.log(`Total items processed: ${items.length}`);
  console.log(`Successfully fixed: ${successCount}`);
  console.log(`Failed status reset to pending: ${resetCount}`);
  console.log(`Failed to fix: ${failedCount}`);

  if (errors.length > 0) {
    console.log('\n=== Errors ===');
    errors.forEach(err => {
      console.log(`ID: ${err.id}`);
      console.log(`URL: ${err.url}`);
      console.log(`Reason: ${err.reason}\n`);
    });
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
