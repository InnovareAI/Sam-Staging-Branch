const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, workspace_id")
    .or("name.ilike.%Mich%,name.ilike.%Cha%,name.ilike.%Irish%")
    .eq("status", "active");

  console.log("\n📊 ACTIVE CAMPAIGNS:");
  campaigns?.forEach(c => console.log("  - " + c.name + " (ID: " + c.id.slice(0,8) + "...)"));

  if (!campaigns || campaigns.length === 0) {
    console.log("No active campaigns found");
    return;
  }

  for (const camp of campaigns) {
    const { data: prospects } = await supabase
      .from("campaign_prospects")
      .select("id, name, status, linkedin_url, created_at")
      .eq("campaign_id", camp.id);

    console.log("\n📋 " + camp.name + ":");
    const statusCounts = {};
    prospects?.forEach(p => statusCounts[p.status] = (statusCounts[p.status] || 0) + 1);
    console.log("  Status counts:", statusCounts);
    console.log("  Total prospects: " + (prospects?.length || 0));

    const { data: queue } = await supabase
      .from("send_queue")
      .select("id, status, scheduled_for, error_message")
      .eq("campaign_id", camp.id);

    console.log("  Queue items: " + (queue?.length || 0));
    if (queue && queue.length > 0) {
      const qStatuses = {};
      queue.forEach(q => qStatuses[q.status] = (qStatuses[q.status] || 0) + 1);
      console.log("  Queue statuses:", qStatuses);
      const pending = queue.filter(q => q.status === "pending");
      if (pending.length > 0) {
        console.log("  Next scheduled: " + pending[0].scheduled_for);
      }
    }
  }
}

check().catch(console.error);
