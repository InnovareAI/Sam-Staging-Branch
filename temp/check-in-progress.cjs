const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Get all approved prospects
  const { data: approvedProspects } = await supabase
    .from("prospect_approval_data")
    .select("id, name, contact")
    .eq("approval_status", "approved");

  console.log("Total approved prospects:", approvedProspects?.length);

  // Get all LinkedIn URLs from approved prospects
  const linkedinUrls = approvedProspects
    ?.map(p => p.contact?.linkedin_url)
    .filter(Boolean);

  console.log("With LinkedIn URLs:", linkedinUrls?.length);

  if (!linkedinUrls?.length) return;

  // Check which are already in campaigns
  const { data: campaignProspects } = await supabase
    .from("campaign_prospects")
    .select("linkedin_url")
    .in("linkedin_url", linkedinUrls);

  const inCampaignUrls = new Set(campaignProspects?.map(p => p.linkedin_url));
  console.log("Already in campaigns:", inCampaignUrls.size);

  // Count available (not in campaigns)
  const availableCount = linkedinUrls.filter(url => !inCampaignUrls.has(url)).length;
  console.log("Available for 'In Progress' (approved, not in campaigns, has LinkedIn URL):", availableCount);

  // Sample what's available
  const available = approvedProspects?.filter(p => {
    const url = p.contact?.linkedin_url;
    return url && !inCampaignUrls.has(url);
  }).slice(0, 5);

  console.log("\nSample available prospects:");
  available?.forEach(p => {
    console.log(`  ${p.name} | ${p.contact?.linkedin_url?.slice(0, 50)}`);
  });
}

main().catch(console.error);
