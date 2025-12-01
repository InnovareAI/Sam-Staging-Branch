/**
 * Airtable Service
 * Syncs SAM campaign data to Airtable master database
 *
 * Tables:
 * - LinkedIn Positive Leads 2025 (tblMqDWVazMY1TD1l)
 * - Interested Leads Emails 25' (tblQhqprE7YrrBOiV)
 */

const AIRTABLE_BASE_ID = 'appbBGI8aqW6Lxm5O';
const LINKEDIN_TABLE_ID = 'tblMqDWVazMY1TD1l';
const EMAIL_TABLE_ID = 'tblQhqprE7YrrBOiV';

// Map SAM intents to Airtable status values
// Airtable dropdown options: Not Interested, Interested, Info Requested, Meeting Booked, Trial, MRR Client, Went Silent
const INTENT_TO_STATUS: Record<string, string> = {
  interested: 'Interested',
  curious: 'Info Requested',
  question: 'Info Requested',
  vague_positive: 'Interested',
  booking_request: 'Meeting Booked',
  not_interested: 'Not Interested',
  wrong_person: 'Not Interested',
  timing: 'Interested', // Changed from 'No Response' - may not be valid option
  objection: 'Not Interested',
  went_silent: 'Went Silent',
  no_response: 'Interested', // Changed from 'No Response' - may not be valid option
};

export interface LinkedInLeadData {
  profileUrl?: string;
  name: string;
  jobTitle?: string;
  email?: string;
  companyName?: string;
  linkedInAccount?: string;
  intent?: string;
  replyText?: string;
  industry?: string;
  country?: string;
}

export interface EmailLeadData {
  email: string;
  name: string;
  campaignName?: string;
  replyText?: string;
  intent?: string;
  country?: string;
}

class AirtableService {
  private apiKey: string | null = null;
  private initialized = false;

  private initialize() {
    if (this.initialized) return;
    this.apiKey = process.env.AIRTABLE_API_KEY || '';
    this.initialized = true;
  }

  private checkCredentials() {
    this.initialize();
    if (!this.apiKey) {
      throw new Error('AIRTABLE_API_KEY not configured');
    }
  }

  private async request(
    tableId: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    data?: any,
    recordId?: string
  ) {
    this.checkCredentials();

    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`;
    if (recordId) {
      url += `/${recordId}`;
    }

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Airtable API request failed:', error);
      throw error;
    }
  }

  /**
   * Find a record by LinkedIn Profile URL
   */
  async findLinkedInLead(profileUrl: string): Promise<any | null> {
    try {
      const formula = encodeURIComponent(`{Profile URL} = "${profileUrl}"`);
      const response = await this.request(
        `${LINKEDIN_TABLE_ID}?filterByFormula=${formula}&maxRecords=1`,
        'GET'
      );
      return response.records?.[0] || null;
    } catch (error) {
      console.error('Error finding LinkedIn lead:', error);
      return null;
    }
  }

  /**
   * Find a record by Email
   */
  async findEmailLead(email: string): Promise<any | null> {
    try {
      const formula = encodeURIComponent(`{Email} = "${email}"`);
      const response = await this.request(
        `${EMAIL_TABLE_ID}?filterByFormula=${formula}&maxRecords=1`,
        'GET'
      );
      return response.records?.[0] || null;
    } catch (error) {
      console.error('Error finding email lead:', error);
      return null;
    }
  }

  /**
   * Create or update a LinkedIn lead in Airtable
   */
  async syncLinkedInLead(data: LinkedInLeadData): Promise<{ success: boolean; recordId?: string; error?: string }> {
    try {
      console.log(`📊 Syncing LinkedIn lead to Airtable: ${data.name}`);

      const status = data.intent ? INTENT_TO_STATUS[data.intent] || 'Interested' : 'Interested';

      const fields: Record<string, any> = {
        'Name of Interested Lead': data.name,
        Date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      };

      // Only add fields that have values
      if (data.profileUrl) fields['Profile URL'] = data.profileUrl;
      if (data.jobTitle) fields['Job Title'] = data.jobTitle;
      if (data.email) fields['Email'] = data.email;
      if (data.companyName) fields['Company Name'] = data.companyName;
      if (data.linkedInAccount) fields['LinkedIn Account'] = data.linkedInAccount;
      if (status) fields['Status of the Lead'] = status;
      if (data.replyText) fields['Last Messages/ Responses'] = data.replyText;
      if (data.industry) fields['Industry'] = data.industry;
      if (data.country) fields['Country'] = data.country;

      // Check if record exists
      let existingRecord = null;
      if (data.profileUrl) {
        existingRecord = await this.findLinkedInLead(data.profileUrl);
      }

      if (existingRecord) {
        // Update existing record
        console.log(`📝 Updating existing Airtable record: ${existingRecord.id}`);
        const response = await this.request(LINKEDIN_TABLE_ID, 'PATCH', { fields }, existingRecord.id);
        console.log(`✅ Updated LinkedIn lead in Airtable: ${data.name}`);
        return { success: true, recordId: response.id };
      } else {
        // Create new record
        const response = await this.request(LINKEDIN_TABLE_ID, 'POST', {
          records: [{ fields }],
        });
        const recordId = response.records?.[0]?.id;
        console.log(`✅ Created LinkedIn lead in Airtable: ${data.name} (${recordId})`);
        return { success: true, recordId };
      }
    } catch (error) {
      console.error('❌ Airtable sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create or update an email lead in Airtable
   */
  async syncEmailLead(data: EmailLeadData): Promise<{ success: boolean; recordId?: string; error?: string }> {
    try {
      console.log(`📊 Syncing email lead to Airtable: ${data.email}`);

      const status = data.intent ? INTENT_TO_STATUS[data.intent] || 'Interested' : undefined;

      // Extract domain from email
      const emailDomain = data.email.split('@')[1] || '';

      const fields: Record<string, any> = {
        Email: data.email,
        Date: new Date().toISOString().split('T')[0],
        'Name of Interested Leads': data.name,
      };

      if (emailDomain) fields['Email Domain'] = emailDomain;
      if (data.campaignName) fields['Campaign Name'] = data.campaignName;
      if (data.replyText) fields['Message'] = data.replyText;
      if (status) fields['Status'] = status;
      if (data.country) fields['Country'] = data.country;

      // Check if record exists
      const existingRecord = await this.findEmailLead(data.email);

      if (existingRecord) {
        // Update existing record
        console.log(`📝 Updating existing email record: ${existingRecord.id}`);
        const response = await this.request(EMAIL_TABLE_ID, 'PATCH', { fields }, existingRecord.id);
        console.log(`✅ Updated email lead in Airtable: ${data.email}`);
        return { success: true, recordId: response.id };
      } else {
        // Create new record
        const response = await this.request(EMAIL_TABLE_ID, 'POST', {
          records: [{ fields }],
        });
        const recordId = response.records?.[0]?.id;
        console.log(`✅ Created email lead in Airtable: ${data.email} (${recordId})`);
        return { success: true, recordId };
      }
    } catch (error) {
      console.error('❌ Airtable email sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test the Airtable connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.request(`${LINKEDIN_TABLE_ID}?maxRecords=1`, 'GET');
      console.log('✅ Airtable connection successful');
      return { success: true };
    } catch (error) {
      console.error('❌ Airtable connection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const airtableService = new AirtableService();
