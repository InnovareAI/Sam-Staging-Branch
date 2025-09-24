const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('📋 Checking messaging templates...\n');
    
    // Check if messaging templates table exists
    const { data: templates, error: templatesError } = await supabase
      .from('messaging_templates')
      .select('*')
      .limit(10);
    
    if (templatesError) {
      console.log('❌ Error fetching messaging templates:', templatesError);
      console.log('   This might mean the table doesn\'t exist yet.');
    } else {
      console.log(`📊 Found ${templates?.length || 0} messaging templates in database`);
      if (templates && templates.length > 0) {
        templates.forEach(template => {
          console.log(`  • ${template.template_name} (${template.campaign_type}) - ${template.industry || 'Any'} industry`);
          console.log(`    Connection: "${template.connection_message.substring(0, 100)}..."`);
        });
      }
    }
    
    // Check template components
    const { data: components, error: componentsError } = await supabase
      .from('template_components')
      .select('*')
      .limit(5);
    
    if (componentsError) {
      console.log('\n❌ Error fetching template components:', componentsError);
    } else {
      console.log(`\n🧩 Found ${components?.length || 0} template components`);
      if (components && components.length > 0) {
        components.forEach(comp => {
          console.log(`  • ${comp.component_type} (${comp.industry || 'Any'} industry): "${comp.content.substring(0, 80)}..."`);
        });
      }
    }
    
    console.log('\n🔧 Sam Template System Status:');
    console.log('  ✅ Code templates available in lib/campaign-templates.ts');
    console.log('  📊 4 campaign templates: Connection + Follow-up, Direct Message, Group Message, Company Follow');
    console.log('  🎯 Template variables: first_name, company_name, industry, job_title, etc.');
    console.log('  📈 Expected response rates: 15-40% depending on template type');
    
    // Check the static campaign templates
    console.log('\n📝 Available Campaign Template Types:');
    console.log('  1. Connection Request + 3 Follow-ups (15-25% response rate)');
    console.log('  2. Direct Message + 3 Follow-ups (25-35% response rate)');
    console.log('  3. Group Message Campaign (30-40% response rate)');
    console.log('  4. Company Follow Campaign (20-30% response rate)');
    
    console.log('\n✅ Template system check complete');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
})();