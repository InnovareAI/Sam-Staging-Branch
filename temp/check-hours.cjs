const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Check workspace schedule settings
  const { data: schedules } = await supabase
    .from("workspace_schedule_settings")
    .select("*");

  console.log("\n⏰ WORKSPACE SCHEDULE SETTINGS:");
  if (!schedules || schedules.length === 0) {
    console.log("  None configured - using defaults");
  } else {
    schedules.forEach(s => {
      console.log("  Workspace: " + s.workspace_id.slice(0,8));
      console.log("    Timezone: " + s.timezone);
      console.log("    Hours: " + s.start_hour + ":00 - " + s.end_hour + ":00");
      console.log("    Skip weekends: " + s.skip_weekends);
    });
  }

  // Check the exact pending items
  const { data: pending } = await supabase
    .from("send_queue")
    .select("id, campaign_id, scheduled_for, linkedin_user_id, prospect_id")
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true })
    .limit(3);

  console.log("\n⏳ NEXT PENDING ITEMS:");
  for (const p of pending || []) {
    console.log("  ID: " + p.id.slice(0,8));
    console.log("  Scheduled: " + p.scheduled_for);
    console.log("  Campaign: " + p.campaign_id.slice(0,8));
    console.log("  LinkedIn ID: " + (p.linkedin_user_id ? p.linkedin_user_id.slice(0,20) : "None"));
    console.log("  ---");
  }

  // Check workspace accounts (LinkedIn connections)
  const { data: accounts } = await supabase
    .from("workspace_accounts")
    .select("id, workspace_id, account_type, connection_status, unipile_account_id")
    .eq("account_type", "linkedin")
    .eq("connection_status", "connected");

  console.log("\n🔗 CONNECTED LINKEDIN ACCOUNTS:");
  accounts?.forEach(a => {
    console.log("  - Workspace: " + a.workspace_id.slice(0,8) + " | Unipile: " + (a.unipile_account_id || "None"));
  });
}

check().catch(console.error);
