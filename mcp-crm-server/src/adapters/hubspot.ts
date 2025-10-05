/**
 * HubSpot CRM Adapter
 * Implementation for HubSpot CRM integration
 */

import { Client } from '@hubspot/api-client';
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

export class HubSpotAdapter extends BaseCRMAdapter {
  private client?: Client;

  getCRMName(): string {
    return 'HubSpot';
  }

  getCRMType(): CRMType {
    return 'hubspot';
  }

  async authenticate(credentials: OAuthCredentials): Promise<void> {
    this.accessToken = credentials.accessToken;
    this.refreshTokenValue = credentials.refreshToken;
    this.client = new Client({ accessToken: this.accessToken });
  }

  async refreshToken(refreshToken: string): Promise<OAuthCredentials> {
    // HubSpot OAuth refresh implementation
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        refresh_token: refreshToken
      })
    });

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000)
    };
  }

  // Contacts
  async getContacts(filters?: ContactFilter): Promise<Contact[]> {
    this.ensureAuthenticated();

    const searchRequest: any = {
      filterGroups: [],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle'],
      limit: filters?.limit || 100
    };

    if (filters?.email) {
      searchRequest.filterGroups.push({
        filters: [{ propertyName: 'email', operator: 'EQ', value: filters.email }]
      });
    }

    const response = await this.client!.crm.contacts.searchApi.doSearch(searchRequest);
    return response.results.map(this.mapHubSpotContact.bind(this));
  }

  async getContact(id: string): Promise<Contact> {
    this.ensureAuthenticated();
    const response = await this.client!.crm.contacts.basicApi.getById(id);
    return this.mapHubSpotContact(response);
  }

  async createContact(contact: Partial<Contact>): Promise<Contact> {
    this.ensureAuthenticated();

    const properties: any = {};
    if (contact.email) properties.email = contact.email;
    if (contact.firstName) properties.firstname = contact.firstName;
    if (contact.lastName) properties.lastname = contact.lastName;
    if (contact.phone) properties.phone = contact.phone;
    if (contact.company) properties.company = contact.company;
    if (contact.jobTitle) properties.jobtitle = contact.jobTitle;

    const response = await this.client!.crm.contacts.basicApi.create({ properties });
    return this.mapHubSpotContact(response);
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    this.ensureAuthenticated();

    const properties: any = {};
    if (updates.email) properties.email = updates.email;
    if (updates.firstName) properties.firstname = updates.firstName;
    if (updates.lastName) properties.lastname = updates.lastName;
    if (updates.phone) properties.phone = updates.phone;
    if (updates.company) properties.company = updates.company;
    if (updates.jobTitle) properties.jobtitle = updates.jobTitle;

    const response = await this.client!.crm.contacts.basicApi.update(id, { properties });
    return this.mapHubSpotContact(response);
  }

  async deleteContact(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.client!.crm.contacts.basicApi.archive(id);
  }

  async searchContacts(query: string): Promise<Contact[]> {
    this.ensureAuthenticated();

    const searchRequest = {
      query,
      properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle'],
      limit: 10
    };

    const response = await this.client!.crm.contacts.searchApi.doSearch(searchRequest);
    return response.results.map(this.mapHubSpotContact.bind(this));
  }

  // Companies
  async getCompanies(filters?: CompanyFilter): Promise<Company[]> {
    this.ensureAuthenticated();

    const searchRequest: any = {
      filterGroups: [],
      properties: ['name', 'domain', 'industry', 'numberofemployees', 'phone', 'address'],
      limit: filters?.limit || 100
    };

    if (filters?.name) {
      searchRequest.filterGroups.push({
        filters: [{ propertyName: 'name', operator: 'EQ', value: filters.name }]
      });
    }

    const response = await this.client!.crm.companies.searchApi.doSearch(searchRequest);
    return response.results.map(this.mapHubSpotCompany.bind(this));
  }

  async getCompany(id: string): Promise<Company> {
    this.ensureAuthenticated();
    const response = await this.client!.crm.companies.basicApi.getById(id);
    return this.mapHubSpotCompany(response);
  }

  async createCompany(company: Partial<Company>): Promise<Company> {
    this.ensureAuthenticated();

    const properties: any = {};
    if (company.name) properties.name = company.name;
    if (company.domain) properties.domain = company.domain;
    if (company.industry) properties.industry = company.industry;
    if (company.size) properties.numberofemployees = company.size;
    if (company.phone) properties.phone = company.phone;
    if (company.address) properties.address = company.address;

    const response = await this.client!.crm.companies.basicApi.create({ properties });
    return this.mapHubSpotCompany(response);
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    this.ensureAuthenticated();

    const properties: any = {};
    if (updates.name) properties.name = updates.name;
    if (updates.domain) properties.domain = updates.domain;
    if (updates.industry) properties.industry = updates.industry;
    if (updates.size) properties.numberofemployees = updates.size;
    if (updates.phone) properties.phone = updates.phone;
    if (updates.address) properties.address = updates.address;

    const response = await this.client!.crm.companies.basicApi.update(id, { properties });
    return this.mapHubSpotCompany(response);
  }

  async deleteCompany(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.client!.crm.companies.basicApi.archive(id);
  }

  async searchCompanies(query: string): Promise<Company[]> {
    this.ensureAuthenticated();

    const searchRequest = {
      query,
      properties: ['name', 'domain', 'industry', 'numberofemployees', 'phone', 'address'],
      limit: 10
    };

    const response = await this.client!.crm.companies.searchApi.doSearch(searchRequest);
    return response.results.map(this.mapHubSpotCompany.bind(this));
  }

  // Deals
  async getDeals(filters?: DealFilter): Promise<Deal[]> {
    this.ensureAuthenticated();

    const searchRequest: any = {
      filterGroups: [],
      properties: ['dealname', 'amount', 'dealstage', 'closedate', 'pipeline'],
      limit: filters?.limit || 100
    };

    if (filters?.stage) {
      searchRequest.filterGroups.push({
        filters: [{ propertyName: 'dealstage', operator: 'EQ', value: filters.stage }]
      });
    }

    const response = await this.client!.crm.deals.searchApi.doSearch(searchRequest);
    return response.results.map(this.mapHubSpotDeal.bind(this));
  }

  async getDeal(id: string): Promise<Deal> {
    this.ensureAuthenticated();
    const response = await this.client!.crm.deals.basicApi.getById(id);
    return this.mapHubSpotDeal(response);
  }

  async createDeal(deal: Partial<Deal>): Promise<Deal> {
    this.ensureAuthenticated();

    const properties: any = {};
    if (deal.name) properties.dealname = deal.name;
    if (deal.amount) properties.amount = deal.amount;
    if (deal.stage) properties.dealstage = deal.stage;
    if (deal.closeDate) properties.closedate = deal.closeDate.toISOString();

    const response = await this.client!.crm.deals.basicApi.create({ properties });
    return this.mapHubSpotDeal(response);
  }

  async updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
    this.ensureAuthenticated();

    const properties: any = {};
    if (updates.name) properties.dealname = updates.name;
    if (updates.amount) properties.amount = updates.amount;
    if (updates.stage) properties.dealstage = updates.stage;
    if (updates.closeDate) properties.closedate = updates.closeDate.toISOString();

    const response = await this.client!.crm.deals.basicApi.update(id, { properties });
    return this.mapHubSpotDeal(response);
  }

  async deleteDeal(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.client!.crm.deals.basicApi.archive(id);
  }

  // Field Mapping
  async getAvailableFields(type: 'contact' | 'company' | 'deal'): Promise<string[]> {
    this.ensureAuthenticated();

    let properties: any[];
    if (type === 'contact') {
      const response = await this.client!.crm.properties.coreApi.getAll('contacts');
      properties = response.results;
    } else if (type === 'company') {
      const response = await this.client!.crm.properties.coreApi.getAll('companies');
      properties = response.results;
    } else {
      const response = await this.client!.crm.properties.coreApi.getAll('deals');
      properties = response.results;
    }

    return properties.map(p => p.name);
  }

  // Mapping helpers
  private mapHubSpotContact(hsContact: any): Contact {
    return {
      id: hsContact.id,
      email: hsContact.properties.email || '',
      firstName: hsContact.properties.firstname,
      lastName: hsContact.properties.lastname,
      phone: hsContact.properties.phone,
      company: hsContact.properties.company,
      jobTitle: hsContact.properties.jobtitle,
      customFields: hsContact.properties,
      createdAt: new Date(hsContact.createdAt),
      updatedAt: new Date(hsContact.updatedAt)
    };
  }

  private mapHubSpotCompany(hsCompany: any): Company {
    return {
      id: hsCompany.id,
      name: hsCompany.properties.name || '',
      domain: hsCompany.properties.domain,
      industry: hsCompany.properties.industry,
      size: hsCompany.properties.numberofemployees ? parseInt(hsCompany.properties.numberofemployees) : undefined,
      phone: hsCompany.properties.phone,
      address: hsCompany.properties.address,
      customFields: hsCompany.properties,
      createdAt: new Date(hsCompany.createdAt),
      updatedAt: new Date(hsCompany.updatedAt)
    };
  }

  private mapHubSpotDeal(hsDeal: any): Deal {
    return {
      id: hsDeal.id,
      name: hsDeal.properties.dealname || '',
      amount: hsDeal.properties.amount ? parseFloat(hsDeal.properties.amount) : undefined,
      stage: hsDeal.properties.dealstage || '',
      closeDate: hsDeal.properties.closedate ? new Date(hsDeal.properties.closedate) : undefined,
      customFields: hsDeal.properties,
      createdAt: new Date(hsDeal.createdAt),
      updatedAt: new Date(hsDeal.updatedAt)
    };
  }
}
