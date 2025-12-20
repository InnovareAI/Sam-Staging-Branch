/**
 * ReachInbox Service
 * Manages pushing leads to existing ReachInbox campaigns
 *
 * ReachInbox API: https://api.reachinbox.ai/api/v1
 *
 * Workflow:
 * 1. User sets up campaigns in ReachInbox (templates, warmup, etc.)
 * 2. SAM pushes approved leads with personalized data to those campaigns
 */

const REACHINBOX_API_URL = process.env.REACHINBOX_API_URL || 'https://api.reachinbox.ai/api/v1';

export interface ReachInboxLead {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  phone?: string;
  website?: string;
  location?: string;
  industry?: string;
  customFields?: Record<string, string>;
}

export interface ReachInboxCampaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  type?: string;
  createdAt?: string;
  leadsCount?: number;
}

export interface PushLeadsResult {
  success: boolean;
  campaignId: string;
  campaignName?: string;
  leadsPushed: number;
  leadsSkipped: number;
  errors: string[];
}

class ReachInboxService {
  private apiKey: string | null = null;
  private initialized = false;

  private initialize() {
    if (this.initialized) return;
    this.apiKey = process.env.REACHINBOX_API_KEY || '';
    this.initialized = true;
  }

  private checkCredentials() {
    this.initialize();
    if (!this.apiKey) {
      throw new Error('REACHINBOX_API_KEY not configured');
    }
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    this.checkCredentials();

    const url = `${REACHINBOX_API_URL}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ReachInbox API error (${response.status}): ${errorText}`);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      console.error('ReachInbox API request failed:', error);
      throw error;
    }
  }

  /**
   * List all campaigns from ReachInbox
   */
  async listCampaigns(): Promise<ReachInboxCampaign[]> {
    try {
      console.log('📋 Fetching ReachInbox campaigns...');

      const response = await this.request<{ data?: ReachInboxCampaign[]; campaigns?: ReachInboxCampaign[] }>(
        '/campaigns'
      );

      const campaigns = response.data || response.campaigns || [];
      console.log(`✅ Found ${campaigns.length} ReachInbox campaigns`);

      return campaigns;
    } catch (error) {
      console.error('❌ Failed to fetch ReachInbox campaigns:', error);
      throw error;
    }
  }

  /**
   * Get a specific campaign by ID
   */
  async getCampaign(campaignId: string): Promise<ReachInboxCampaign | null> {
    try {
      const response = await this.request<{ data?: ReachInboxCampaign; campaign?: ReachInboxCampaign }>(
        `/campaigns/${campaignId}`
      );

      return response.data || response.campaign || null;
    } catch (error) {
      console.error(`❌ Failed to fetch campaign ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * Push leads to an existing ReachInbox campaign
   */
  async pushLeadsToCampaign(
    campaignId: string,
    leads: ReachInboxLead[]
  ): Promise<PushLeadsResult> {
    const result: PushLeadsResult = {
      success: false,
      campaignId,
      leadsPushed: 0,
      leadsSkipped: 0,
      errors: [],
    };

    try {
      console.log(`📤 Pushing ${leads.length} leads to ReachInbox campaign ${campaignId}...`);

      // Get campaign info for the response
      const campaign = await this.getCampaign(campaignId);
      if (campaign) {
        result.campaignName = campaign.name;
      }

      // Prepare leads in ReachInbox format
      const formattedLeads = leads.map((lead) => ({
        email: lead.email,
        first_name: lead.firstName || '',
        last_name: lead.lastName || '',
        company_name: lead.companyName || '',
        job_title: lead.jobTitle || '',
        linkedin_url: lead.linkedinUrl || '',
        phone: lead.phone || '',
        website: lead.website || '',
        location: lead.location || '',
        industry: lead.industry || '',
        ...this.formatCustomFields(lead.customFields),
      }));

      // ReachInbox API endpoint for adding leads to campaign
      // Try the /leads/add endpoint first
      const response = await this.request<{
        success?: boolean;
        added?: number;
        skipped?: number;
        errors?: string[];
        data?: {
          added?: number;
          skipped?: number;
          errors?: string[];
        };
      }>(`/campaigns/${campaignId}/leads`, 'POST', {
        leads: formattedLeads,
      });

      // Handle different response formats
      if (response.data) {
        result.leadsPushed = response.data.added || formattedLeads.length;
        result.leadsSkipped = response.data.skipped || 0;
        result.errors = response.data.errors || [];
      } else {
        result.leadsPushed = response.added || formattedLeads.length;
        result.leadsSkipped = response.skipped || 0;
        result.errors = response.errors || [];
      }

      result.success = true;
      console.log(
        `✅ Pushed ${result.leadsPushed} leads to ReachInbox campaign "${result.campaignName || campaignId}"`
      );

      return result;
    } catch (error) {
      console.error('❌ Failed to push leads to ReachInbox:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Add a single lead to a campaign
   */
  async addLeadToCampaign(campaignId: string, lead: ReachInboxLead): Promise<boolean> {
    try {
      const formattedLead = {
        email: lead.email,
        first_name: lead.firstName || '',
        last_name: lead.lastName || '',
        company_name: lead.companyName || '',
        job_title: lead.jobTitle || '',
        linkedin_url: lead.linkedinUrl || '',
        phone: lead.phone || '',
        website: lead.website || '',
        location: lead.location || '',
        industry: lead.industry || '',
        ...this.formatCustomFields(lead.customFields),
      };

      await this.request(`/campaigns/${campaignId}/leads`, 'POST', {
        leads: [formattedLead],
      });

      console.log(`✅ Added lead ${lead.email} to campaign ${campaignId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to add lead ${lead.email}:`, error);
      return false;
    }
  }

  /**
   * Format custom fields for ReachInbox API
   */
  private formatCustomFields(customFields?: Record<string, string>): Record<string, string> {
    if (!customFields) return {};

    const formatted: Record<string, string> = {};
    for (const [key, value] of Object.entries(customFields)) {
      // ReachInbox uses custom_field_1, custom_field_2, etc. format
      formatted[`custom_${key}`] = value;
    }
    return formatted;
  }

  /**
   * Test the ReachInbox connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; campaignCount?: number }> {
    try {
      const campaigns = await this.listCampaigns();
      console.log('✅ ReachInbox connection successful');
      return { success: true, campaignCount: campaigns.length };
    } catch (error) {
      console.error('❌ ReachInbox connection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<any> {
    try {
      const response = await this.request<any>(`/campaigns/${campaignId}/stats`);
      return response.data || response;
    } catch (error) {
      console.error(`❌ Failed to get stats for campaign ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * Get all leads for a specific campaign
   */
  async getCampaignLeads(campaignId: string, limit = 100): Promise<any[]> {
    try {
      // The search result suggested /api/v1/leads with campaignId query param
      const response = await this.request<any>(`/leads?campaignId=${campaignId}&limit=${limit}`);
      return response.data || response.leads || [];
    } catch (error) {
      console.error(`❌ Failed to fetch leads for campaign ${campaignId}:`, error);
      return [];
    }
  }
}

export const reachInboxService = new ReachInboxService();
