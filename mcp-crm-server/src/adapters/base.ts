/**
 * Base CRM Adapter
 * Abstract base class for all CRM adapters
 */

import {
  CRMAdapter,
  Contact,
  Company,
  Deal,
  ContactFilter,
  CompanyFilter,
  DealFilter,
  FieldMapping,
  OAuthCredentials,
  CRMType
} from '../types/crm.js';

export abstract class BaseCRMAdapter implements CRMAdapter {
  protected accessToken?: string;
  protected refreshTokenValue?: string;
  protected fieldMappings: Map<string, FieldMapping> = new Map();

  abstract getCRMName(): string;
  abstract getCRMType(): CRMType;

  // Authentication
  abstract authenticate(credentials: OAuthCredentials): Promise<void>;
  abstract refreshToken(refreshToken: string): Promise<OAuthCredentials>;

  // Contacts
  abstract getContacts(filters?: ContactFilter): Promise<Contact[]>;
  abstract getContact(id: string): Promise<Contact>;
  abstract createContact(contact: Partial<Contact>): Promise<Contact>;
  abstract updateContact(id: string, updates: Partial<Contact>): Promise<Contact>;
  abstract deleteContact(id: string): Promise<void>;
  abstract searchContacts(query: string): Promise<Contact[]>;

  // Companies
  abstract getCompanies(filters?: CompanyFilter): Promise<Company[]>;
  abstract getCompany(id: string): Promise<Company>;
  abstract createCompany(company: Partial<Company>): Promise<Company>;
  abstract updateCompany(id: string, updates: Partial<Company>): Promise<Company>;
  abstract deleteCompany(id: string): Promise<void>;
  abstract searchCompanies(query: string): Promise<Company[]>;

  // Deals
  abstract getDeals(filters?: DealFilter): Promise<Deal[]>;
  abstract getDeal(id: string): Promise<Deal>;
  abstract createDeal(deal: Partial<Deal>): Promise<Deal>;
  abstract updateDeal(id: string, updates: Partial<Deal>): Promise<Deal>;
  abstract deleteDeal(id: string): Promise<void>;

  // Field Mapping
  abstract getAvailableFields(type: 'contact' | 'company' | 'deal'): Promise<string[]>;

  async getFieldMappings(): Promise<FieldMapping[]> {
    return Array.from(this.fieldMappings.values());
  }

  async setFieldMapping(mapping: FieldMapping): Promise<void> {
    const key = `${mapping.fieldType}:${mapping.samField}`;
    this.fieldMappings.set(key, mapping);
  }

  // Helper methods
  protected ensureAuthenticated(): void {
    if (!this.accessToken) {
      throw new Error(`${this.getCRMName()} adapter not authenticated. Call authenticate() first.`);
    }
  }

  protected mapField(samField: string, fieldType: 'contact' | 'company' | 'deal'): string {
    const key = `${fieldType}:${samField}`;
    const mapping = this.fieldMappings.get(key);
    return mapping?.crmField || samField;
  }
}
