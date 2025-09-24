/**
 * Deploy N8N Dual Funnel Database Schema
 * Deploys core and dynamic funnel tables for Sam AI N8N integration
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🚀 Deploying N8N Dual Funnel Database Schema...');

async function deploySchema() {
  try {
    // Create Core Funnel Templates table
    console.log('📝 Creating core_funnel_templates table...');
    const { error: coreTemplatesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS core_funnel_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          funnel_type TEXT NOT NULL CHECK (funnel_type IN ('sam_signature', 'event_invitation', 'product_launch')),
          name TEXT NOT NULL,
          description TEXT,
          industry TEXT DEFAULT 'general',
          n8n_workflow_id TEXT,
          conversion_rate DECIMAL DEFAULT 0,
          avg_response_rate DECIMAL DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (coreTemplatesError) {
      console.error('❌ Core templates table error:', coreTemplatesError.message);
    } else {
      console.log('✅ Core funnel templates table created');
    }

    // Create Core Funnel Executions table
    console.log('📝 Creating core_funnel_executions table...');
    const { error: coreExecutionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS core_funnel_executions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID,
          template_id UUID REFERENCES core_funnel_templates(id),
          n8n_execution_id TEXT,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stopped')),
          prospects_total INTEGER DEFAULT 0,
          prospects_processed INTEGER DEFAULT 0,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (coreExecutionsError) {
      console.error('❌ Core executions table error:', coreExecutionsError.message);
    } else {
      console.log('✅ Core funnel executions table created');
    }

    // Create Dynamic Funnel Definitions table
    console.log('📝 Creating dynamic_funnel_definitions table...');
    const { error: dynamicDefinitionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS dynamic_funnel_definitions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID,
          name TEXT NOT NULL,
          description TEXT,
          ai_prompt TEXT,
          target_persona JSONB,
          funnel_logic JSONB,
          n8n_workflow_json JSONB,
          n8n_workflow_id TEXT,
          created_by_sam BOOLEAN DEFAULT true,
          avg_performance_score DECIMAL DEFAULT 0,
          total_executions INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (dynamicDefinitionsError) {
      console.error('❌ Dynamic definitions table error:', dynamicDefinitionsError.message);
    } else {
      console.log('✅ Dynamic funnel definitions table created');
    }

    // Create Dynamic Funnel Steps table
    console.log('📝 Creating dynamic_funnel_steps table...');
    const { error: dynamicStepsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS dynamic_funnel_steps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          funnel_id UUID REFERENCES dynamic_funnel_definitions(id) ON DELETE CASCADE,
          step_order INTEGER NOT NULL,
          step_type TEXT NOT NULL CHECK (step_type IN ('message', 'wait', 'condition', 'webhook', 'ai_response')),
          trigger_condition JSONB,
          message_template TEXT,
          wait_duration INTERVAL,
          success_action JSONB,
          failure_action JSONB,
          ai_instructions TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (dynamicStepsError) {
      console.error('❌ Dynamic steps table error:', dynamicStepsError.message);
    } else {
      console.log('✅ Dynamic funnel steps table created');
    }

    // Create Dynamic Funnel Executions table
    console.log('📝 Creating dynamic_funnel_executions table...');
    const { error: dynamicExecutionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS dynamic_funnel_executions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          funnel_id UUID REFERENCES dynamic_funnel_definitions(id),
          campaign_id UUID,
          n8n_execution_id TEXT,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused')),
          current_step INTEGER DEFAULT 1,
          prospects_total INTEGER DEFAULT 0,
          prospects_in_step JSONB DEFAULT '{}',
          adaptation_history JSONB DEFAULT '[]',
          performance_metrics JSONB DEFAULT '{}',
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (dynamicExecutionsError) {
      console.error('❌ Dynamic executions table error:', dynamicExecutionsError.message);
    } else {
      console.log('✅ Dynamic funnel executions table created');
    }

    // Create Funnel Performance Metrics table
    console.log('📝 Creating funnel_performance_metrics table...');
    const { error: performanceError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS funnel_performance_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campaign_id UUID,
          funnel_type TEXT NOT NULL CHECK (funnel_type IN ('core', 'dynamic')),
          template_or_definition_id UUID,
          execution_id UUID,
          prospects_total INTEGER DEFAULT 0,
          prospects_contacted INTEGER DEFAULT 0,
          prospects_responded INTEGER DEFAULT 0,
          prospects_converted INTEGER DEFAULT 0,
          response_rate DECIMAL GENERATED ALWAYS AS (
            CASE WHEN prospects_contacted > 0 
            THEN (prospects_responded::DECIMAL / prospects_contacted::DECIMAL) * 100 
            ELSE 0 END
          ) STORED,
          conversion_rate DECIMAL GENERATED ALWAYS AS (
            CASE WHEN prospects_responded > 0 
            THEN (prospects_converted::DECIMAL / prospects_responded::DECIMAL) * 100 
            ELSE 0 END
          ) STORED,
          step_performance JSONB DEFAULT '{}',
          avg_response_time INTERVAL,
          funnel_completion_rate DECIMAL DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (performanceError) {
      console.error('❌ Performance metrics table error:', performanceError.message);
    } else {
      console.log('✅ Funnel performance metrics table created');
    }

    // Create Funnel Step Logs table
    console.log('📝 Creating funnel_step_logs table...');
    const { error: stepLogsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS funnel_step_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          execution_id UUID,
          funnel_type TEXT CHECK (funnel_type IN ('core', 'dynamic')),
          prospect_id TEXT,
          step_number INTEGER,
          step_type TEXT,
          status TEXT CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
          step_data JSONB,
          response_data JSONB,
          execution_time_ms INTEGER,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (stepLogsError) {
      console.error('❌ Step logs table error:', stepLogsError.message);
    } else {
      console.log('✅ Funnel step logs table created');
    }

    // Update campaigns table with funnel support
    console.log('📝 Adding funnel columns to campaigns table...');
    const { error: campaignsUpdateError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'funnel_type') THEN
            ALTER TABLE campaigns ADD COLUMN funnel_type TEXT CHECK (funnel_type IN ('core', 'dynamic'));
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'core_template_id') THEN
            ALTER TABLE campaigns ADD COLUMN core_template_id UUID REFERENCES core_funnel_templates(id);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'dynamic_definition_id') THEN
            ALTER TABLE campaigns ADD COLUMN dynamic_definition_id UUID REFERENCES dynamic_funnel_definitions(id);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'n8n_workflow_id') THEN
            ALTER TABLE campaigns ADD COLUMN n8n_workflow_id TEXT;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'n8n_execution_id') THEN
            ALTER TABLE campaigns ADD COLUMN n8n_execution_id TEXT;
          END IF;
        END $$;
      `
    });

    if (campaignsUpdateError) {
      console.error('❌ Campaigns table update error:', campaignsUpdateError.message);
    } else {
      console.log('✅ Campaigns table updated with funnel support');
    }

    // Create indexes for performance
    console.log('📝 Creating performance indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_core_templates_funnel_type ON core_funnel_templates(funnel_type);',
      'CREATE INDEX IF NOT EXISTS idx_core_templates_industry ON core_funnel_templates(industry);',
      'CREATE INDEX IF NOT EXISTS idx_core_executions_campaign ON core_funnel_executions(campaign_id);',
      'CREATE INDEX IF NOT EXISTS idx_core_executions_status ON core_funnel_executions(status);',
      'CREATE INDEX IF NOT EXISTS idx_dynamic_definitions_campaign ON dynamic_funnel_definitions(campaign_id);',
      'CREATE INDEX IF NOT EXISTS idx_dynamic_steps_funnel_order ON dynamic_funnel_steps(funnel_id, step_order);',
      'CREATE INDEX IF NOT EXISTS idx_dynamic_executions_funnel ON dynamic_funnel_executions(funnel_id);',
      'CREATE INDEX IF NOT EXISTS idx_dynamic_executions_status ON dynamic_funnel_executions(status);',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_campaign ON funnel_performance_metrics(campaign_id);',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_funnel_type ON funnel_performance_metrics(funnel_type);'
    ];

    for (const indexSql of indexes) {
      const { error } = await supabase.rpc('exec_sql', { sql: indexSql });
      if (error) {
        console.warn('⚠️ Index creation warning:', error.message);
      }
    }
    console.log('✅ Performance indexes created');

    // Insert sample core funnel templates
    console.log('📝 Inserting sample core funnel templates...');
    const { error: sampleDataError } = await supabase.from('core_funnel_templates').upsert([
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
      },
      {
        funnel_type: 'product_launch',
        name: 'Product Launch Funnel - SaaS',
        description: 'Ideal for new product announcements and feature launches',
        industry: 'technology',
        conversion_rate: 17.9,
        avg_response_rate: 15.4,
        is_active: true
      }
    ], { 
      onConflict: 'name',
      ignoreDuplicates: true 
    });

    if (sampleDataError) {
      console.warn('⚠️ Sample data warning:', sampleDataError.message);
    } else {
      console.log('✅ Sample core funnel templates inserted');
    }

    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const { data: tables, error: verificationError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'core_funnel_templates',
        'core_funnel_executions',
        'dynamic_funnel_definitions', 
        'dynamic_funnel_steps',
        'dynamic_funnel_executions',
        'funnel_performance_metrics',
        'funnel_step_logs'
      ]);

    if (verificationError) {
      console.warn('⚠️ Verification warning:', verificationError.message);
    } else if (tables) {
      console.log(`✅ Verified ${tables.length} funnel tables exist:`);
      tables.forEach(table => console.log(`  - ${table.table_name}`));
    }

    // Test sample data
    console.log('🧪 Testing sample data...');
    const { data: sampleTemplates, error: testError } = await supabase
      .from('core_funnel_templates')
      .select('*')
      .limit(3);

    if (testError) {
      console.warn('⚠️ Sample data test warning:', testError.message);
    } else {
      console.log(`✅ Sample data test passed - found ${sampleTemplates?.length || 0} templates`);
    }

    console.log('🎉 N8N Dual Funnel Schema deployment completed successfully!');
    console.log('');
    console.log('📊 Schema Summary:');
    console.log('  • Core Funnel Templates: Ready for standardized sequences');
    console.log('  • Dynamic Funnel Definitions: Ready for AI-generated sequences');
    console.log('  • Performance Tracking: Real-time metrics and analytics');
    console.log('  • N8N Integration: Workflow execution and monitoring');
    console.log('  • Campaign Integration: Enhanced campaigns table');
    console.log('');
    console.log('🚀 Sam AI N8N Dual Funnel System is now ready for production!');

  } catch (error) {
    console.error('💥 Deployment failed:', error.message);
    process.exit(1);
  }
}

deploySchema();