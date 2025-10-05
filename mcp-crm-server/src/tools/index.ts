/**
 * MCP Tools Registration
 * Exposes CRM operations as tools for SAM AI to use
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CRMAdapter } from '../types/crm.js';

export function registerCRMTools(server: Server, getAdapter: (workspaceId: string) => Promise<CRMAdapter>) {
  // Contact Tools
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const adapter = await getAdapter(args.workspace_id);

      switch (name) {
        // === CONTACT OPERATIONS ===
        case 'crm_get_contacts':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.getContacts(args.filters))
            }]
          };

        case 'crm_get_contact':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.getContact(args.contact_id))
            }]
          };

        case 'crm_create_contact':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.createContact(args.contact))
            }]
          };

        case 'crm_update_contact':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.updateContact(args.contact_id, args.updates))
            }]
          };

        case 'crm_delete_contact':
          await adapter.deleteContact(args.contact_id);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Contact deleted' })
            }]
          };

        case 'crm_search_contacts':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.searchContacts(args.query))
            }]
          };

        // === COMPANY OPERATIONS ===
        case 'crm_get_companies':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.getCompanies(args.filters))
            }]
          };

        case 'crm_get_company':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.getCompany(args.company_id))
            }]
          };

        case 'crm_create_company':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.createCompany(args.company))
            }]
          };

        case 'crm_update_company':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.updateCompany(args.company_id, args.updates))
            }]
          };

        case 'crm_delete_company':
          await adapter.deleteCompany(args.company_id);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Company deleted' })
            }]
          };

        case 'crm_search_companies':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.searchCompanies(args.query))
            }]
          };

        // === DEAL OPERATIONS ===
        case 'crm_get_deals':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.getDeals(args.filters))
            }]
          };

        case 'crm_get_deal':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.getDeal(args.deal_id))
            }]
          };

        case 'crm_create_deal':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.createDeal(args.deal))
            }]
          };

        case 'crm_update_deal':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.updateDeal(args.deal_id, args.updates))
            }]
          };

        case 'crm_delete_deal':
          await adapter.deleteDeal(args.deal_id);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Deal deleted' })
            }]
          };

        // === FIELD MAPPING ===
        case 'crm_get_available_fields':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.getAvailableFields(args.type))
            }]
          };

        case 'crm_get_field_mappings':
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(await adapter.getFieldMappings())
            }]
          };

        case 'crm_set_field_mapping':
          await adapter.setFieldMapping(args.mapping);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Field mapping saved' })
            }]
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
        }],
        isError: true
      };
    }
  });
}

export const CRM_TOOLS = [
  // Contact tools
  {
    name: 'crm_get_contacts',
    description: 'Retrieve contacts from connected CRM. Returns a list of contacts matching the filter criteria.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description: 'The workspace ID for multi-tenant isolation'
        },
        filters: {
          type: 'object',
          description: 'Optional filters to narrow down results',
          properties: {
            email: { type: 'string', description: 'Filter by email address' },
            company: { type: 'string', description: 'Filter by company name' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
            limit: { type: 'number', description: 'Maximum number of results (default: 100)' }
          }
        }
      },
      required: ['workspace_id']
    }
  },
  {
    name: 'crm_get_contact',
    description: 'Get a specific contact by ID from the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'The workspace ID' },
        contact_id: { type: 'string', description: 'The CRM contact ID' }
      },
      required: ['workspace_id', 'contact_id']
    }
  },
  {
    name: 'crm_create_contact',
    description: 'Create a new contact in the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'The workspace ID' },
        contact: {
          type: 'object',
          description: 'Contact details',
          properties: {
            email: { type: 'string', description: 'Contact email (required)' },
            firstName: { type: 'string', description: 'First name' },
            lastName: { type: 'string', description: 'Last name' },
            phone: { type: 'string', description: 'Phone number' },
            company: { type: 'string', description: 'Company name' },
            jobTitle: { type: 'string', description: 'Job title' }
          },
          required: ['email']
        }
      },
      required: ['workspace_id', 'contact']
    }
  },
  {
    name: 'crm_update_contact',
    description: 'Update an existing contact in the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'The workspace ID' },
        contact_id: { type: 'string', description: 'The CRM contact ID' },
        updates: {
          type: 'object',
          description: 'Fields to update',
          properties: {
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            company: { type: 'string' },
            jobTitle: { type: 'string' }
          }
        }
      },
      required: ['workspace_id', 'contact_id', 'updates']
    }
  },
  {
    name: 'crm_delete_contact',
    description: 'Delete a contact from the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'The workspace ID' },
        contact_id: { type: 'string', description: 'The CRM contact ID to delete' }
      },
      required: ['workspace_id', 'contact_id']
    }
  },
  {
    name: 'crm_search_contacts',
    description: 'Search for contacts in the CRM using a query string',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'The workspace ID' },
        query: { type: 'string', description: 'Search query (name, email, company, etc.)' }
      },
      required: ['workspace_id', 'query']
    }
  },

  // Company tools
  {
    name: 'crm_get_companies',
    description: 'Retrieve companies from connected CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'The workspace ID' },
        filters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Filter by company name' },
            domain: { type: 'string', description: 'Filter by domain' },
            industry: { type: 'string', description: 'Filter by industry' },
            limit: { type: 'number', description: 'Maximum number of results' }
          }
        }
      },
      required: ['workspace_id']
    }
  },
  {
    name: 'crm_get_company',
    description: 'Get a specific company by ID from the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        company_id: { type: 'string', description: 'The CRM company ID' }
      },
      required: ['workspace_id', 'company_id']
    }
  },
  {
    name: 'crm_create_company',
    description: 'Create a new company in the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        company: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Company name (required)' },
            domain: { type: 'string', description: 'Company website domain' },
            industry: { type: 'string', description: 'Industry' },
            size: { type: 'number', description: 'Number of employees' },
            phone: { type: 'string', description: 'Phone number' }
          },
          required: ['name']
        }
      },
      required: ['workspace_id', 'company']
    }
  },
  {
    name: 'crm_update_company',
    description: 'Update an existing company in the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        company_id: { type: 'string' },
        updates: { type: 'object', description: 'Fields to update' }
      },
      required: ['workspace_id', 'company_id', 'updates']
    }
  },
  {
    name: 'crm_delete_company',
    description: 'Delete a company from the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        company_id: { type: 'string' }
      },
      required: ['workspace_id', 'company_id']
    }
  },
  {
    name: 'crm_search_companies',
    description: 'Search for companies in the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        query: { type: 'string', description: 'Search query' }
      },
      required: ['workspace_id', 'query']
    }
  },

  // Deal tools
  {
    name: 'crm_get_deals',
    description: 'Retrieve deals/opportunities from connected CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        filters: {
          type: 'object',
          properties: {
            stage: { type: 'string', description: 'Filter by deal stage' },
            minAmount: { type: 'number', description: 'Minimum deal amount' },
            maxAmount: { type: 'number', description: 'Maximum deal amount' },
            contactId: { type: 'string', description: 'Filter by contact ID' },
            limit: { type: 'number' }
          }
        }
      },
      required: ['workspace_id']
    }
  },
  {
    name: 'crm_get_deal',
    description: 'Get a specific deal by ID from the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        deal_id: { type: 'string' }
      },
      required: ['workspace_id', 'deal_id']
    }
  },
  {
    name: 'crm_create_deal',
    description: 'Create a new deal/opportunity in the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        deal: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Deal name (required)' },
            amount: { type: 'number', description: 'Deal amount' },
            stage: { type: 'string', description: 'Deal stage' },
            contactId: { type: 'string', description: 'Associated contact ID' },
            closeDate: { type: 'string', description: 'Expected close date (ISO format)' }
          },
          required: ['name']
        }
      },
      required: ['workspace_id', 'deal']
    }
  },
  {
    name: 'crm_update_deal',
    description: 'Update an existing deal in the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        deal_id: { type: 'string' },
        updates: { type: 'object', description: 'Fields to update' }
      },
      required: ['workspace_id', 'deal_id', 'updates']
    }
  },
  {
    name: 'crm_delete_deal',
    description: 'Delete a deal from the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        deal_id: { type: 'string' }
      },
      required: ['workspace_id', 'deal_id']
    }
  },

  // Field mapping tools
  {
    name: 'crm_get_available_fields',
    description: 'Get all available fields in the CRM for a specific object type',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        type: {
          type: 'string',
          enum: ['contact', 'company', 'deal'],
          description: 'The object type to get fields for'
        }
      },
      required: ['workspace_id', 'type']
    }
  },
  {
    name: 'crm_get_field_mappings',
    description: 'Get current field mappings between SAM and CRM',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' }
      },
      required: ['workspace_id']
    }
  },
  {
    name: 'crm_set_field_mapping',
    description: 'Set a field mapping between SAM field and CRM field',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string' },
        mapping: {
          type: 'object',
          properties: {
            samField: { type: 'string', description: 'SAM field name' },
            crmField: { type: 'string', description: 'CRM field name' },
            fieldType: { type: 'string', enum: ['contact', 'company', 'deal'] }
          },
          required: ['samField', 'crmField', 'fieldType']
        }
      },
      required: ['workspace_id', 'mapping']
    }
  }
];
