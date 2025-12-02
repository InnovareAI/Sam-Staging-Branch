/**
 * Airtable CRM Adapter
 * Implements CRM operations for Airtable bases
 */

import { BaseCRMAdapter } from './base.js';
import {
  Contact,
  Company,
  Deal,
  ContactFilter,
  CompanyFilter,
  DealFilter,
  OAuthCredentials,
  CRMType
} from '../types/crm.js';

export class AirtableAdapter extends BaseCRMAdapter {
  private baseId?: string;
  private contactsTable: string = 'Contacts';
  private companiesTable: string = 'Companies';
  private dealsTable: string = 'Deals';

  getCRMName(): string {
    return 'Airtable';
  }

  getCRMType(): CRMType {
    return 'airtable';
  }

  async authenticate(credentials: OAuthCredentials): Promise<void> {
    this.accessToken = credentials.accessToken;
    // baseId is stored in crm_account_id in database
    this.baseId = credentials.instanceUrl;

    if (!this.baseId) {
      throw new Error('Airtable base ID is required');
    }

    // Verify authentication by testing the API
    try {
      await this.apiRequest('GET', `/v0/${this.baseId}/${encodeURIComponent(this.contactsTable)}?maxRecords=1`);
    } catch (error) {
      throw new Error(`Airtable authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<OAuthCredentials> {
    // Airtable uses API keys/personal access tokens, not OAuth refresh
    throw new Error('Airtable uses access tokens - token refresh not supported');
  }

  // === CONTACT OPERATIONS ===

  async getContacts(filters?: ContactFilter): Promise<Contact[]> {
    this.ensureAuthenticated();

    const params = new URLSearchParams();
    if (filters?.limit) params.set('maxRecords', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const response = await this.apiRequest('GET', `/v0/${this.baseId}/${encodeURIComponent(this.contactsTable)}?${params}`);

    return response.records.map((record: any) => this.mapToContact(record));
  }

  async getContact(id: string): Promise<Contact> {
    this.ensureAuthenticated();
    const response = await this.apiRequest('GET', `/v0/${this.baseId}/${encodeURIComponent(this.contactsTable)}/${id}`);
    return this.mapToContact(response);
  }

  async createContact(contact: Partial<Contact>): Promise<Contact> {
    this.ensureAuthenticated();

    const fields: any = {
      'Name': `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      'First Name': contact.firstName,
      'Last Name': contact.lastName,
      'Email': contact.email,
      'Phone': contact.phone,
      'Created At': new Date().toISOString()
    };

    // Add custom fields
    if (contact.customFields) {
      Object.entries(contact.customFields).forEach(([key, value]) => {
        fields[key] = value;
      });
    }

    const response = await this.apiRequest('POST', `/v0/${this.baseId}/${encodeURIComponent(this.contactsTable)}`, {
      fields
    });

    return this.mapToContact(response);
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    this.ensureAuthenticated();

    const fields: any = {};
    if (updates.firstName) fields['First Name'] = updates.firstName;
    if (updates.lastName) fields['Last Name'] = updates.lastName;
    if (updates.email) fields['Email'] = updates.email;
    if (updates.phone) fields['Phone'] = updates.phone;

    if (updates.firstName || updates.lastName) {
      fields['Name'] = `${updates.firstName || ''} ${updates.lastName || ''}`.trim();
    }

    const response = await this.apiRequest('PATCH', `/v0/${this.baseId}/${encodeURIComponent(this.contactsTable)}/${id}`, {
      fields
    });

    return this.mapToContact(response);
  }

  async deleteContact(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.apiRequest('DELETE', `/v0/${this.baseId}/${encodeURIComponent(this.contactsTable)}/${id}`);
  }

  async searchContacts(query: string): Promise<Contact[]> {
    this.ensureAuthenticated();

    // Airtable uses filterByFormula for searching
    const formula = `OR(FIND('${query}', {Name}), FIND('${query}', {Email}))`;
    const params = new URLSearchParams();
    params.set('filterByFormula', formula);

    const response = await this.apiRequest('GET', `/v0/${this.baseId}/${encodeURIComponent(this.contactsTable)}?${params}`);

    return response.records.map((record: any) => this.mapToContact(record));
  }

  // === COMPANY OPERATIONS ===

  async getCompanies(filters?: CompanyFilter): Promise<Company[]> {
    this.ensureAuthenticated();

    const params = new URLSearchParams();
    if (filters?.limit) params.set('maxRecords', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const response = await this.apiRequest('GET', `/v0/${this.baseId}/${encodeURIComponent(this.companiesTable)}?${params}`);

    return response.records.map((record: any) => this.mapToCompany(record));
  }

  async getCompany(id: string): Promise<Company> {
    this.ensureAuthenticated();
    const response = await this.apiRequest('GET', `/v0/${this.baseId}/${encodeURIComponent(this.companiesTable)}/${id}`);
    return this.mapToCompany(response);
  }

  async createCompany(company: Partial<Company>): Promise<Company> {
    this.ensureAuthenticated();

    const fields: any = {
      'Name': company.name,
      'Website': company.website,
      'Created At': new Date().toISOString()
    };

    if (company.customFields) {
      Object.entries(company.customFields).forEach(([key, value]) => {
        fields[key] = value;
      });
    }

    const response = await this.apiRequest('POST', `/v0/${this.baseId}/${encodeURIComponent(this.companiesTable)}`, {
      fields
    });

    return this.mapToCompany(response);
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    this.ensureAuthenticated();

    const fields: any = {};
    if (updates.name) fields['Name'] = updates.name;
    if (updates.website) fields['Website'] = updates.website;

    const response = await this.apiRequest('PATCH', `/v0/${this.baseId}/${encodeURIComponent(this.companiesTable)}/${id}`, {
      fields
    });

    return this.mapToCompany(response);
  }

  async deleteCompany(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.apiRequest('DELETE', `/v0/${this.baseId}/${encodeURIComponent(this.companiesTable)}/${id}`);
  }

  async searchCompanies(query: string): Promise<Company[]> {
    this.ensureAuthenticated();

    const formula = `OR(FIND('${query}', {Name}), FIND('${query}', {Website}))`;
    const params = new URLSearchParams();
    params.set('filterByFormula', formula);

    const response = await this.apiRequest('GET', `/v0/${this.baseId}/${encodeURIComponent(this.companiesTable)}?${params}`);

    return response.records.map((record: any) => this.mapToCompany(record));
  }

  // === DEAL OPERATIONS ===

  async getDeals(filters?: DealFilter): Promise<Deal[]> {
    this.ensureAuthenticated();

    const params = new URLSearchParams();
    if (filters?.limit) params.set('maxRecords', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const response = await this.apiRequest('GET', `/v0/${this.baseId}/${encodeURIComponent(this.dealsTable)}?${params}`);

    return response.records.map((record: any) => this.mapToDeal(record));
  }

  async getDeal(id: string): Promise<Deal> {
    this.ensureAuthenticated();
    const response = await this.apiRequest('GET', `/v0/${this.baseId}/${encodeURIComponent(this.dealsTable)}/${id}`);
    return this.mapToDeal(response);
  }

  async createDeal(deal: Partial<Deal>): Promise<Deal> {
    this.ensureAuthenticated();

    const fields: any = {
      'Name': deal.name,
      'Amount': deal.amount || 0,
      'Currency': deal.currency || 'USD',
      'Stage': deal.stage,
      'Description': deal.description,
      'Created At': new Date().toISOString()
    };

    if (deal.customFields) {
      Object.entries(deal.customFields).forEach(([key, value]) => {
        fields[key] = value;
      });
    }

    const response = await this.apiRequest('POST', `/v0/${this.baseId}/${encodeURIComponent(this.dealsTable)}`, {
      fields
    });

    return this.mapToDeal(response);
  }

  async updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
    this.ensureAuthenticated();

    const fields: any = {};
    if (updates.name) fields['Name'] = updates.name;
    if (updates.amount !== undefined) fields['Amount'] = updates.amount;
    if (updates.currency) fields['Currency'] = updates.currency;
    if (updates.stage) fields['Stage'] = updates.stage;
    if (updates.description) fields['Description'] = updates.description;

    const response = await this.apiRequest('PATCH', `/v0/${this.baseId}/${encodeURIComponent(this.dealsTable)}/${id}`, {
      fields
    });

    return this.mapToDeal(response);
  }

  async deleteDeal(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.apiRequest('DELETE', `/v0/${this.baseId}/${encodeURIComponent(this.dealsTable)}/${id}`);
  }

  async getAvailableFields(type: 'contact' | 'company' | 'deal'): Promise<string[]> {
    this.ensureAuthenticated();

    const tableName = type === 'contact' ? this.contactsTable :
                      type === 'company' ? this.companiesTable :
                      this.dealsTable;

    const response = await this.apiRequest('GET', `/v0/meta/bases/${this.baseId}/tables`);

    const table = response.tables.find((t: any) => t.name === tableName);
    return table?.fields.map((f: any) => f.name) || [];
  }

  // === HELPER METHODS ===

  private async apiRequest(method: string, endpoint: string, body?: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Airtable not authenticated');
    }

    const url = `https://api.airtable.com${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private mapToContact(record: any): Contact {
    const fields = record.fields;
    return {
      id: record.id,
      firstName: fields['First Name'],
      lastName: fields['Last Name'],
      email: fields['Email'],
      phone: fields['Phone'],
      companyId: fields['Company']?.[0], // Airtable links are arrays
      createdAt: fields['Created At'] ? new Date(fields['Created At']) : undefined,
      customFields: this.extractCustomFields(fields, ['Name', 'First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Created At'])
    };
  }

  private mapToCompany(record: any): Company {
    const fields = record.fields;
    return {
      id: record.id,
      name: fields['Name'],
      website: fields['Website'],
      createdAt: fields['Created At'] ? new Date(fields['Created At']) : undefined,
      customFields: this.extractCustomFields(fields, ['Name', 'Website', 'Created At'])
    };
  }

  private mapToDeal(record: any): Deal {
    const fields = record.fields;
    return {
      id: record.id,
      name: fields['Name'],
      amount: fields['Amount'] || 0,
      currency: fields['Currency'] || 'USD',
      stage: fields['Stage'],
      description: fields['Description'],
      closeDate: fields['Close Date'] ? new Date(fields['Close Date']) : undefined,
      createdAt: fields['Created At'] ? new Date(fields['Created At']) : undefined,
      customFields: this.extractCustomFields(fields, ['Name', 'Amount', 'Currency', 'Stage', 'Description', 'Close Date', 'Created At'])
    };
  }

  private extractCustomFields(fields: any, standardFields: string[]): Record<string, any> {
    const custom: Record<string, any> = {};
    Object.entries(fields).forEach(([key, value]) => {
      if (!standardFields.includes(key)) {
        custom[key] = value;
      }
    });
    return custom;
  }
}
