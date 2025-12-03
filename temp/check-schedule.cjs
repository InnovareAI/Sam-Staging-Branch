const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Check pending queue items and their campaign schedules
  const { data: pending } = await supabase
    .from("send_queue")
    .select("id, campaign_id, scheduled_for")
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true })
    .limit(5);

  console.log("\n📋 PENDING ITEMS:");
  for (const p of pending || []) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("name, linkedin_account_id, schedule_settings, country_code, timezone, working_hours_start, working_hours_end, skip_weekends, skip_holidays")
      .eq("id", p.campaign_id)
      .single();

    console.log("\n  Campaign: " + (campaign?.name || "Unknown"));
    console.log("  Account: " + campaign?.linkedin_account_id);
    console.log("  Country: " + campaign?.country_code);
    console.log("  Timezone: " + campaign?.timezone);
    console.log("  Working hours: " + campaign?.working_hours_start + " - " + campaign?.working_hours_end);
    console.log("  Skip weekends: " + campaign?.skip_weekends);
    console.log("  Schedule settings: " + JSON.stringify(campaign?.schedule_settings));
  }

  // Also check the workspace_schedule_settings
  const { data: wsSettings } = await supabase
    .from("workspace_schedule_settings")
    .select("*");

  console.log("\n🏢 WORKSPACE SCHEDULE SETTINGS:");
  wsSettings?.forEach(s => {
    console.log("  WS: " + s.workspace_id?.slice(0,8));
    console.log("    TZ: " + s.timezone + ", Hours: " + s.start_hour + "-" + s.end_hour);
    console.log("    Skip weekends: " + s.skip_weekends);
  });
}

check().catch(console.error);
