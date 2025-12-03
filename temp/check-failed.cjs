const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Check failed queue items
  const { data: failed } = await supabase
    .from("send_queue")
    .select("id, campaign_id, status, error_message, scheduled_for")
    .eq("status", "failed")
    .limit(10);

  console.log("\n❌ FAILED QUEUE ITEMS:");
  failed?.forEach(f => {
    console.log("  - " + f.error_message);
    console.log("    Scheduled: " + f.scheduled_for);
  });

  // Check skipped items
  const { data: skipped } = await supabase
    .from("send_queue")
    .select("id, campaign_id, status, error_message")
    .eq("status", "skipped")
    .limit(5);

  console.log("\n⏭️ SKIPPED QUEUE ITEMS:");
  skipped?.forEach(s => {
    console.log("  - " + (s.error_message || "No reason"));
  });

  // Check pending items scheduled for future
  const { data: pending } = await supabase
    .from("send_queue")
    .select("id, campaign_id, status, scheduled_for")
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true })
    .limit(5);

  console.log("\n⏳ PENDING (next 5):");
  pending?.forEach(p => {
    console.log("  - " + p.scheduled_for);
  });

  // Check if there are prospects in prospect_approval_data not linked to campaigns
  const { data: approval } = await supabase
    .from("prospect_approval_data")
    .select("id, name, approval_status, campaign_id, session_id")
    .limit(20);

  console.log("\n📝 APPROVAL DATA (not in campaigns):");
  const notLinked = approval?.filter(a => !a.campaign_id) || [];
  console.log("  Without campaign_id: " + notLinked.length);

  // Check total prospects in campaign_prospects
  const { count: prospectCount } = await supabase
    .from("campaign_prospects")
    .select("*", { count: "exact", head: true });

  console.log("\n👥 TOTAL campaign_prospects: " + prospectCount);
}

check().catch(console.error);
