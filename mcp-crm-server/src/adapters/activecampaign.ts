/**
 * ActiveCampaign CRM Adapter
 * Implements CRM operations for ActiveCampaign
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

export class ActiveCampaignAdapter extends BaseCRMAdapter {
  private baseUrl?: string;

  getCRMName(): string {
    return 'ActiveCampaign';
  }

  getCRMType(): CRMType {
    return 'activecampaign';
  }

  async authenticate(credentials: OAuthCredentials): Promise<void> {
    this.accessToken = credentials.accessToken;
    this.refreshTokenValue = credentials.refreshToken;
    // baseUrl is stored in crm_account_id in database
    this.baseUrl = credentials.instanceUrl;

    if (!this.baseUrl) {
      throw new Error('ActiveCampaign base URL is required');
    }

    // Verify authentication by testing the API
    try {
      await this.apiRequest('GET', '/api/3/users/me');
    } catch (error) {
      throw new Error(`ActiveCampaign authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshToken(refreshToken: string): Promise<OAuthCredentials> {
    // ActiveCampaign uses API keys, not OAuth refresh tokens
    throw new Error('ActiveCampaign uses API keys - token refresh not supported');
  }

  // === CONTACT OPERATIONS ===

  async getContacts(filters?: ContactFilter): Promise<Contact[]> {
    this.ensureAuthenticated();

    const params = new URLSearchParams();
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const response = await this.apiRequest('GET', `/api/3/contacts?${params}`);

    return response.contacts.map((ac: any) => this.mapToContact(ac));
  }

  async getContact(id: string): Promise<Contact> {
    this.ensureAuthenticated();
    const response = await this.apiRequest('GET', `/api/3/contacts/${id}`);
    return this.mapToContact(response.contact);
  }

  async createContact(contact: Partial<Contact>): Promise<Contact> {
    this.ensureAuthenticated();

    const contactData = {
      contact: {
        email: contact.email || `${contact.firstName?.toLowerCase()}.${contact.lastName?.toLowerCase()}@placeholder.com`,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        fieldValues: []
      }
    };

    const response = await this.apiRequest('POST', '/api/3/contacts', contactData);
    return this.mapToContact(response.contact);
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    this.ensureAuthenticated();

    const contactData = {
      contact: {
        email: updates.email,
        firstName: updates.firstName,
        lastName: updates.lastName,
        phone: updates.phone
      }
    };

    const response = await this.apiRequest('PUT', `/api/3/contacts/${id}`, contactData);
    return this.mapToContact(response.contact);
  }

  async deleteContact(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.apiRequest('DELETE', `/api/3/contacts/${id}`);
  }

  async searchContacts(query: string): Promise<Contact[]> {
    this.ensureAuthenticated();

    const response = await this.apiRequest('GET', `/api/3/contacts?search=${encodeURIComponent(query)}`);
    return response.contacts.map((ac: any) => this.mapToContact(ac));
  }

  // === COMPANY OPERATIONS ===

  async getCompanies(filters?: CompanyFilter): Promise<Company[]> {
    this.ensureAuthenticated();

    const params = new URLSearchParams();
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const response = await this.apiRequest('GET', `/api/3/accounts?${params}`);

    return response.accounts.map((ac: any) => this.mapToCompany(ac));
  }

  async getCompany(id: string): Promise<Company> {
    this.ensureAuthenticated();
    const response = await this.apiRequest('GET', `/api/3/accounts/${id}`);
    return this.mapToCompany(response.account);
  }

  async createCompany(company: Partial<Company>): Promise<Company> {
    this.ensureAuthenticated();

    const accountData = {
      account: {
        name: company.name,
        accountUrl: company.website
      }
    };

    const response = await this.apiRequest('POST', '/api/3/accounts', accountData);
    return this.mapToCompany(response.account);
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    this.ensureAuthenticated();

    const accountData = {
      account: {
        name: updates.name,
        accountUrl: updates.website
      }
    };

    const response = await this.apiRequest('PUT', `/api/3/accounts/${id}`, accountData);
    return this.mapToCompany(response.account);
  }

  async deleteCompany(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.apiRequest('DELETE', `/api/3/accounts/${id}`);
  }

  async searchCompanies(query: string): Promise<Company[]> {
    this.ensureAuthenticated();

    const response = await this.apiRequest('GET', `/api/3/accounts?search=${encodeURIComponent(query)}`);
    return response.accounts.map((ac: any) => this.mapToCompany(ac));
  }

  // === DEAL OPERATIONS ===

  async getDeals(filters?: DealFilter): Promise<Deal[]> {
    this.ensureAuthenticated();

    const params = new URLSearchParams();
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const response = await this.apiRequest('GET', `/api/3/deals?${params}`);

    return response.deals.map((deal: any) => this.mapToDeal(deal));
  }

  async getDeal(id: string): Promise<Deal> {
    this.ensureAuthenticated();
    const response = await this.apiRequest('GET', `/api/3/deals/${id}`);
    return this.mapToDeal(response.deal);
  }

  async createDeal(deal: Partial<Deal>): Promise<Deal> {
    this.ensureAuthenticated();

    const dealData = {
      deal: {
        title: deal.name,
        contact: deal.contactId,
        value: deal.amount || 0,
        currency: deal.currency || 'usd',
        description: deal.description,
        stage: deal.stage
      }
    };

    const response = await this.apiRequest('POST', '/api/3/deals', dealData);
    return this.mapToDeal(response.deal);
  }

  async updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
    this.ensureAuthenticated();

    const dealData = {
      deal: {
        title: updates.name,
        value: updates.amount,
        currency: updates.currency,
        description: updates.description,
        stage: updates.stage
      }
    };

    const response = await this.apiRequest('PUT', `/api/3/deals/${id}`, dealData);
    return this.mapToDeal(response.deal);
  }

  async deleteDeal(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.apiRequest('DELETE', `/api/3/deals/${id}`);
  }

  async getAvailableFields(type: 'contact' | 'company' | 'deal'): Promise<string[]> {
    this.ensureAuthenticated();

    const endpoint = type === 'contact' ? '/api/3/fields' :
                     type === 'company' ? '/api/3/accountCustomFieldMeta' :
                     '/api/3/dealCustomFieldMeta';

    const response = await this.apiRequest('GET', endpoint);

    if (type === 'contact') {
      return response.fields?.map((f: any) => f.title) || [];
    }
    return response.dealCustomFieldMeta?.map((f: any) => f.fieldLabel) || [];
  }

  // === HELPER METHODS ===

  private async apiRequest(method: string, endpoint: string, body?: any): Promise<any> {
    if (!this.baseUrl || !this.accessToken) {
      throw new Error('ActiveCampaign not authenticated');
    }

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Api-Token': this.accessToken,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ActiveCampaign API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private mapToContact(ac: any): Contact {
    return {
      id: ac.id,
      firstName: ac.firstName,
      lastName: ac.lastName,
      email: ac.email,
      phone: ac.phone,
      companyId: ac.account,
      createdAt: ac.cdate ? new Date(ac.cdate) : undefined,
      updatedAt: ac.udate ? new Date(ac.udate) : undefined,
      customFields: {}
    };
  }

  private mapToCompany(ac: any): Company {
    return {
      id: ac.id,
      name: ac.name,
      website: ac.accountUrl,
      createdAt: ac.created_timestamp ? new Date(ac.created_timestamp) : undefined,
      updatedAt: ac.updated_timestamp ? new Date(ac.updated_timestamp) : undefined,
      customFields: {}
    };
  }

  private mapToDeal(deal: any): Deal {
    return {
      id: deal.id,
      name: deal.title,
      amount: parseFloat(deal.value) || 0,
      currency: deal.currency || 'usd',
      stage: deal.stage,
      contactId: deal.contact,
      companyId: deal.account,
      description: deal.description,
      closeDate: deal.nexttaskid ? new Date(deal.nexttaskid) : undefined,
      createdAt: deal.cdate ? new Date(deal.cdate) : undefined,
      updatedAt: deal.udate ? new Date(deal.udate) : undefined,
      customFields: {}
    };
  }
}
