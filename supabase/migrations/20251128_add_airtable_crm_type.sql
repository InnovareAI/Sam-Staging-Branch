-- Add Airtable to valid CRM types
-- Migration: 20251128_add_airtable_crm_type.sql

-- Drop existing check constraints and recreate with airtable included
ALTER TABLE crm_connections DROP CONSTRAINT IF EXISTS crm_connections_crm_type_check;
ALTER TABLE crm_connections ADD CONSTRAINT crm_connections_crm_type_check
  CHECK (crm_type IN (
    'hubspot',
    'salesforce',
    'pipedrive',
    'zoho',
    'activecampaign',
    'keap',
    'close',
    'copper',
    'freshsales',
    'airtable'
  ));

ALTER TABLE crm_field_mappings DROP CONSTRAINT IF EXISTS crm_field_mappings_crm_type_check;
ALTER TABLE crm_field_mappings ADD CONSTRAINT crm_field_mappings_crm_type_check
  CHECK (crm_type IN (
    'hubspot',
    'salesforce',
    'pipedrive',
    'zoho',
    'activecampaign',
    'keap',
    'close',
    'copper',
    'freshsales',
    'airtable'
  ));

-- Comment
COMMENT ON CONSTRAINT crm_connections_crm_type_check ON crm_connections IS 'Valid CRM types including Airtable';
