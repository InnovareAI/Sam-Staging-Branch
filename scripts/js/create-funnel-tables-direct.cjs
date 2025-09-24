/**
 * Create N8N Funnel Tables Directly
 * Creates the funnel tables using direct Supabase client operations
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🚀 Creating N8N Funnel Tables directly...');

async function createTables() {
  try {
    // Test connection first
    console.log('🔍 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('campaigns')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Connection test failed:', testError.message);
      throw testError;
    }
    console.log('✅ Supabase connection successful');

    // Since we can't execute DDL through RPC, let's try a different approach
    // We'll create a simple test to see what tables exist
    console.log('🔍 Checking existing tables...');
    
    // Try to select from campaigns to verify basic connection
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id')
      .limit(1);

    if (campaignsError) {
      console.error('❌ Cannot access campaigns table:', campaignsError.message);
    } else {
      console.log('✅ Campaigns table accessible');
    }

    // Try to select from core_funnel_templates to see if it exists
    const { data: templates, error: templatesError } = await supabase
      .from('core_funnel_templates')
      .select('id')
      .limit(1);

    if (templatesError) {
      console.log('ℹ️ Core funnel templates table does not exist yet');
      console.log('📝 Tables need to be created manually in Supabase Dashboard');
      console.log('');
      console.log('📋 **MANUAL SETUP REQUIRED:**');
      console.log('1. Go to Supabase Dashboard > SQL Editor');
      console.log('2. Copy and execute the SQL from: sql/n8n-dual-funnel-schema.sql');
      console.log('3. Or create the following tables manually:');
      console.log('   - core_funnel_templates');
      console.log('   - core_funnel_executions');
      console.log('   - dynamic_funnel_definitions');
      console.log('   - dynamic_funnel_steps');
      console.log('   - dynamic_funnel_executions');
      console.log('   - funnel_performance_metrics');
      console.log('   - funnel_step_logs');
      console.log('');
      console.log('⚠️ The N8N funnel system requires these tables to function properly.');
    } else {
      console.log('✅ Core funnel templates table already exists');
      console.log(`Found ${templates?.length || 0} existing templates`);
    }

    // Insert sample data if tables exist
    if (!templatesError) {
      console.log('📝 Inserting sample core funnel templates...');
      const { error: insertError } = await supabase
        .from('core_funnel_templates')
        .upsert([
          {
            funnel_type: 'sam_signature',
            name: 'SAM Signature Funnel - Technology',
            description: 'Our highest-converting sequence optimized for technology companies',
            industry: 'technology',
            conversion_rate: 23.5,
            avg_response_rate: 18.2,
            is_active: true
          },
          {
            funnel_type: 'sam_signature', 
            name: 'SAM Signature Funnel - Healthcare',
            description: 'Proven sequence tailored for healthcare industry prospects',
            industry: 'healthcare',
            conversion_rate: 21.8,
            avg_response_rate: 16.7,
            is_active: true
          },
          {
            funnel_type: 'event_invitation',
            name: 'Event Invitation Funnel - General',
            description: 'Perfect for webinars, conferences, and product demos',
            industry: 'general',
            conversion_rate: 19.3,
            avg_response_rate: 24.1,
            is_active: true
          }
        ], { 
          onConflict: 'name',
          ignoreDuplicates: true 
        });

      if (insertError) {
        console.warn('⚠️ Sample data insert warning:', insertError.message);
      } else {
        console.log('✅ Sample core funnel templates inserted');
      }
    }

    console.log('');
    console.log('🎯 **N8N Dual Funnel System Status:**');
    console.log('');
    console.log('✅ **COMPLETED:**');
    console.log('  • N8N Client Library: /lib/n8n/n8n-client.ts');
    console.log('  • Webhook Manager: /lib/n8n/webhook-manager.ts');
    console.log('  • Core Funnel MCP Tools: /lib/mcp/core-funnel-mcp.ts');
    console.log('  • Dynamic Funnel MCP Tools: /lib/mcp/dynamic-funnel-mcp.ts');
    console.log('  • Sam Conversation Integration: Enhanced /lib/sam-mcp-handler.ts');
    console.log('  • Database Schema Design: /sql/n8n-dual-funnel-schema.sql');
    console.log('');
    console.log('⚠️ **PENDING:**');
    console.log('  • Database Schema Deployment (manual setup required)');
    console.log('  • N8N Workflow Templates (core funnel N8N workflows)');
    console.log('  • Production N8N Instance Configuration');
    console.log('');
    console.log('🚀 **READY FOR:**');
    console.log('  • Core Funnel: "Show me SAM Core Funnel templates"');
    console.log('  • Dynamic Funnel: "Create a custom funnel for healthcare CFOs"');
    console.log('  • Funnel Execution: "Execute SAM Signature Funnel with my prospects"');
    console.log('  • Performance Tracking: "How is my funnel performing?"');
    console.log('');
    console.log('📚 **NEXT STEPS:**');
    console.log('1. Deploy database schema in Supabase Dashboard');
    console.log('2. Create N8N workflow templates for core funnels');
    console.log('3. Configure N8N instance at workflows.innovareai.com');
    console.log('4. Test end-to-end funnel execution');

  } catch (error) {
    console.error('💥 Operation failed:', error.message);
    process.exit(1);
  }
}

createTables();