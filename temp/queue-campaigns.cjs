const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function queueCampaign(campaignId) {
  // Get campaign
  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("id, name, message_templates, connection_message")
    .eq("id", campaignId)
    .single();

  if (campErr || !campaign) {
    console.log("Campaign not found:", campaignId);
    return;
  }

  console.log("\n📋 Queueing: " + campaign.name);

  // Get prospects
  const { data: prospects, error: prospErr } = await supabase
    .from("campaign_prospects")
    .select("id, name, linkedin_url, linkedin_user_id, status")
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "approved"]); // Only pending/approved prospects

  if (!prospects || prospects.length === 0) {
    console.log("  No pending/approved prospects");
    return;
  }

  console.log("  Found " + prospects.length + " prospects to queue");

  // Get connection message
  const connectionMsg = campaign.connection_message ||
                        campaign.message_templates?.connection_request ||
                        "Hi {{firstName}}, I'd like to connect.";

  // Queue each prospect
  let queued = 0;
  const now = new Date();

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];

    // Check if already in queue
    const { data: existing } = await supabase
      .from("send_queue")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("prospect_id", prospect.id)
      .single();

    if (existing) {
      console.log("  - " + prospect.name + " already in queue, skipping");
      continue;
    }

    // Schedule 30 min apart
    const scheduledFor = new Date(now.getTime() + i * 30 * 60 * 1000);

    // Personalize message
    const firstName = prospect.name?.split(" ")[0] || "there";
    const message = connectionMsg.replace(/\{\{firstName\}\}/g, firstName);

    // Insert queue item
    const { error: insertErr } = await supabase
      .from("send_queue")
      .insert({
        campaign_id: campaignId,
        prospect_id: prospect.id,
        linkedin_user_id: prospect.linkedin_url || prospect.linkedin_user_id,
        message: message,
        scheduled_for: scheduledFor.toISOString(),
        status: "pending",
        message_type: "connection_request"
      });

    if (insertErr) {
      console.log("  - Error queueing " + prospect.name + ": " + insertErr.message);
    } else {
      queued++;
    }
  }

  console.log("  ✅ Queued " + queued + " prospects");
}

async function main() {
  // Queue the 3 campaigns that need it
  const campaigns = [
    "d035295d-1f45-4af9-9e23-a9c3f3f27f29", // Mich Campaign 4
    "4bf54177-ea7d-4ac1-9a8c-f23a9af0c4a1", // Mich Campaign 3
    "e4d6aa4a-9827-48a9-af90-1c91c0a65b29"  // 12/2 Cha Campaign 5
  ];

  // First, get actual campaign IDs
  const { data: camps } = await supabase
    .from("campaigns")
    .select("id, name")
    .or("name.eq.Mich Campaign 4,name.eq.Mich Campaign 3,name.eq.12/2 Cha Campaign 5");

  console.log("Found campaigns:");
  camps?.forEach(c => console.log("  " + c.name + " -> " + c.id));

  for (const camp of camps || []) {
    await queueCampaign(camp.id);
  }
}

main().catch(console.error);
