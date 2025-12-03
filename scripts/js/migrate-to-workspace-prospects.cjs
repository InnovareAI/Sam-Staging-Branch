/**
 * Migration Script: Backfill workspace_prospects from existing data
 *
 * Sources:
 * 1. campaign_prospects (existing campaigns)
 * 2. prospect_approval_data (approval sessions)
 *
 * Run: node scripts/js/migrate-to-workspace-prospects.cjs
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("🚀 MIGRATION: Backfilling workspace_prospects\n");

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name");

  console.log(`Found ${workspaces?.length || 0} workspaces\n`);

  let totalMigrated = 0;
  let totalDuplicates = 0;

  for (const workspace of workspaces || []) {
    console.log(`\n=== ${workspace.name} (${workspace.id.slice(0, 8)}) ===`);

    // 1. Migrate from campaign_prospects
    const { data: campaignProspects } = await supabase
      .from("campaign_prospects")
      .select("*")
      .eq("workspace_id", workspace.id);

    console.log(`  Campaign prospects: ${campaignProspects?.length || 0}`);

    for (const cp of campaignProspects || []) {
      if (!cp.linkedin_url && !cp.email) continue;

      // Normalize LinkedIn URL hash
      let linkedinUrlHash = null;
      if (cp.linkedin_url) {
        linkedinUrlHash = cp.linkedin_url
          .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "")
          .split("/")[0]
          .split("?")[0]
          .toLowerCase()
          .trim();
      }

      const emailHash = cp.email ? cp.email.toLowerCase().trim() : null;

      const { error } = await supabase
        .from("workspace_prospects")
        .upsert({
          workspace_id: workspace.id,
          linkedin_url: cp.linkedin_url,
          linkedin_url_hash: linkedinUrlHash,
          email: cp.email,
          email_hash: emailHash,
          first_name: cp.first_name,
          last_name: cp.last_name,
          company: cp.company_name,
          title: cp.title,
          location: cp.location,
          phone: cp.phone,
          linkedin_provider_id: cp.provider_id,
          connection_degree: cp.connection_degree,
          source: "migration_campaign_prospects",
          approval_status: "approved", // Already in campaign = approved
          active_campaign_id: cp.campaign_id,
          enrichment_data: cp.personalization_data || {},
        }, {
          onConflict: "workspace_id,linkedin_url_hash",
          ignoreDuplicates: true,
        });

      if (error?.code === "23505") {
        totalDuplicates++;
      } else if (!error) {
        totalMigrated++;
      }
    }

    // 2. Migrate from prospect_approval_data
    const { data: sessions } = await supabase
      .from("prospect_approval_sessions")
      .select("id")
      .eq("workspace_id", workspace.id);

    const sessionIds = sessions?.map(s => s.id) || [];

    if (sessionIds.length > 0) {
      const { data: approvalData } = await supabase
        .from("prospect_approval_data")
        .select("*")
        .in("session_id", sessionIds);

      console.log(`  Approval data: ${approvalData?.length || 0}`);

      for (const pad of approvalData || []) {
        const linkedinUrl = pad.contact?.linkedin_url;
        const email = pad.contact?.email;

        if (!linkedinUrl && !email) continue;

        let linkedinUrlHash = null;
        if (linkedinUrl) {
          linkedinUrlHash = linkedinUrl
            .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "")
            .split("/")[0]
            .split("?")[0]
            .toLowerCase()
            .trim();
        }

        const emailHash = email ? email.toLowerCase().trim() : null;
        const nameParts = pad.name?.split(" ") || ["Unknown"];

        const { error } = await supabase
          .from("workspace_prospects")
          .upsert({
            workspace_id: workspace.id,
            linkedin_url: linkedinUrl,
            linkedin_url_hash: linkedinUrlHash,
            email: email,
            email_hash: emailHash,
            first_name: nameParts[0] || "Unknown",
            last_name: nameParts.slice(1).join(" ") || "",
            company: pad.company?.name,
            title: pad.title,
            location: pad.location,
            phone: pad.contact?.phone,
            connection_degree: pad.connection_degree,
            source: "migration_approval_data",
            approval_status: pad.approval_status || "pending",
            enrichment_data: {
              enrichment_score: pad.enrichment_score,
              original_source: pad.source,
            },
          }, {
            onConflict: "workspace_id,linkedin_url_hash",
            ignoreDuplicates: true,
          });

        if (error?.code === "23505") {
          totalDuplicates++;
        } else if (!error) {
          totalMigrated++;
        }
      }
    }
  }

  // 3. Link campaign_prospects to workspace_prospects
  console.log("\n🔗 Linking campaign_prospects.master_prospect_id...");

  const { data: allCampaignProspects } = await supabase
    .from("campaign_prospects")
    .select("id, workspace_id, linkedin_url")
    .is("master_prospect_id", null);

  let linked = 0;
  for (const cp of allCampaignProspects || []) {
    if (!cp.linkedin_url) continue;

    const linkedinUrlHash = cp.linkedin_url
      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "")
      .split("/")[0]
      .split("?")[0]
      .toLowerCase()
      .trim();

    const { data: masterProspect } = await supabase
      .from("workspace_prospects")
      .select("id")
      .eq("workspace_id", cp.workspace_id)
      .eq("linkedin_url_hash", linkedinUrlHash)
      .single();

    if (masterProspect) {
      await supabase
        .from("campaign_prospects")
        .update({ master_prospect_id: masterProspect.id })
        .eq("id", cp.id);
      linked++;
    }
  }

  console.log(`  Linked ${linked} campaign prospects to master table`);

  console.log("\n" + "=".repeat(50));
  console.log("✅ MIGRATION COMPLETE");
  console.log(`   Total migrated: ${totalMigrated}`);
  console.log(`   Duplicates skipped: ${totalDuplicates}`);
  console.log(`   Campaign prospects linked: ${linked}`);
}

main().catch(console.error);
