const SUPABASE_URL = "https://latxadqrvrrrcvkktrog.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ";

async function run() {
  // Get campaigns
  const res = await fetch(SUPABASE_URL + "/rest/v1/campaigns?select=id,campaign_name,status,workspace_id,workspaces(name)&order=created_at.desc&limit=30", {
    headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
  });
  const campaigns = await res.json();

  // Get prospect counts
  const statsRes = await fetch(SUPABASE_URL + "/rest/v1/campaign_prospects?select=campaign_id,status", {
    headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
  });
  const prospects = await statsRes.json();

  // Get queue status
  const queueRes = await fetch(SUPABASE_URL + "/rest/v1/send_queue?select=campaign_id,status", {
    headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
  });
  const queue = await queueRes.json();

  // Aggregate
  const stats = {};
  for (const p of prospects) {
    if (!stats[p.campaign_id]) stats[p.campaign_id] = { total: 0, sent: 0, connected: 0, replied: 0, pending_queue: 0 };
    stats[p.campaign_id].total++;
    if (p.status === "connection_request_sent") stats[p.campaign_id].sent++;
    if (p.status === "connected") stats[p.campaign_id].connected++;
    if (p.status === "replied") stats[p.campaign_id].replied++;
  }

  for (const q of queue) {
    if (!stats[q.campaign_id]) stats[q.campaign_id] = { total: 0, sent: 0, connected: 0, replied: 0, pending_queue: 0 };
    if (q.status === "pending") stats[q.campaign_id].pending_queue++;
  }

  console.log("CAMPAIGN STATUS\n");
  console.log("Workspace        | Campaign                  | Status     | Total | Sent | Queue | Connected | Replied");
  console.log("-".repeat(110));

  for (const c of campaigns) {
    const s = stats[c.id] || { total: 0, sent: 0, connected: 0, replied: 0, pending_queue: 0 };
    const ws = (c.workspaces?.name || "Unknown").substring(0,15).padEnd(15);
    const name = (c.campaign_name || "Unnamed").substring(0,25).padEnd(25);
    const status = (c.status || "unknown").padEnd(10);
    console.log(`${ws} | ${name} | ${status} | ${String(s.total).padEnd(5)} | ${String(s.sent).padEnd(4)} | ${String(s.pending_queue).padEnd(5)} | ${String(s.connected).padEnd(9)} | ${s.replied}`);
  }
}
run();
