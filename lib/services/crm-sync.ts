/**
 * CRM Sync Service
 * Syncs interested leads to connected CRM systems via MCP adapters
 * Supports: HubSpot, Salesforce, Pipedrive, Zoho, etc.
 */

import { createClient } from '@supabase/supabase-js';

interface InterestedLead {
  prospectId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  linkedInUrl?: string;
  replyText: string;
  intent: string;
  intentConfidence: number;
  campaignId?: string;
  campaignName?: string;
}

interface SyncResult {
  success: boolean;
  crmType?: string;
  contactId?: string;
  dealId?: string;
  error?: string;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

/**
 * Sync an interested lead to the workspace's connected CRM
 * Uses the CRM adapter pattern from MCP server
 */
export async function syncInterestedLeadToCRM(
  workspaceId: string,
  lead: InterestedLead
): Promise<SyncResult> {
  const supabase = getServiceClient();

  try {
    // Check for active CRM connection
    const { data: connection, error: connectionError } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single();

    if (connectionError || !connection) {
      console.log('📊 No active CRM connection for workspace - skipping sync');
      return { success: false, error: 'No active CRM connection' };
    }

    console.log(`🔄 Syncing lead to ${connection.crm_type}: ${lead.firstName} ${lead.lastName}`);

    // Get field mappings for the workspace
    const { data: mappings } = await supabase
      .from('crm_field_mappings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('crm_type', connection.crm_type);

    // Route to appropriate CRM handler
    let result: SyncResult;
    switch (connection.crm_type) {
      case 'hubspot':
        result = await syncToHubSpot(connection, lead, mappings || []);
        break;
      case 'salesforce':
        result = await syncToSalesforce(connection, lead, mappings || []);
        break;
      case 'pipedrive':
        result = await syncToPipedrive(connection, lead, mappings || []);
        break;
      case 'zoho':
        result = await syncToZoho(connection, lead, mappings || []);
        break;
      case 'airtable':
        result = await syncToAirtable(connection, lead, mappings || []);
        break;
      case 'activecampaign':
        result = await syncToActiveCampaign(connection, lead, mappings || []);
        break;
      case 'keap':
        result = await syncToKeap(connection, lead, mappings || []);
        break;
      case 'close':
        result = await syncToClose(connection, lead, mappings || []);
        break;
      case 'copper':
        result = await syncToCopper(connection, lead, mappings || []);
        break;
      case 'freshsales':
        result = await syncToFreshsales(connection, lead, mappings || []);
        break;
      case 'google_sheets':
        result = await syncToGoogleSheets(connection, lead, mappings || []);
        break;
      default:
        console.log(`⚠️ CRM type ${connection.crm_type} not yet implemented`);
        return { success: false, crmType: connection.crm_type, error: `CRM type ${connection.crm_type} not supported yet` };
    }

    // Log sync activity
    await supabase.from('crm_sync_logs').insert({
      workspace_id: workspaceId,
      connection_id: connection.id,
      sync_type: 'campaign',
      entity_type: 'contact',
      operation: 'create',
      status: result.success ? 'success' : 'failed',
      records_processed: 1,
      records_succeeded: result.success ? 1 : 0,
      records_failed: result.success ? 0 : 1,
      error_details: result.error ? { error: result.error } : null,
      completed_at: new Date().toISOString()
    });

    // Update last_synced_at on connection
    if (result.success) {
      await supabase
        .from('crm_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', connection.id);

      console.log(`✅ CRM sync complete - Contact: ${result.contactId}, Deal: ${result.dealId}`);
    }

    return result;

  } catch (error) {
    console.error('❌ CRM sync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Apply field mappings to transform SAM fields to CRM fields
 */
function applyFieldMappings(
  lead: InterestedLead,
  mappings: any[],
  fieldType: 'contact' | 'company' | 'deal'
): Record<string, any> {
  const mapped: Record<string, any> = {};
  const contactMappings = mappings.filter(m => m.field_type === fieldType);

  // Default SAM to standard field mappings
  const defaultMappings: Record<string, string> = {
    firstName: 'firstname',
    lastName: 'lastname',
    email: 'email',
    phone: 'phone',
    company: 'company',
    jobTitle: 'jobtitle',
    linkedInUrl: 'linkedin_profile_url'
  };

  // Apply custom mappings first
  for (const mapping of contactMappings) {
    const value = (lead as any)[mapping.sam_field];
    if (value !== undefined) {
      mapped[mapping.crm_field] = value;
    }
  }

  // Fill in with defaults if not mapped
  for (const [samField, crmField] of Object.entries(defaultMappings)) {
    if (!mapped[crmField]) {
      const value = (lead as any)[samField];
      if (value !== undefined) {
        mapped[crmField] = value;
      }
    }
  }

  return mapped;
}

// ============ HUBSPOT ============

async function syncToHubSpot(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  const accessToken = connection.access_token;

  // Check token expiry
  if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
    return { success: false, crmType: 'hubspot', error: 'Token expired - reconnect required' };
  }

  try {
    // Build contact properties using field mappings
    const contactProps = applyFieldMappings(lead, mappings, 'contact');

    // Add SAM-specific properties
    contactProps.hs_lead_status = 'OPEN';
    contactProps.lifecyclestage = 'lead';
    contactProps.sam_intent = lead.intent;
    contactProps.sam_intent_confidence = String(Math.round(lead.intentConfidence * 100));
    contactProps.sam_reply_text = lead.replyText.substring(0, 1000);
    contactProps.sam_source = 'linkedin_reply';
    if (lead.campaignName) contactProps.sam_campaign = lead.campaignName;

    // Create contact
    const contactResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties: contactProps })
    });

    let contactId: string;

    if (contactResponse.status === 409) {
      // Contact exists - find and update
      const searchResp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterGroups: [{
            filters: lead.email
              ? [{ propertyName: 'email', operator: 'EQ', value: lead.email }]
              : [{ propertyName: 'firstname', operator: 'EQ', value: lead.firstName }]
          }],
          limit: 1
        })
      });

      const searchData = await searchResp.json();
      if (searchData.results?.[0]?.id) {
        contactId = searchData.results[0].id;
        // Update existing contact
        await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties: contactProps })
        });
      } else {
        return { success: false, crmType: 'hubspot', error: 'Contact exists but could not find' };
      }
    } else if (!contactResponse.ok) {
      const errorText = await contactResponse.text();
      return { success: false, crmType: 'hubspot', error: `Contact creation failed: ${errorText}` };
    } else {
      const contactData = await contactResponse.json();
      contactId = contactData.id;
    }

    // Create deal
    const dealProps: Record<string, string> = {
      dealname: `${lead.firstName} ${lead.lastName} - LinkedIn Interest`,
      dealstage: 'qualifiedtobuy',
      pipeline: 'default',
      sam_source: 'linkedin_reply',
      sam_intent: lead.intent,
      description: lead.campaignName
        ? `SAM Campaign: ${lead.campaignName}\n\nReply: "${lead.replyText}"`
        : `LinkedIn reply: "${lead.replyText}"`
    };

    const dealResponse = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: dealProps,
        associations: [{
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }]
        }]
      })
    });

    const dealId = dealResponse.ok ? (await dealResponse.json()).id : undefined;

    return { success: true, crmType: 'hubspot', contactId, dealId };

  } catch (error) {
    return { success: false, crmType: 'hubspot', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ SALESFORCE ============

async function syncToSalesforce(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  const accessToken = connection.access_token;
  const instanceUrl = connection.crm_account_id; // Salesforce instance URL stored here

  try {
    // Build lead record using field mappings
    const leadProps = applyFieldMappings(lead, mappings, 'contact');

    // Salesforce Lead object
    const sfLead = {
      FirstName: leadProps.firstname || lead.firstName,
      LastName: leadProps.lastname || lead.lastName,
      Email: leadProps.email || lead.email,
      Phone: leadProps.phone || lead.phone,
      Company: leadProps.company || lead.company || 'Unknown',
      Title: leadProps.jobtitle || lead.jobTitle,
      LeadSource: 'LinkedIn - SAM AI',
      Status: 'Open - Not Contacted',
      Description: `Intent: ${lead.intent} (${Math.round(lead.intentConfidence * 100)}%)\n\nReply: "${lead.replyText}"`,
      SAM_Intent__c: lead.intent,
      SAM_Campaign__c: lead.campaignName,
      LinkedIn_Profile__c: lead.linkedInUrl
    };

    // Create Lead in Salesforce
    const response = await fetch(`${instanceUrl}/services/data/v58.0/sobjects/Lead`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sfLead)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, crmType: 'salesforce', error: `Lead creation failed: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, crmType: 'salesforce', contactId: data.id };

  } catch (error) {
    return { success: false, crmType: 'salesforce', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ PIPEDRIVE ============

async function syncToPipedrive(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  const apiToken = connection.access_token;
  const baseUrl = 'https://api.pipedrive.com/v1';

  try {
    // Create person (contact) in Pipedrive
    const personData = {
      name: `${lead.firstName} ${lead.lastName}`,
      email: lead.email ? [{ value: lead.email, primary: true }] : undefined,
      phone: lead.phone ? [{ value: lead.phone, primary: true }] : undefined,
      org_id: undefined, // Will be set if org is created
      job_title: lead.jobTitle,
      // Custom fields would need to be configured in Pipedrive
    };

    // Create organization if company provided
    let orgId: string | undefined;
    if (lead.company) {
      const orgResponse = await fetch(`${baseUrl}/organizations?api_token=${apiToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: lead.company })
      });
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        orgId = orgData.data?.id;
        personData.org_id = orgId;
      }
    }

    // Create person
    const personResponse = await fetch(`${baseUrl}/persons?api_token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(personData)
    });

    if (!personResponse.ok) {
      const errorText = await personResponse.text();
      return { success: false, crmType: 'pipedrive', error: `Person creation failed: ${errorText}` };
    }

    const personResult = await personResponse.json();
    const personId = personResult.data?.id;

    // Create deal
    const dealData = {
      title: `${lead.firstName} ${lead.lastName} - LinkedIn Interest`,
      person_id: personId,
      org_id: orgId,
      stage_id: 1, // First stage - customize as needed
      // Note in deal
    };

    const dealResponse = await fetch(`${baseUrl}/deals?api_token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dealData)
    });

    const dealId = dealResponse.ok ? (await dealResponse.json()).data?.id : undefined;

    // Add note with reply details
    if (personId) {
      await fetch(`${baseUrl}/notes?api_token=${apiToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `SAM AI - LinkedIn Reply\n\nIntent: ${lead.intent} (${Math.round(lead.intentConfidence * 100)}%)\n\nMessage: "${lead.replyText}"\n\nCampaign: ${lead.campaignName || 'N/A'}`,
          person_id: personId,
          deal_id: dealId
        })
      });
    }

    return { success: true, crmType: 'pipedrive', contactId: personId, dealId };

  } catch (error) {
    return { success: false, crmType: 'pipedrive', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ ZOHO ============

async function syncToZoho(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  const accessToken = connection.access_token;
  const baseUrl = 'https://www.zohoapis.com/crm/v3';

  try {
    // Create Lead in Zoho CRM
    const zohoLead = {
      First_Name: lead.firstName,
      Last_Name: lead.lastName,
      Email: lead.email,
      Phone: lead.phone,
      Company: lead.company || 'Unknown',
      Designation: lead.jobTitle,
      Lead_Source: 'LinkedIn - SAM AI',
      Lead_Status: 'Not Contacted',
      Description: `Intent: ${lead.intent} (${Math.round(lead.intentConfidence * 100)}%)\n\nReply: "${lead.replyText}"\n\nCampaign: ${lead.campaignName || 'N/A'}`,
      LinkedIn: lead.linkedInUrl
    };

    const response = await fetch(`${baseUrl}/Leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: [zohoLead] })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, crmType: 'zoho', error: `Lead creation failed: ${errorText}` };
    }

    const data = await response.json();
    const leadId = data.data?.[0]?.details?.id;

    return { success: true, crmType: 'zoho', contactId: leadId };

  } catch (error) {
    return { success: false, crmType: 'zoho', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ AIRTABLE ============

async function syncToAirtable(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  const apiKey = connection.access_token;
  const baseId = connection.crm_account_id; // Airtable base ID stored here
  const tableId = connection.crm_account_name || 'Leads'; // Table name or ID

  try {
    // Airtable record format
    const record = {
      fields: {
        'Name': `${lead.firstName} ${lead.lastName}`,
        'First Name': lead.firstName,
        'Last Name': lead.lastName,
        'Email': lead.email || '',
        'Phone': lead.phone || '',
        'Company': lead.company || '',
        'Title': lead.jobTitle || '',
        'LinkedIn URL': lead.linkedInUrl || '',
        'Source': 'LinkedIn - SAM AI',
        'Status': 'New Lead',
        'Intent': lead.intent,
        'Intent Confidence': Math.round(lead.intentConfidence * 100),
        'Reply Text': lead.replyText,
        'Campaign': lead.campaignName || '',
        'Created At': new Date().toISOString()
      }
    };

    // Apply custom field mappings if configured
    for (const mapping of mappings.filter(m => m.field_type === 'contact')) {
      const value = (lead as any)[mapping.sam_field];
      if (value !== undefined) {
        record.fields[mapping.crm_field] = value;
      }
    }

    // Create record in Airtable
    const response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(record)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        crmType: 'airtable',
        error: `Airtable error: ${errorData.error?.message || response.statusText}`
      };
    }

    const data = await response.json();
    return { success: true, crmType: 'airtable', contactId: data.id };

  } catch (error) {
    return { success: false, crmType: 'airtable', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ ACTIVECAMPAIGN ============

async function syncToActiveCampaign(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  const apiKey = connection.access_token;
  const baseUrl = connection.crm_account_id; // ActiveCampaign account URL

  try {
    // Create contact in ActiveCampaign
    const contactData = {
      contact: {
        email: lead.email || `${lead.firstName.toLowerCase()}.${lead.lastName.toLowerCase()}@placeholder.com`,
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone || '',
        fieldValues: [
          { field: 'COMPANY', value: lead.company || '' },
          { field: 'JOBTITLE', value: lead.jobTitle || '' },
          { field: 'SAM_INTENT', value: lead.intent },
          { field: 'SAM_CONFIDENCE', value: String(Math.round(lead.intentConfidence * 100)) },
          { field: 'LINKEDIN_URL', value: lead.linkedInUrl || '' }
        ]
      }
    };

    const response = await fetch(`${baseUrl}/api/3/contacts`, {
      method: 'POST',
      headers: {
        'Api-Token': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, crmType: 'activecampaign', error: `Contact creation failed: ${errorText}` };
    }

    const data = await response.json();
    const contactId = data.contact?.id;

    // Create deal if contact was created
    if (contactId) {
      await fetch(`${baseUrl}/api/3/deals`, {
        method: 'POST',
        headers: { 'Api-Token': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal: {
            title: `${lead.firstName} ${lead.lastName} - LinkedIn Interest`,
            contact: contactId,
            value: 0,
            currency: 'usd',
            description: `Intent: ${lead.intent}\nReply: "${lead.replyText}"`
          }
        })
      });
    }

    return { success: true, crmType: 'activecampaign', contactId };

  } catch (error) {
    return { success: false, crmType: 'activecampaign', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ KEAP (INFUSIONSOFT) ============

async function syncToKeap(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  const accessToken = connection.access_token;

  try {
    // Create contact in Keap
    const contactData = {
      given_name: lead.firstName,
      family_name: lead.lastName,
      email_addresses: lead.email ? [{ email: lead.email, field: 'EMAIL1' }] : [],
      phone_numbers: lead.phone ? [{ number: lead.phone, field: 'PHONE1' }] : [],
      company: lead.company ? { company_name: lead.company } : undefined,
      job_title: lead.jobTitle,
      source_type: 'OTHER',
      custom_fields: [
        { id: 1, content: lead.intent },
        { id: 2, content: lead.linkedInUrl || '' }
      ]
    };

    const response = await fetch('https://api.infusionsoft.com/crm/rest/v1/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, crmType: 'keap', error: `Contact creation failed: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, crmType: 'keap', contactId: data.id };

  } catch (error) {
    return { success: false, crmType: 'keap', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ CLOSE ============

async function syncToClose(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  const apiKey = connection.access_token;

  try {
    // Create lead in Close (Close uses "leads" not "contacts")
    const leadData = {
      name: `${lead.firstName} ${lead.lastName}`,
      contacts: [{
        name: `${lead.firstName} ${lead.lastName}`,
        title: lead.jobTitle,
        emails: lead.email ? [{ email: lead.email, type: 'work' }] : [],
        phones: lead.phone ? [{ phone: lead.phone, type: 'work' }] : [],
        urls: lead.linkedInUrl ? [{ url: lead.linkedInUrl, type: 'linkedin' }] : []
      }],
      description: `SAM AI Lead\nIntent: ${lead.intent} (${Math.round(lead.intentConfidence * 100)}%)\n\nReply: "${lead.replyText}"\n\nCampaign: ${lead.campaignName || 'N/A'}`,
      custom: {
        'SAM Intent': lead.intent,
        'SAM Campaign': lead.campaignName || ''
      }
    };

    if (lead.company) {
      leadData.name = lead.company;
    }

    const response = await fetch('https://api.close.com/api/v1/lead/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leadData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, crmType: 'close', error: `Lead creation failed: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, crmType: 'close', contactId: data.id };

  } catch (error) {
    return { success: false, crmType: 'close', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ COPPER ============

async function syncToCopper(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  const accessToken = connection.access_token;
  const userEmail = connection.crm_account_name; // User's email for Copper

  try {
    // Create person in Copper
    const personData = {
      name: `${lead.firstName} ${lead.lastName}`,
      emails: lead.email ? [{ email: lead.email, category: 'work' }] : [],
      phone_numbers: lead.phone ? [{ number: lead.phone, category: 'work' }] : [],
      socials: lead.linkedInUrl ? [{ url: lead.linkedInUrl, category: 'linkedin' }] : [],
      title: lead.jobTitle,
      details: `SAM AI Lead\nIntent: ${lead.intent} (${Math.round(lead.intentConfidence * 100)}%)\n\nReply: "${lead.replyText}"`
    };

    const response = await fetch('https://api.copper.com/developer_api/v1/people', {
      method: 'POST',
      headers: {
        'X-PW-AccessToken': accessToken,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': userEmail,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(personData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, crmType: 'copper', error: `Person creation failed: ${errorText}` };
    }

    const data = await response.json();
    const personId = data.id;

    // Create opportunity
    if (personId) {
      await fetch('https://api.copper.com/developer_api/v1/opportunities', {
        method: 'POST',
        headers: {
          'X-PW-AccessToken': accessToken,
          'X-PW-Application': 'developer_api',
          'X-PW-UserEmail': userEmail,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${lead.firstName} ${lead.lastName} - LinkedIn Interest`,
          primary_contact_id: personId,
          details: `Campaign: ${lead.campaignName || 'N/A'}\nIntent: ${lead.intent}`
        })
      });
    }

    return { success: true, crmType: 'copper', contactId: personId };

  } catch (error) {
    return { success: false, crmType: 'copper', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============ FRESHSALES ============

async function syncToFreshsales(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  const apiKey = connection.access_token;
  const domain = connection.crm_account_id; // Freshsales domain

  try {
    // Create contact in Freshsales
    const contactData = {
      contact: {
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        mobile_number: lead.phone,
        job_title: lead.jobTitle,
        linkedin: lead.linkedInUrl,
        lead_source_id: null, // Would need to map to actual lead source
        custom_field: {
          cf_sam_intent: lead.intent,
          cf_sam_confidence: Math.round(lead.intentConfidence * 100),
          cf_sam_campaign: lead.campaignName
        }
      }
    };

    const response = await fetch(`https://${domain}.freshsales.io/api/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contactData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, crmType: 'freshsales', error: `Contact creation failed: ${errorText}` };
    }

    const data = await response.json();
    const contactId = data.contact?.id;

    // Create deal
    if (contactId) {
      await fetch(`https://${domain}.freshsales.io/api/deals`, {
        method: 'POST',
        headers: {
          'Authorization': `Token token=${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deal: {
            name: `${lead.firstName} ${lead.lastName} - LinkedIn Interest`,
            contacts_id: [contactId],
            custom_field: {
              cf_sam_intent: lead.intent,
              cf_reply_text: lead.replyText.substring(0, 500)
            }
          }
        })
      });
    }

    return { success: true, crmType: 'freshsales', contactId };

  } catch (error) {
    return { success: false, crmType: 'freshsales', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Sync to Google Sheets
 * TODO: Implement Google OAuth and Sheets API integration
 * Requires: Google Cloud project, OAuth 2.0 credentials, Sheets API enabled
 */
async function syncToGoogleSheets(
  connection: any,
  lead: InterestedLead,
  mappings: any[]
): Promise<SyncResult> {
  // Placeholder - Google Sheets integration requires:
  // 1. Google OAuth setup in Google Cloud Console
  // 2. OAuth flow to get access_token + refresh_token
  // 3. User selects which spreadsheet to sync to
  // 4. Column mapping (which column = first_name, email, etc.)

  console.log('📗 Google Sheets sync placeholder - not yet implemented');
  console.log('   Lead:', lead.firstName, lead.lastName, lead.company);
  console.log('   Spreadsheet ID:', connection.crm_account_id);

  // TODO: Implement actual Google Sheets sync
  // const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  // await sheets.spreadsheets.values.append({
  //   spreadsheetId: connection.crm_account_id,
  //   range: 'Sheet1!A:Z',
  //   valueInputOption: 'USER_ENTERED',
  //   requestBody: {
  //     values: [[
  //       lead.firstName,
  //       lead.lastName,
  //       lead.email,
  //       lead.company,
  //       lead.jobTitle,
  //       lead.linkedInUrl,
  //       lead.intent,
  //       new Date().toISOString()
  //     ]]
  //   }
  // });

  return {
    success: false,
    crmType: 'google_sheets',
    error: 'Google Sheets integration not yet configured. Please set up Google OAuth.'
  };
}
