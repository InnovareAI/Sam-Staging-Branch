#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = process.argv[2] || 'dea5a7f2-673c-4429-972d-6ba5fca473fb';

// Categorization rules - order matters (most specific first)
const categorizationRules = [
  { keywords: ['pricing model', 'price', 'pricing', 'cost structure'], section: 'pricing', priority: 10 },
  { keywords: ['messaging template', 'messaging framework', 'messaging and', 'value prop'], section: 'messaging', priority: 10 },
  { keywords: ['objection handling', 'objection framework', 'faq'], section: 'objections', priority: 10 },
  { keywords: ['competitor', 'competition', 'competitive', 'battlecard', 'swot', 'win-loss'], section: 'competition', priority: 10 },
  { keywords: ['compliance', 'regulatory', 'legal', 'gdpr', 'hipaa'], section: 'compliance', priority: 10 },
  { keywords: ['buying process', 'decision making', 'sprint model', 'strategic partnership'], section: 'buying-process', priority: 9 },
  { keywords: ['ideal client', 'icp', 'target market', 'market intelligence'], section: 'icp', priority: 9 },
  { keywords: ['case study', 'testimonial', 'customer story', 'success story'], section: 'success', priority: 8 },
  { keywords: ['buyer persona', 'stakeholder', 'decision maker'], section: 'personas', priority: 8 },
  { keywords: ['brand guideline', 'tone of voice', 'brand voice', 'voice and tone'], section: 'tone', priority: 7 },
  { keywords: ['company overview', 'about us', 'our company'], section: 'company-info', priority: 6 },
  { keywords: ['product', 'service offering', 'solution overview'], section: 'products', priority: 5 }
];

// Good existing sections that should be preserved
const validSections = new Set([
  'company-info', 'buying-process', 'competition', 'compliance', 'messaging',
  'objections', 'personas', 'pricing', 'products', 'icp', 'success', 'tone'
]);

function categorizeDocument(filename, content, currentSection) {
  // Keep it if it's already in a valid section
  if (validSections.has(currentSection)) {
    return currentSection;
  }
  
  const text = `${filename} ${content || ''}`.toLowerCase();
  let bestMatch = null;
  let bestPriority = -1;
  
  for (const rule of categorizationRules) {
    if (rule.keywords.some(kw => text.includes(kw)) && rule.priority > bestPriority) {
      bestMatch = rule.section;
      bestPriority = rule.priority;
    }
  }
  
  return bestMatch || currentSection; // Keep existing if no match
}

async function main() {
  console.log(`\n🔧 Fixing document sections for workspace: ${workspaceId}\n`);

  const { data: docs, error } = await supabase
    .from('knowledge_base_documents')
    .select('id, filename, section_id, extracted_content')
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error fetching documents:', error);
    process.exit(1);
  }

  console.log(`Found ${docs.length} documents\n`);

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const newSection = categorizeDocument(doc.filename, doc.extracted_content?.substring(0, 500), doc.section_id);
    
    if (newSection && newSection !== doc.section_id) {
      console.log(`📝 ${doc.filename}`);
      console.log(`   ${doc.section_id || 'null'} → ${newSection}`);
      
      const { error: updateError } = await supabase
        .from('knowledge_base_documents')
        .update({ section_id: newSection })
        .eq('id', doc.id);

      if (updateError) {
        console.log(`   ❌ Error: ${updateError.message}`);
      } else {
        console.log(`   ✓ Updated`);
        updated++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Complete: ${updated} updated, ${skipped} skipped\n`);
}

main().catch(console.error);
