/**
 * Inngest API Route
 *
 * This endpoint receives events from Inngest and triggers the appropriate functions.
 * Inngest Cloud will call this endpoint to execute your workflow functions.
 *
 * Endpoint: POST /api/inngest
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";

// Import all Inngest functions
import { executeConnectorCampaign } from "@/inngest/functions/connector-campaign";
import { checkActiveCampaigns } from "@/inngest/functions/campaign-cron";

// Register all functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    executeConnectorCampaign,
    checkActiveCampaigns,
    // Add more functions here as you build them
  ],
});
