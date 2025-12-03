const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Check campaign 3b42e34e (the one with pending items)
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, status, workspace_id")
    .eq("id", "3b42e34e-d90a-49ee-8c5a-e55cdbed7c4d")
    .single();

  console.log("\n📊 CAMPAIGN WITH PENDING:");
  console.log("  Name: " + (campaign?.name || "Not found"));
  console.log("  Workspace: " + campaign?.workspace_id);

  // Get prospects for Michelle's campaigns
  const { data: michProspects } = await supabase
    .from("campaign_prospects")
    .select("id, name, campaign_id, status")
    .ilike("name", "%mich%")
    .limit(10);

  console.log("\n👤 PROSPECTS WITH 'mich' IN NAME:");
  michProspects?.forEach(p => console.log("  - " + p.name + " | " + p.status));

  // Count prospects per campaign
  const { data: prospectCampaigns } = await supabase
    .from("campaign_prospects")
    .select("campaign_id");

  const campaignCounts = {};
  prospectCampaigns?.forEach(p => {
    campaignCounts[p.campaign_id] = (campaignCounts[p.campaign_id] || 0) + 1;
  });

  console.log("\n📊 PROSPECT COUNTS BY CAMPAIGN:");
  const sorted = Object.entries(campaignCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [campId, count] of sorted) {
    const { data: camp } = await supabase
      .from("campaigns")
      .select("name")
      .eq("id", campId)
      .single();
    console.log("  " + (camp?.name || campId.slice(0,8)) + ": " + count);
  }

  // Check if prospects are in send_queue but not in campaign_prospects
  const { data: queueProspects } = await supabase
    .from("send_queue")
    .select("prospect_id, campaign_id")
    .limit(100);

  const queueProspectIds = new Set(queueProspects?.map(q => q.prospect_id) || []);
  console.log("\n📬 Unique prospect_ids in send_queue: " + queueProspectIds.size);

  // Check if these prospect_ids exist in campaign_prospects
  const sampleIds = Array.from(queueProspectIds).slice(0, 5);
  console.log("Sample prospect_ids from queue: " + sampleIds.map(id => id?.slice(0,8)).join(", "));
}

check().catch(console.error);
