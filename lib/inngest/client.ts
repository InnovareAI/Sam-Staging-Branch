/**
 * Inngest Client Configuration for SAM AI
 *
 * This client is used to send events and define functions for:
 * - LinkedIn connector campaigns (CR + follow-ups)
 * - Campaign cron jobs
 * - Email campaigns
 * - Prospect processing
 */

import { Inngest } from "inngest";

// Create Inngest client
export const inngest = new Inngest({
  id: "sam-ai",
  name: "SAM AI Campaign Automation",
  eventKey: process.env.INNGEST_EVENT_KEY, // Optional: only needed for external event sending
});

// Event types (for type safety)
export type InngestEvents = {
  "campaign/connector/execute": {
    data: {
      campaignId: string;
      workspaceId: string;
      accountId: string;
      prospects: Array<{
        id: string;
        first_name: string;
        last_name: string;
        email?: string;
        company_name: string;
        title: string;
        linkedin_url: string;
        linkedin_user_id?: string;
      }>;
      messages: {
        connection_request: string;
        follow_up_messages: string[];
      };
      settings?: {
        timezone?: string;
        working_hours_start?: number;
        working_hours_end?: number;
        skip_weekends?: boolean;
        skip_holidays?: boolean;
      };
    };
  };
  "campaign/messenger/execute": {
    data: {
      campaignId: string;
      workspaceId: string;
      accountId: string;
      prospects: Array<any>;
      messages: {
        message_sequence: string[];
      };
    };
  };
};
