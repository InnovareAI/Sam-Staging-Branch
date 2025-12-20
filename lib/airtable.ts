/**
 * Airtable Service
 * Syncs SAM campaign data to Airtable master database
 *
 * Tables:
 * - LinkedIn Positive Leads 2025 (tblMqDWVazMY1TD1l)
 * - Interested Leads Emails 25' (tblQhqprE7YrrBOiV)
 */

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appbBGI8aqW6Lxm5O';
const LINKEDIN_TABLE_ID = process.env.LINKEDIN_TABLE_ID || 'tblMqDWVazMY1TD1l';
const EMAIL_TABLE_ID = process.env.EMAIL_TABLE_ID || 'tblQhqprE7YrrBOiV';
const CONTACTS_TABLE_ID = process.env.CONTACTS_TABLE_ID || 'tbllDKwyUngifQVeN';

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
  companySize?: string;
}

export interface EmailLeadData {
  email: string;
  name: string;
  campaignName?: string;
  replyText?: string;
  intent?: string;
  country?: string;
  industry?: string;
  companySize?: string;
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
   * Find a record in any table by Email
   */
  async findRecordByEmail(tableId: string, email: string): Promise<any | null> {
    try {
      const formula = encodeURIComponent(`{Email} = "${email}"`);
      const response = await this.request(
        `${tableId}?filterByFormula=${formula}&maxRecords=1`,
        'GET'
      );
      return response.records?.[0] || null;
    } catch (error) {
      console.error(`Error finding record by email in ${tableId}:`, error);
      return null;
    }
  }

  /**
   * Find a record by Email in Email leads table
   */
  async findEmailLead(email: string): Promise<any | null> {
    return this.findRecordByEmail(EMAIL_TABLE_ID, email);
  }

  /**
   * Find a record in Master Contacts by Email or Profile URL
   */
  async findMasterContact(params: { email?: string; profileUrl?: string }): Promise<any | null> {
    try {
      if (!params.email && !params.profileUrl) return null;

      let formula = '';
      if (params.email && params.profileUrl) {
        formula = `OR({Email} = "${params.email}", {Profile URL} = "${params.profileUrl}")`;
      } else if (params.email) {
        formula = `{Email} = "${params.email}"`;
      } else {
        formula = `{Profile URL} = "${params.profileUrl}"`;
      }

      const encodedFormula = encodeURIComponent(formula);
      const response = await this.request(
        `${CONTACTS_TABLE_ID}?filterByFormula=${encodedFormula}&maxRecords=1`,
        'GET'
      );
      return response.records?.[0] || null;
    } catch (error) {
      console.error('Error finding master contact:', error);
      return null;
    }
  }

  /**
   * Create or update a LinkedIn lead in Airtable
   */
  async syncLinkedInLead(data: LinkedInLeadData): Promise<{ success: boolean; recordId?: string; error?: string }> {
    try {
      console.log(`📊 Syncing LinkedIn lead to Airtable: ${data.name}`);

      // Sanitize intent - strip ALL quotes (including escaped quotes) that might have been added during JSON serialization
      // The error "\"Interested\"" shows escaped quotes need to be removed too
      // Dec 11 fix: Also handle double-double quotes ""value"" and any JSON.stringify artifacts
      let rawIntent = data.intent || '';

      // Aggressively strip all quote variants from raw intent
      const cleanIntent = rawIntent
        .replace(/\\+"/g, '')     // Remove any escaped quotes (\" or \\")
        .replace(/["'`]/g, '')    // Remove all quote characters
        .replace(/&quot;/gi, '')  // Remove HTML entities
        .trim()
        .toLowerCase();

      // Get status from lookup table, with fallback
      let status = cleanIntent ? INTENT_TO_STATUS[cleanIntent] || 'Interested' : 'Interested';

      // FINAL SAFETY: Strip any quotes from the final status value before sending to Airtable
      // This catches edge cases where the lookup value itself somehow has quotes
      status = status.replace(/["'`\\]/g, '').trim();

      console.log(`   Intent: "${data.intent}" -> cleanIntent: "${cleanIntent}" -> status: "${status}"`);

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
      if (data.companySize) fields['Company Size'] = data.companySize;

      // Check if record exists
      let existingRecord = null;
      if (data.profileUrl) {
        existingRecord = await this.findLinkedInLead(data.profileUrl);
      }

      if (existingRecord) {
        // Update existing record
        console.log(`📝 Updating existing Airtable record: ${existingRecord.id}`);
        const response = await this.request(LINKEDIN_TABLE_ID, 'PATCH', { fields }, existingRecord.id);

        // Dual-sync to Master Contacts
        await this.syncToMasterContacts({
          ...data,
          source: 'LinkedIn',
          status
        });

        console.log(`✅ Updated LinkedIn lead in Airtable: ${data.name}`);
        return { success: true, recordId: response.id };
      } else {
        // Create new record
        const response = await this.request(LINKEDIN_TABLE_ID, 'POST', {
          records: [{ fields }],
        });
        const recordId = response.records?.[0]?.id;

        // Dual-sync to Master Contacts
        await this.syncToMasterContacts({
          ...data,
          source: 'LinkedIn',
          status
        });

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

      // Sanitize intent - strip ALL quotes (including escaped quotes) that might have been added during JSON serialization
      // Dec 11 fix: Also handle double-double quotes ""value"" and any JSON.stringify artifacts
      let rawIntent = data.intent || '';

      const cleanIntent = rawIntent
        .replace(/\\+"/g, '')     // Remove any escaped quotes (\" or \\")
        .replace(/["'`]/g, '')    // Remove all quote characters
        .replace(/&quot;/gi, '')  // Remove HTML entities
        .trim()
        .toLowerCase();

      // Get status from lookup table, with fallback
      let status: string | undefined = cleanIntent ? INTENT_TO_STATUS[cleanIntent] || 'Interested' : undefined;

      // FINAL SAFETY: Strip any quotes from the final status value
      if (status) {
        status = status.replace(/["'`\\]/g, '').trim();
      }

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
      if (data.industry) fields['Industry'] = data.industry;
      if (data.companySize) fields['Company Size'] = data.companySize;

      // Check if record exists
      const existingRecord = await this.findEmailLead(data.email);

      if (existingRecord) {
        // Update existing record
        console.log(`📝 Updating existing email record: ${existingRecord.id}`);
        const response = await this.request(EMAIL_TABLE_ID, 'PATCH', { fields }, existingRecord.id);

        // Dual-sync to Master Contacts
        await this.syncToMasterContacts({
          email: data.email,
          name: data.name,
          country: data.country,
          industry: data.industry,
          companySize: data.companySize,
          replyText: data.replyText,
          intent: data.intent,
          source: 'Email',
          status
        });

        console.log(`✅ Updated email lead in Airtable: ${data.email}`);
        return { success: true, recordId: response.id };
      } else {
        // Create new record
        const response = await this.request(EMAIL_TABLE_ID, 'POST', {
          records: [{ fields }],
        });
        const recordId = response.records?.[0]?.id;

        // Dual-sync to Master Contacts
        await this.syncToMasterContacts({
          email: data.email,
          name: data.name,
          country: data.country,
          industry: data.industry,
          companySize: data.companySize,
          replyText: data.replyText,
          intent: data.intent,
          source: 'Email',
          status
        });

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
   * Create or update a Master Contact entry
   */
  async syncToMasterContacts(data: any): Promise<{ success: boolean; recordId?: string }> {
    try {
      console.log(`📊 Syncing to Master Contacts: ${data.name || data.email}`);

      const fields: Record<string, any> = {
        'Name': data.name,
        'Email': data.email,
        'Profile URL': data.profileUrl,
        'Job Title': data.jobTitle,
        'Company Name': data.companyName,
        'Industry': data.industry,
        'Country': data.country,
        'Company Size': data.companySize,
        'Source': data.source || 'Manual',
        'Status': data.status,
        'Last Interaction': new Date().toISOString()
      };

      // Find existing record
      const existingRecord = await this.findMasterContact({
        email: data.email,
        profileUrl: data.profileUrl
      });

      if (existingRecord) {
        await this.request(CONTACTS_TABLE_ID, 'PATCH', { fields }, existingRecord.id);
        return { success: true, recordId: existingRecord.id };
      } else {
        fields['Date Added'] = new Date().toISOString().split('T')[0];
        const response = await this.request(CONTACTS_TABLE_ID, 'POST', {
          records: [{ fields }]
        });
        return { success: true, recordId: response.records?.[0]?.id };
      }
    } catch (error) {
      console.error('❌ Master Contacts sync failed:', error);
      return { success: false };
    }
  }

  /**
   * Sync any prospect to Airtable (even without a reply)
   */
  async syncProspectToAirtable(prospect: any): Promise<{ success: boolean; recordId?: string; error?: string }> {
    return this.syncLinkedInLead({
      profileUrl: prospect.linkedin_url,
      name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
      jobTitle: prospect.title,
      companyName: prospect.company_name,
      industry: prospect.industry,
      country: prospect.location, // Mapping location to country
      companySize: prospect.company_size || prospect.personalization_data?.company_size,
    });
  }

  /**
   * List recently modified contacts from the Master Contacts table
   */
  async listRecentContacts(limit = 100): Promise<any[]> {
    try {
      // Sort by last modified - requires a 'Last Modified' field in Airtable or just poll
      // For now, we'll poll the most recent records based on our own 'Last Interaction' field
      const response = await this.request(
        `${CONTACTS_TABLE_ID}?sort%5B0%5D%5Bfield%5D=Last+Interaction&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=${limit}`,
        'GET'
      );
      return response.records || [];
    } catch (error) {
      console.error('❌ Error listing recent Airtable contacts:', error);
      return [];
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
