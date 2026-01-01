/**
 * MCP CRM Server Entry Point
 * Main server that handles CRM integrations through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { CRMAdapter } from './types/crm.js';
import { HubSpotAdapter } from './adapters/hubspot.js';
import { ActiveCampaignAdapter } from './adapters/activecampaign.js';
import { AirtableAdapter } from './adapters/airtable.js';
import { registerCRMTools } from './tools/index.js';

// Initialize Supabase client
// Cache adapters by workspace to avoid re-authentication
const adapterCache = new Map<string, CRMAdapter>();

/**
 * Get or create CRM adapter for a workspace
 */
async function getAdapter(workspaceId: string): Promise<CRMAdapter> {
  // Check cache first
  if (adapterCache.has(workspaceId)) {
    return adapterCache.get(workspaceId)!;
  }

  // Fetch CRM connection from database
  const { data: connection, error } = await supabase
    .from('crm_connections')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .single();

  if (error || !connection) {
    throw new Error(`No active CRM connection found for workspace ${workspaceId}`);
  }

  // Instantiate appropriate adapter
  let adapter: CRMAdapter;

  switch (connection.crm_type) {
    case 'hubspot':
      adapter = new HubSpotAdapter();
      break;
    case 'activecampaign':
      adapter = new ActiveCampaignAdapter();
      break;
    case 'airtable':
      adapter = new AirtableAdapter();
      break;
    case 'salesforce':
      // TODO: Implement Salesforce adapter
      throw new Error('Salesforce adapter not yet implemented');
    case 'pipedrive':
      // TODO: Implement Pipedrive adapter
      throw new Error('Pipedrive adapter not yet implemented');
    case 'zoho':
      // TODO: Implement Zoho adapter
      throw new Error('Zoho adapter not yet implemented');
    case 'keap':
      // TODO: Implement Keap adapter
      throw new Error('Keap adapter not yet implemented');
    case 'close':
      // TODO: Implement Close adapter
      throw new Error('Close adapter not yet implemented');
    case 'copper':
      // TODO: Implement Copper adapter
      throw new Error('Copper adapter not yet implemented');
    case 'freshsales':
      // TODO: Implement Freshsales adapter
      throw new Error('Freshsales adapter not yet implemented');
    default:
      throw new Error(`Unsupported CRM type: ${connection.crm_type}`);
  }

  // Authenticate adapter
  await adapter.authenticate({
    accessToken: connection.access_token,
    refreshToken: connection.refresh_token,
    expiresAt: connection.expires_at ? new Date(connection.expires_at) : undefined
  });

  // Load field mappings
  const { data: mappings } = await supabase
    .from('crm_field_mappings')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (mappings) {
    for (const mapping of mappings) {
      await adapter.setFieldMapping({
        samField: mapping.sam_field,
        crmField: mapping.crm_field,
        fieldType: mapping.field_type,
        dataType: mapping.data_type
      });
    }
  }

  // Cache the adapter
  adapterCache.set(workspaceId, adapter);

  return adapter;
}

/**
 * Start the MCP server
 */
async function main() {
  const server = new Server(
    {
      name: 'crm-integration-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Register all CRM tools
  registerCRMTools(server, getAdapter);

  // Setup transport and start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('MCP CRM Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in MCP server:', error);
  process.exit(1);
});
