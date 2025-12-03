const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const now = new Date().toISOString();

  // Check all pending by campaign
  const { data: pending } = await supabase
    .from("send_queue")
    .select("id, campaign_id, scheduled_for")
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true });

  console.log("\n📊 PENDING BY CAMPAIGN:");
  const byCampaign = {};
  pending?.forEach(p => {
    byCampaign[p.campaign_id] = (byCampaign[p.campaign_id] || 0) + 1;
  });

  for (const [campId, count] of Object.entries(byCampaign)) {
    const { data: camp } = await supabase
      .from("campaigns")
      .select("name")
      .eq("id", campId)
      .single();
    console.log("  " + (camp?.name || campId.slice(0,8)) + ": " + count);
  }

  // Reschedule ALL pending to now
  console.log("\n🔄 Rescheduling all " + (pending?.length || 0) + " pending items to NOW...");

  if (pending && pending.length > 0) {
    const { error } = await supabase
      .from("send_queue")
      .update({ scheduled_for: now })
      .eq("status", "pending");

    if (error) {
      console.log("Error: " + error.message);
    } else {
      console.log("✅ All rescheduled to " + now);
    }
  }

  // Check accounts to verify they have different LinkedIn accounts
  const campaignIds = Object.keys(byCampaign);
  console.log("\n🔗 CAMPAIGN ACCOUNTS:");
  for (const campId of campaignIds) {
    const { data: camp } = await supabase
      .from("campaigns")
      .select("name, linkedin_account_id")
      .eq("id", campId)
      .single();
    console.log("  " + (camp?.name || campId.slice(0,8)) + " -> " + (camp?.linkedin_account_id?.slice(0,8) || "NO ACCOUNT"));
  }
}

main().catch(console.error);
