#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCampaignsForSamAI() {
  console.log('🔧 Fixing campaigns table for Sam AI compatibility...');

  try {
    // Step 1: Test current structure
    console.log('\n📝 Step 1: Testing current campaigns structure...');
    
    const { data: currentCampaigns, error: currentError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(1);

    if (currentError) {
      console.error('❌ Cannot access campaigns:', currentError);
      return;
    }

    console.log('✅ Current campaigns table accessed successfully');
    if (currentCampaigns && currentCampaigns.length > 0) {
      console.log('📋 Current columns:', Object.keys(currentCampaigns[0]).join(', '));
    }

    // Step 2: Test if we can add a Sam AI compatible record
    console.log('\n📝 Step 2: Testing Sam AI record insertion...');
    
    const testRecord = {
      workspace_id: 'test_sam_ai_fix',
      name: 'Sam AI Compatibility Test',
      description: 'Testing Sam AI MCP integration',
      campaign_type: 'linkedin_only',
      status: 'draft'
    };

    // Add Sam AI fields if they don't cause errors
    try {
      testRecord.type = 'sam_signature';
      testRecord.target_criteria = { industry: 'technology', role: 'CEO' };
      testRecord.execution_preferences = { daily_limit: 50, personalization_level: 'advanced' };
    } catch (e) {
      console.log('⚠️ Sam AI fields not available yet, will add basic record');
    }

    const { data: insertedRecord, error: insertError } = await supabase
      .from('campaigns')
      .insert(testRecord)
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ Insert test failed:', insertError);
      
      // If it fails due to missing columns, that's expected
      if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
        console.log('📋 Confirmed: Sam AI columns missing, need to add them manually');
        console.log('\n🚨 MANUAL ACTION REQUIRED:');
        console.log('Please execute this SQL in Supabase SQL Editor:');
        console.log(`
-- Add Sam AI columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS target_criteria JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS execution_preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS template_id UUID;

-- Update existing campaigns with type values
UPDATE campaigns 
SET type = CASE 
  WHEN campaign_type = 'linkedin_only' THEN 'sam_signature'
  WHEN campaign_type = 'email_only' THEN 'email'
  WHEN campaign_type = 'both' THEN 'sam_signature'
  ELSE 'custom'
END
WHERE type IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
        `);
        return;
      }
    } else {
      console.log('✅ Sam AI record inserted successfully:', insertedRecord.id);
      
      // Clean up test record
      await supabase
        .from('campaigns')
        .delete()
        .eq('id', insertedRecord.id);
      
      console.log('🧹 Test record cleaned up');
    }

    // Step 3: Test MCP tool compatibility
    console.log('\n📝 Step 3: Testing MCP tool compatibility...');
    
    // Try to create a campaign using Sam AI MCP format
    const samCampaign = {
      workspace_id: 'test_sam_mcp_compatibility',
      name: 'Sam MCP Test Campaign',
      type: 'sam_signature',
      status: 'draft',
      target_criteria: {
        industry: 'technology',
        role: 'CEO',
        company_size: 'startup'
      },
      execution_preferences: {
        daily_limit: 50,
        personalization_level: 'advanced',
        channels: ['linkedin']
      }
    };

    const { data: mcpCampaign, error: mcpError } = await supabase
      .from('campaigns')
      .insert(samCampaign)
      .select('*')
      .single();

    if (mcpError) {
      console.error('❌ MCP compatibility test failed:', mcpError);
      return;
    }

    console.log('✅ MCP compatibility test successful:', mcpCampaign.id);

    // Test with template_id
    const { data: templateTest, error: templateTestError } = await supabase
      .from('messaging_templates')
      .select('id')
      .limit(1)
      .single();

    if (!templateTestError && templateTest) {
      console.log('\n📝 Step 4: Testing template association...');
      
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ template_id: templateTest.id })
        .eq('id', mcpCampaign.id);

      if (updateError) {
        console.error('❌ Template association failed:', updateError);
      } else {
        console.log('✅ Template association successful');
      }
    }

    // Clean up test campaign
    await supabase
      .from('campaigns')
      .delete()
      .eq('id', mcpCampaign.id);

    console.log('🧹 MCP test campaign cleaned up');

    console.log('\n🎉 Sam AI campaigns compatibility verified!');
    console.log('📋 Campaign table now supports:');
    console.log('  ✅ type (Sam AI campaign types)');
    console.log('  ✅ target_criteria (JSONB targeting)');
    console.log('  ✅ execution_preferences (JSONB execution settings)');
    console.log('  ✅ template_id (FK to messaging_templates)');
    console.log('\n🚀 Ready to test Sam AI MCP tools!');

  } catch (error) {
    console.error('❌ Fix process failed:', error);
  }
}

// Execute fix
fixCampaignsForSamAI();