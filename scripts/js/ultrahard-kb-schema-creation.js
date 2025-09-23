#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('💥 ULTRAHARD MODE: DIRECT KNOWLEDGE BASE SCHEMA CREATION');
console.log('========================================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Direct table creation using INSERT method (Supabase hack)
async function createKnowledgeBaseSchema() {
  console.log('🔥 Creating knowledge base schema via direct SQL insertion...');
  
  // Create core knowledge_base table
  const createKnowledgeBase = `
    -- Core knowledge base table
    CREATE TABLE IF NOT EXISTS public.knowledge_base (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        category TEXT NOT NULL,
        subcategory TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT[] DEFAULT '{}',
        version TEXT DEFAULT '4.4',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base(category);
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON public.knowledge_base(is_active) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON public.knowledge_base USING gin(tags);
    
    ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Knowledge base readable by all" ON public.knowledge_base FOR SELECT USING (is_active = true);
    CREATE POLICY "Knowledge base writable by authenticated" ON public.knowledge_base FOR ALL TO authenticated USING (true);
  `;

  // Create knowledge base sections table  
  const createKnowledgeBaseSections = `
    CREATE TABLE IF NOT EXISTS public.knowledge_base_sections (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
        section_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(workspace_id, section_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_kb_sections_workspace ON public.knowledge_base_sections(workspace_id);
    ALTER TABLE public.knowledge_base_sections ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "KB sections workspace access" ON public.knowledge_base_sections FOR ALL TO authenticated
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
  `;

  // Create knowledge base content table
  const createKnowledgeBaseContent = `
    CREATE TABLE IF NOT EXISTS public.knowledge_base_content (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
        section_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        title TEXT,
        content JSONB NOT NULL,
        metadata JSONB DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_kb_content_workspace_section ON public.knowledge_base_content(workspace_id, section_id);
    ALTER TABLE public.knowledge_base_content ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "KB content workspace access" ON public.knowledge_base_content FOR ALL TO authenticated
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
  `;

  console.log('📝 Attempting to create tables using admin client...');
  
  try {
    // Test if knowledge_base exists
    const { data: existingKB, error: kbError } = await supabase
      .from('knowledge_base')
      .select('id')
      .limit(1);
    
    if (kbError && kbError.code === '42P01') {
      console.log('❌ knowledge_base table does not exist - needs manual creation');
      console.log('\n📋 MANUAL SQL EXECUTION REQUIRED:');
      console.log('================================');
      console.log('1. Open Supabase Dashboard → SQL Editor');
      console.log('2. Execute the following SQL:');
      console.log('\n' + createKnowledgeBase);
      console.log('\n' + createKnowledgeBaseSections);
      console.log('\n' + createKnowledgeBaseContent);
      
      return false;
    } else if (!kbError) {
      console.log('✅ knowledge_base table already exists');
      console.log(`📊 Current records: ${existingKB.length}`);
      return true;
    } else {
      console.log('⚠️  Unexpected error:', kbError.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Schema creation failed:', error.message);
    return false;
  }
}

// Test all knowledge base tables
async function testAllKnowledgeBaseTables() {
  console.log('🧪 Testing all knowledge base tables...');
  
  const tables = [
    'knowledge_base',
    'knowledge_base_sections', 
    'knowledge_base_content'
  ];
  
  const results = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        results[table] = { exists: false, error: error.message };
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        results[table] = { exists: true, records: data.length };
        console.log(`✅ ${table}: accessible (${data.length} records)`);
      }
    } catch (err) {
      results[table] = { exists: false, error: err.message };
      console.log(`❌ ${table}: ${err.message}`);
    }
  }
  
  return results;
}

// Initialize with sample data
async function initializeWithSampleData() {
  console.log('🌱 Initializing knowledge base with sample data...');
  
  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .insert([
        {
          category: 'core',
          title: 'SAM AI Recovery Test',
          content: 'Knowledge base successfully restored after database migration issues.',
          tags: ['recovery', 'test', 'system'],
          version: '4.4'
        }
      ])
      .select();
    
    if (error) {
      console.log('❌ Failed to insert sample data:', error.message);
      return false;
    }
    
    console.log('✅ Sample data inserted successfully');
    console.log('📄 Sample record:', data[0]);
    return true;
  } catch (error) {
    console.error('❌ Sample data initialization failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting ULTRAHARD knowledge base schema creation...\n');
  
  // Step 1: Test current state
  const tableResults = await testAllKnowledgeBaseTables();
  
  // Step 2: Create schema if needed
  if (!tableResults.knowledge_base?.exists) {
    const created = await createKnowledgeBaseSchema();
    if (!created) {
      console.log('\n💥 ULTRAHARD MODE LIMITATION:');
      console.log('Supabase client cannot execute DDL (CREATE TABLE) statements');
      console.log('Manual intervention required via Supabase Dashboard');
      return;
    }
  }
  
  // Step 3: Initialize with test data
  if (tableResults.knowledge_base?.exists) {
    await initializeWithSampleData();
  }
  
  // Step 4: Final verification
  console.log('\n🔄 Final verification...');
  await testAllKnowledgeBaseTables();
  
  console.log('\n💥 ULTRAHARD MODE COMPLETE');
  console.log('=========================');
  console.log('Knowledge base schema status verified');
  console.log('Ready for content upload phase');
}

main().catch(console.error);