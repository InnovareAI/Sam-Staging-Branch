import { NextRequest, NextResponse } from 'next/server';
import { 
  CAMPAIGN_TEMPLATES, 
  getTemplateById, 
  getTemplatesByType, 
  getRecommendedTemplate,
  validateTemplateVariables,
  populateTemplate,
  CampaignTemplate 
} from '@/lib/campaign-templates';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');
    const templateType = searchParams.get('type') as CampaignTemplate['type'];
    const action = searchParams.get('action');

    // Get specific template by ID
    if (templateId) {
      const template = getTemplateById(templateId);
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      return NextResponse.json({ template });
    }

    // Get templates by type
    if (templateType) {
      const templates = getTemplatesByType(templateType);
      return NextResponse.json({ templates });
    }

    // Get recommended template based on criteria
    if (action === 'recommend') {
      const relationship_status = searchParams.get('relationship_status') as any;
      const campaign_goal = searchParams.get('campaign_goal') as any;
      const industry = searchParams.get('industry') || 'Technology';
      const urgency = searchParams.get('urgency') as any || 'medium';

      if (relationship_status && campaign_goal) {
        const recommended = getRecommendedTemplate({
          relationship_status,
          campaign_goal,
          industry,
          urgency
        });
        return NextResponse.json({ 
          recommended_template: recommended,
          reason: `Best fit for ${relationship_status} relationships with ${campaign_goal} goal`
        });
      }
    }

    // Return all templates by default
    return NextResponse.json({ 
      templates: CAMPAIGN_TEMPLATES,
      total: CAMPAIGN_TEMPLATES.length,
      types: ['linkedin_connection', 'linkedin_dm', 'group_message', 'company_follow']
    });

  } catch (error) {
    console.error('Template API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, template_id, prospect_data } = body;

    if (action === 'validate_template') {
      const template = getTemplateById(template_id);
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      const missingVariables = validateTemplateVariables(template, prospect_data);
      
      return NextResponse.json({
        template_id,
        is_valid: missingVariables.length === 0,
        missing_variables: missingVariables,
        required_variables: template.variables
      });
    }

    if (action === 'populate_template') {
      const template = getTemplateById(template_id);
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      const populatedSteps = template.steps.map(step => ({
        ...step,
        populated_message: populateTemplate(step.message_template, prospect_data),
        original_template: step.message_template
      }));

      return NextResponse.json({
        template_id,
        template_name: template.name,
        populated_steps: populatedSteps,
        prospect_name: `${prospect_data.first_name} ${prospect_data.last_name}`,
        company: prospect_data.company_name
      });
    }

    if (action === 'create_campaign_from_template') {
      const { template_id, prospects, campaign_name, customizations } = body;
      
      const template = getTemplateById(template_id);
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      // Validate all prospects have required data
      const validationResults = prospects.map((prospect: any, index: number) => ({
        prospect_index: index,
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        missing_variables: validateTemplateVariables(template, prospect),
        is_valid: validateTemplateVariables(template, prospect).length === 0
      }));

      const invalidProspects = validationResults.filter(r => !r.is_valid);
      
      if (invalidProspects.length > 0) {
        return NextResponse.json({
          error: 'Some prospects missing required data',
          invalid_prospects: invalidProspects,
          template_variables: template.variables
        }, { status: 400 });
      }

      // Create campaign configuration
      const campaignConfig = {
        name: campaign_name || `${template.name} - ${new Date().toLocaleDateString()}`,
        description: template.description,
        type: template.type,
        template_id: template.id,
        prospects: prospects.length,
        steps: template.steps.length,
        settings: {
          ...template.settings,
          ...customizations?.settings
        },
        estimated_duration_days: Math.max(...template.steps.map(s => s.delay_days)),
        expected_response_rate: template.expected_response_rate,
        use_cases: template.use_cases
      };

      return NextResponse.json({
        campaign_config: campaignConfig,
        template_used: template,
        prospects_validated: validationResults,
        ready_for_execution: true
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Template processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process template request' },
      { status: 500 }
    );
  }
}