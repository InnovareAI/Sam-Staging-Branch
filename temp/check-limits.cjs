const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Check workspace_account_limits
  const { data: limits } = await supabase
    .from("workspace_account_limits")
    .select("*");

  console.log("\n📊 ACCOUNT LIMITS:");
  if (!limits || limits.length === 0) {
    console.log("  No limits configured - using defaults");
  } else {
    limits.forEach(l => {
      console.log("  Account: " + l.unipile_account_id);
      console.log("    Daily CR: " + l.daily_cr_sent + "/" + l.max_daily_cr);
      console.log("    Weekly CR: " + l.weekly_cr_sent + "/" + l.max_weekly_cr);
      console.log("    Last reset: " + l.last_reset_date);
    });
  }

  // Check how many CRs sent today
  const today = new Date().toISOString().split("T")[0];
  const { data: sentToday } = await supabase
    .from("send_queue")
    .select("id")
    .eq("status", "sent")
    .gte("sent_at", today + "T00:00:00Z");

  console.log("\n📬 CRs SENT TODAY: " + (sentToday?.length || 0));

  // Check queue status breakdown
  const { data: queue } = await supabase
    .from("send_queue")
    .select("status");

  const statuses = {};
  queue?.forEach(q => statuses[q.status] = (statuses[q.status] || 0) + 1);
  console.log("\n📊 QUEUE STATUS BREAKDOWN:");
  console.log("  ", statuses);
}

check().catch(console.error);
