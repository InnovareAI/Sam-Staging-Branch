/**
 * Migration Script: Transfer draft_data.csvData to campaign_prospects
 *
 * This script finds all draft campaigns with prospects stored in draft_data.csvData
 * and transfers them to the campaign_prospects table.
 *
 * Run with: node scripts/js/migrate-draft-data-to-campaign-prospects.cjs
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("🔍 Finding draft campaigns with prospects in draft_data.csvData...\n");

  // Find all draft campaigns with non-empty draft_data
  const { data: drafts, error: draftsError } = await supabase
    .from("campaigns")
    .select("id, name, workspace_id, draft_data, status")
    .eq("status", "draft")
    .not("draft_data", "is", null);

  if (draftsError) {
    console.error("❌ Error fetching drafts:", draftsError);
    return;
  }

  console.log(`Found ${drafts?.length || 0} draft campaigns\n`);

  let totalMigrated = 0;
  let campaignsProcessed = 0;

  for (const draft of drafts || []) {
    const csvData = draft.draft_data?.csvData;

    if (!csvData || csvData.length === 0) {
      continue;
    }

    // Check if campaign_prospects already has data for this campaign
    const { count: existingCount } = await supabase
      .from("campaign_prospects")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", draft.id);

    if (existingCount && existingCount > 0) {
      console.log(`⏭️  Skipping "${draft.name}" - already has ${existingCount} prospects in campaign_prospects`);
      continue;
    }

    console.log(`\n📦 Processing "${draft.name}" (${draft.id})`);
    console.log(`   Found ${csvData.length} prospects in draft_data.csvData`);

    // Map draft_data.csvData to campaign_prospects format
    const prospectsToInsert = csvData.map((p) => ({
      campaign_id: draft.id,
      workspace_id: draft.workspace_id,
      first_name: p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown',
      last_name: p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '',
      linkedin_url: p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url,
      provider_id: p.provider_id || p.providerId || null,
      company: p.company || p.organization || null,
      title: p.title || p.job_title || null,
      status: 'pending',
      created_at: new Date().toISOString()
    })).filter((p) => p.linkedin_url); // Only insert prospects with LinkedIn URLs

    if (prospectsToInsert.length === 0) {
      console.log(`   ⚠️  No valid prospects (missing LinkedIn URLs)`);
      continue;
    }

    // Insert into campaign_prospects
    const { error: insertError } = await supabase
      .from("campaign_prospects")
      .insert(prospectsToInsert);

    if (insertError) {
      console.error(`   ❌ Error inserting prospects:`, insertError);
      continue;
    }

    console.log(`   ✅ Migrated ${prospectsToInsert.length} prospects to campaign_prospects`);
    totalMigrated += prospectsToInsert.length;
    campaignsProcessed++;

    // Clear the draft_data.csvData now that it's migrated
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({ draft_data: {} })
      .eq("id", draft.id);

    if (updateError) {
      console.error(`   ⚠️  Failed to clear draft_data:`, updateError);
    } else {
      console.log(`   🧹 Cleared draft_data.csvData`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Migration complete!`);
  console.log(`   Campaigns processed: ${campaignsProcessed}`);
  console.log(`   Total prospects migrated: ${totalMigrated}`);
}

main().catch(console.error);
