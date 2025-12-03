const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const workspaceId = "7f0341da-88db-476b-ae0a-fc0da5b70861"; // IA4

  // Check all campaigns (not just drafts)
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, campaign_type, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("All campaigns in IA4:");
  campaigns?.forEach(c => {
    console.log(`  ${c.name} | ${c.status} | ${c.campaign_type} | ${c.created_at}`);
  });

  // Get draft details
  const drafts = campaigns?.filter(c => c.status === "draft");
  if (drafts?.length) {
    console.log("\nDraft campaign details:");
    for (const d of drafts) {
      const { data: full } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", d.id)
        .single();

      console.log(`  ID: ${d.id}`);
      console.log(`  Name: ${d.name}`);
      console.log(`  Type: ${d.campaign_type}`);
      console.log(`  Draft data:`, JSON.stringify(full?.draft_data, null, 2));
    }
  }

  // Check recent campaign_prospects additions
  const { data: recentProspects } = await supabase
    .from("campaign_prospects")
    .select("id, campaign_id, first_name, last_name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\nRecent campaign_prospects (all workspaces):");
  recentProspects?.forEach(p => {
    console.log(`  ${p.first_name} ${p.last_name} | ${p.status} | campaign: ${p.campaign_id?.slice(0,8)} | ${p.created_at}`);
  });
}

main().catch(console.error);
