/**
 * CRM Integration Types
 * Standardized data models across all CRM platforms
 */

// Base types
export interface Contact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: number;
  phone?: string;
  address?: string;
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  id: string;
  name: string;
  amount?: number;
  currency?: string;
  stage: string;
  contactId?: string;
  companyId?: string;
  probability?: number;
  closeDate?: Date;
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Filter types
export interface ContactFilter {
  email?: string;
  company?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface CompanyFilter {
  name?: string;
  domain?: string;
  industry?: string;
  limit?: number;
  offset?: number;
}

export interface DealFilter {
  stage?: string;
  minAmount?: number;
  maxAmount?: number;
  contactId?: string;
  companyId?: string;
  limit?: number;
  offset?: number;
}

// Field mapping
export interface FieldMapping {
  samField: string;
  crmField: string;
  fieldType: 'contact' | 'company' | 'deal';
  dataType?: 'string' | 'number' | 'boolean' | 'date' | 'array';
}

// OAuth credentials
export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string[];
}

// CRM Adapter Interface
export interface CRMAdapter {
  // Authentication
  authenticate(credentials: OAuthCredentials): Promise<void>;
  refreshToken(refreshToken: string): Promise<OAuthCredentials>;

  // Contacts
  getContacts(filters?: ContactFilter): Promise<Contact[]>;
  getContact(id: string): Promise<Contact>;
  createContact(contact: Partial<Contact>): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  searchContacts(query: string): Promise<Contact[]>;

  // Companies
  getCompanies(filters?: CompanyFilter): Promise<Company[]>;
  getCompany(id: string): Promise<Company>;
  createCompany(company: Partial<Company>): Promise<Company>;
  updateCompany(id: string, updates: Partial<Company>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;
  searchCompanies(query: string): Promise<Company[]>;

  // Deals
  getDeals(filters?: DealFilter): Promise<Deal[]>;
  getDeal(id: string): Promise<Deal>;
  createDeal(deal: Partial<Deal>): Promise<Deal>;
  updateDeal(id: string, updates: Partial<Deal>): Promise<Deal>;
  deleteDeal(id: string): Promise<void>;

  // Field Mapping
  getAvailableFields(type: 'contact' | 'company' | 'deal'): Promise<string[]>;
  getFieldMappings(): Promise<FieldMapping[]>;
  setFieldMapping(mapping: FieldMapping): Promise<void>;

  // Metadata
  getCRMName(): string;
  getCRMType(): CRMType;
}

// Supported CRM types
export type CRMType =
  | 'hubspot'
  | 'salesforce'
  | 'pipedrive'
  | 'zoho'
  | 'activecampaign'
  | 'keap'
  | 'close'
  | 'copper'
  | 'freshsales';

// Workspace context for multi-tenancy
export interface WorkspaceContext {
  workspaceId: string;
  crmType: CRMType;
  credentials: OAuthCredentials;
  fieldMappings?: FieldMapping[];
}
