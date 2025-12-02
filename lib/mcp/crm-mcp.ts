/**
 * CRM MCP Server for SAM AI Platform
 *
 * Unified CRM integration supporting HubSpot, ActiveCampaign, Airtable, Salesforce, and more
 * Provides contact, company, and deal management across multiple CRM platforms
 */

import { MCPTool, MCPCallToolRequest, MCPCallToolResult } from './types'

export interface CRMMCPConfig {
  workspaceId: string
  organizationId: string
  userId: string
}

export interface CRMContact {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  companyId?: string
  jobTitle?: string
  customFields?: Record<string, any>
  createdAt?: Date
  updatedAt?: Date
}

export interface CRMCompany {
  id: string
  name: string
  domain?: string
  industry?: string
  website?: string
  customFields?: Record<string, any>
  createdAt?: Date
  updatedAt?: Date
}

export interface CRMDeal {
  id: string
  name: string
  amount: number
  currency?: string
  stage?: string
  closeDate?: Date
  probability?: number
  contactId?: string
  companyId?: string
  customFields?: Record<string, any>
  createdAt?: Date
  updatedAt?: Date
}

export class CRMMCPServer {
  private config: CRMMCPConfig

  constructor(config: CRMMCPConfig) {
    this.config = config
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return {
      tools: [
        // Contact Operations
        {
          name: 'crm_create_contact',
          description: 'Create a new contact in the connected CRM system',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string', description: 'Workspace ID with CRM connection' },
              crm_type: { type: 'string', description: 'CRM type (hubspot, activecampaign, airtable, salesforce)' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              company: { type: 'string' },
              jobTitle: { type: 'string' },
              customFields: { type: 'object' }
            },
            required: ['workspace_id', 'crm_type']
          }
        },
        {
          name: 'crm_get_contacts',
          description: 'Get contacts from the connected CRM system',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              limit: { type: 'number', default: 50 },
              offset: { type: 'number', default: 0 }
            },
            required: ['workspace_id', 'crm_type']
          }
        },
        {
          name: 'crm_get_contact',
          description: 'Get a specific contact by ID',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              contact_id: { type: 'string' }
            },
            required: ['workspace_id', 'crm_type', 'contact_id']
          }
        },
        {
          name: 'crm_update_contact',
          description: 'Update an existing contact',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              contact_id: { type: 'string' },
              updates: { type: 'object' }
            },
            required: ['workspace_id', 'crm_type', 'contact_id', 'updates']
          }
        },
        {
          name: 'crm_delete_contact',
          description: 'Delete a contact from CRM',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              contact_id: { type: 'string' }
            },
            required: ['workspace_id', 'crm_type', 'contact_id']
          }
        },
        {
          name: 'crm_search_contacts',
          description: 'Search for contacts by query',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              query: { type: 'string' }
            },
            required: ['workspace_id', 'crm_type', 'query']
          }
        },

        // Company Operations
        {
          name: 'crm_create_company',
          description: 'Create a new company in the connected CRM',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              name: { type: 'string' },
              domain: { type: 'string' },
              industry: { type: 'string' },
              website: { type: 'string' },
              customFields: { type: 'object' }
            },
            required: ['workspace_id', 'crm_type', 'name']
          }
        },
        {
          name: 'crm_get_companies',
          description: 'Get companies from the connected CRM',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              limit: { type: 'number', default: 50 },
              offset: { type: 'number', default: 0 }
            },
            required: ['workspace_id', 'crm_type']
          }
        },
        {
          name: 'crm_search_companies',
          description: 'Search for companies by query',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              query: { type: 'string' }
            },
            required: ['workspace_id', 'crm_type', 'query']
          }
        },

        // Deal Operations
        {
          name: 'crm_create_deal',
          description: 'Create a new deal/opportunity in the CRM',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              name: { type: 'string' },
              amount: { type: 'number' },
              currency: { type: 'string', default: 'USD' },
              stage: { type: 'string' },
              contactId: { type: 'string' },
              companyId: { type: 'string' },
              closeDate: { type: 'string' },
              customFields: { type: 'object' }
            },
            required: ['workspace_id', 'crm_type', 'name']
          }
        },
        {
          name: 'crm_get_deals',
          description: 'Get deals from the connected CRM',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              limit: { type: 'number', default: 50 },
              offset: { type: 'number', default: 0 }
            },
            required: ['workspace_id', 'crm_type']
          }
        },

        // Field Mapping
        {
          name: 'crm_get_available_fields',
          description: 'Get available fields for contact, company, or deal in the CRM',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' },
              crm_type: { type: 'string' },
              object_type: {
                type: 'string',
                enum: ['contact', 'company', 'deal'],
                description: 'Type of object to get fields for'
              }
            },
            required: ['workspace_id', 'crm_type', 'object_type']
          }
        },

        // Connection Management
        {
          name: 'crm_get_connection_status',
          description: 'Check the status of CRM connection for a workspace',
          inputSchema: {
            type: 'object',
            properties: {
              workspace_id: { type: 'string' }
            },
            required: ['workspace_id']
          }
        }
      ]
    }
  }

  async callTool(request: MCPCallToolRequest): Promise<MCPCallToolResult> {
    try {
      const toolName = request.params.name
      const args = request.params.arguments || {}

      // All CRM tools are proxied to the backend API which uses the MCP CRM server
      // The backend handles authentication, token refresh, and adapter instantiation
      const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      switch (toolName) {
        case 'crm_create_contact':
          return await this.makeAPIRequest('POST', `${apiUrl}/api/crm/contacts`, args)

        case 'crm_get_contacts':
          return await this.makeAPIRequest('GET', `${apiUrl}/api/crm/contacts`, args)

        case 'crm_get_contact':
          return await this.makeAPIRequest('GET', `${apiUrl}/api/crm/contacts/${args.contact_id}`, args)

        case 'crm_update_contact':
          return await this.makeAPIRequest('PATCH', `${apiUrl}/api/crm/contacts/${args.contact_id}`, args)

        case 'crm_delete_contact':
          return await this.makeAPIRequest('DELETE', `${apiUrl}/api/crm/contacts/${args.contact_id}`, args)

        case 'crm_search_contacts':
          return await this.makeAPIRequest('GET', `${apiUrl}/api/crm/contacts/search`, args)

        case 'crm_create_company':
          return await this.makeAPIRequest('POST', `${apiUrl}/api/crm/companies`, args)

        case 'crm_get_companies':
          return await this.makeAPIRequest('GET', `${apiUrl}/api/crm/companies`, args)

        case 'crm_search_companies':
          return await this.makeAPIRequest('GET', `${apiUrl}/api/crm/companies/search`, args)

        case 'crm_create_deal':
          return await this.makeAPIRequest('POST', `${apiUrl}/api/crm/deals`, args)

        case 'crm_get_deals':
          return await this.makeAPIRequest('GET', `${apiUrl}/api/crm/deals`, args)

        case 'crm_get_available_fields':
          return await this.makeAPIRequest('GET', `${apiUrl}/api/crm/fields`, args)

        case 'crm_get_connection_status':
          return await this.makeAPIRequest('GET', `${apiUrl}/api/crm/status`, args)

        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown CRM tool: ${toolName}`
            }],
            isError: true
          }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `CRM MCP error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async makeAPIRequest(
    method: string,
    url: string,
    args: any
  ): Promise<MCPCallToolResult> {
    try {
      const params = new URLSearchParams()
      if (args.workspace_id) params.append('workspace_id', args.workspace_id)
      if (args.crm_type) params.append('crm_type', args.crm_type)
      if (args.limit) params.append('limit', String(args.limit))
      if (args.offset) params.append('offset', String(args.offset))
      if (args.query) params.append('query', args.query)
      if (args.object_type) params.append('object_type', args.object_type)

      const fetchUrl = method === 'GET' ? `${url}?${params}` : url

      const response = await fetch(fetchUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': this.config.organizationId,
          'X-User-Id': this.config.userId
        },
        body: method !== 'GET' && method !== 'DELETE' ? JSON.stringify(args) : undefined
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }],
        isError: false
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `CRM API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }
}
