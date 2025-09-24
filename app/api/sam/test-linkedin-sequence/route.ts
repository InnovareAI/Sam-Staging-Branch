import { NextRequest, NextResponse } from 'next/server';
import { TemplateSelectionEngine, VariableReplacer, MessageAssembler, ProspectData, MessageTemplate } from '@/app/lib/template-selection-engine';

// Test templates for LinkedIn sequence testing
const TEST_TEMPLATES: MessageTemplate[] = [
  {
    id: 'growth_series_b',
    name: 'Series B Growth Company',
    category: 'growth_stage',
    subcategory: 'series_b',
    opening_template: "Hi {{first_name}}, saw {{company_name}} recently raised Series B - congratulations!",
    body_template: "Scaling from startup to growth stage often means your outreach processes need to evolve too. We help companies like {{company_name}} maintain personalized engagement while reaching 10x more prospects.\n\nMost of our clients see 3-5x more qualified meetings within 30 days of launch.",
    cta_template: "Worth exploring how we've helped other Series B companies streamline their sales process?",
    target_company_size: { min: 50, max: 500 },
    target_industries: ['saas', 'technology', 'fintech'],
    target_seniority: ['vp', 'director', 'c_level'],
    usage_count: 25,
    response_rate: 0.12,
    meeting_conversion_rate: 0.08,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'enterprise_efficiency',
    name: 'Enterprise Efficiency Focus',
    category: 'enterprise',
    subcategory: 'efficiency',
    opening_template: "Hi {{first_name}}, {{company_name}}'s scale presents unique sales process challenges.",
    body_template: "Enterprise teams often struggle with maintaining personalization while achieving volume targets. Our AI-powered system solves this exact challenge - helping teams like yours generate qualified pipeline without the manual effort.\n\nWe've helped similar enterprises increase pipeline by 300% while reducing time-to-meeting by 75%.",
    cta_template: "Worth a conversation about how we help Fortune 500 teams scale without sacrificing quality?",
    target_company_size: { min: 1000 },
    target_industries: ['enterprise', 'manufacturing', 'finance'],
    target_seniority: ['vp', 'c_level'],
    usage_count: 18,
    response_rate: 0.09,
    meeting_conversion_rate: 0.06,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'saas_pipeline',
    name: 'SaaS Pipeline Consistency',
    category: 'industry_specific',
    subcategory: 'saas',
    opening_template: "Hi {{first_name}}, {{company_name}} faces the classic SaaS challenge: predictable pipeline generation.",
    body_template: "SaaS companies need consistent, qualified leads to hit recurring revenue targets. Most teams we work with struggle with either volume (not enough outreach) or quality (generic messaging that doesn't convert).\n\nOur platform solves both - generating 3x more qualified demos per month while maintaining authentic, personalized conversations.",
    cta_template: "Want to see how other SaaS companies achieve predictable pipeline growth?",
    target_industries: ['saas', 'software'],
    target_pain_points: ['pipeline_consistency', 'lead_generation'],
    usage_count: 42,
    response_rate: 0.15,
    meeting_conversion_rate: 0.11,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'generic_outreach',
    name: 'Generic Professional Outreach',
    category: 'generic',
    subcategory: 'default',
    opening_template: "Hi {{first_name}}, hope you're doing well at {{company_name}}.",
    body_template: "I wanted to reach out because we help companies like {{company_name}} generate more qualified meetings through intelligent, personalized outreach.\n\nMost of our clients see significant improvements in their pipeline within the first month.",
    cta_template: "Worth a quick 15-minute conversation to explore how this could help {{company_name}}?",
    usage_count: 5,
    response_rate: 0.06,
    meeting_conversion_rate: 0.03,
    created_at: new Date(),
    updated_at: new Date()
  }
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospect_data, test_type = 'template_selection' } = body;

    // Validate prospect data
    if (!prospect_data || !prospect_data.first_name || !prospect_data.company_name) {
      return NextResponse.json({
        error: 'Missing required prospect data (first_name, company_name)'
      }, { status: 400 });
    }

    const prospect: ProspectData = {
      first_name: prospect_data.first_name,
      company_name: prospect_data.company_name,
      industry: prospect_data.industry,
      company_size: prospect_data.company_size,
      job_title: prospect_data.job_title,
      seniority_level: prospect_data.seniority_level,
      department: prospect_data.department,
      recent_funding: prospect_data.recent_funding,
      funding_stage: prospect_data.funding_stage,
      growth_indicators: prospect_data.growth_indicators,
      pain_points: prospect_data.pain_points,
      recent_activity: prospect_data.recent_activity
    };

    // Initialize template engine
    const templateEngine = new TemplateSelectionEngine(TEST_TEMPLATES);

    switch (test_type) {
      case 'template_selection': {
        // Test template selection algorithm
        const selectedTemplate = templateEngine.selectOptimalTemplate(prospect);
        const recommendations = templateEngine.getTemplateRecommendations(prospect);
        
        return NextResponse.json({
          success: true,
          test_type: 'template_selection',
          prospect_data: prospect,
          selected_template: selectedTemplate,
          recommendations: recommendations,
          message: `Selected template: ${selectedTemplate?.name || 'None'}`
        });
      }

      case 'variable_replacement': {
        // Test variable-only personalization (0 tokens)
        const selectedTemplate = templateEngine.selectOptimalTemplate(prospect);
        if (!selectedTemplate) {
          return NextResponse.json({
            error: 'No suitable template found for prospect'
          }, { status: 404 });
        }

        const assembledMessage = MessageAssembler.assembleMessage(
          selectedTemplate, 
          prospect, 
          'variable_only'
        );

        return NextResponse.json({
          success: true,
          test_type: 'variable_replacement',
          prospect_data: prospect,
          template_used: selectedTemplate.name,
          assembled_message: assembledMessage,
          personalization_cost: assembledMessage.personalization_cost,
          message: `Generated message using template: ${selectedTemplate.name} (${assembledMessage.personalization_cost} tokens)`
        });
      }

      case 'linkedin_sequence': {
        // Test complete LinkedIn sequence generation
        const selectedTemplate = templateEngine.selectOptimalTemplate(prospect);
        if (!selectedTemplate) {
          return NextResponse.json({
            error: 'No suitable template found for prospect'
          }, { status: 404 });
        }

        // Generate connection request
        const connectionRequest = MessageAssembler.assembleMessage(
          selectedTemplate, 
          prospect, 
          'variable_only'
        );

        // Generate follow-up messages (simplified for testing)
        const followUp1 = {
          ...connectionRequest,
          full_message: `Hi ${prospect.first_name}, thanks for connecting! ${connectionRequest.body}\n\n${connectionRequest.cta}`,
          template_used: selectedTemplate.id + '_followup_1'
        };

        const followUp2 = {
          ...connectionRequest,
          full_message: `Hi ${prospect.first_name}, wanted to circle back on my previous message about helping ${prospect.company_name} with pipeline generation.\n\n${connectionRequest.cta}`,
          template_used: selectedTemplate.id + '_followup_2'
        };

        return NextResponse.json({
          success: true,
          test_type: 'linkedin_sequence',
          prospect_data: prospect,
          template_used: selectedTemplate.name,
          sequence: {
            connection_request: {
              message: `Hi ${prospect.first_name}, ${connectionRequest.opening.replace('Hi ' + prospect.first_name + ', ', '')}`,
              personalization_cost: 0
            },
            follow_up_1: {
              message: followUp1.full_message,
              personalization_cost: 0,
              delay_days: 3
            },
            follow_up_2: {
              message: followUp2.full_message,
              personalization_cost: 0,
              delay_days: 7
            }
          },
          total_cost: 0,
          message: `LinkedIn sequence generated for ${prospect.first_name} at ${prospect.company_name} using ${selectedTemplate.name} template`
        });
      }

      case 'cost_comparison': {
        // Compare costs across different personalization approaches
        const selectedTemplate = templateEngine.selectOptimalTemplate(prospect);
        if (!selectedTemplate) {
          return NextResponse.json({
            error: 'No suitable template found for prospect'
          }, { status: 404 });
        }

        const variableOnly = MessageAssembler.assembleMessage(selectedTemplate, prospect, 'variable_only');
        const aiEnhanced = MessageAssembler.assembleMessage(selectedTemplate, prospect, 'ai_enhanced');

        // Simulate full personalization cost (300 tokens)
        const fullPersonalizationCost = 300;

        return NextResponse.json({
          success: true,
          test_type: 'cost_comparison',
          prospect_data: prospect,
          template_used: selectedTemplate.name,
          cost_comparison: {
            full_personalization: {
              cost_tokens: fullPersonalizationCost,
              cost_usd: (fullPersonalizationCost / 1000000) * 4, // Mistral Medium pricing
              message: "Would generate completely custom message"
            },
            ai_enhanced: {
              cost_tokens: aiEnhanced.personalization_cost,
              cost_usd: (aiEnhanced.personalization_cost / 1000000) * 4,
              message: aiEnhanced.full_message,
              savings_vs_full: `${Math.round((1 - aiEnhanced.personalization_cost / fullPersonalizationCost) * 100)}%`
            },
            variable_only: {
              cost_tokens: variableOnly.personalization_cost,
              cost_usd: (variableOnly.personalization_cost / 1000000) * 4,
              message: variableOnly.full_message,
              savings_vs_full: `${Math.round((1 - variableOnly.personalization_cost / fullPersonalizationCost) * 100)}%`
            }
          },
          message: `Cost comparison complete. Variable-only saves ${Math.round((1 - variableOnly.personalization_cost / fullPersonalizationCost) * 100)}% vs full personalization`
        });
      }

      default:
        return NextResponse.json({
          error: `Unknown test type: ${test_type}. Available: template_selection, variable_replacement, linkedin_sequence, cost_comparison`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('LinkedIn sequence test error:', error);
    return NextResponse.json({
      error: 'Failed to process LinkedIn sequence test',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET endpoint for testing with default data
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('test_type') || 'template_selection';

  // Default test prospect data
  const defaultProspect = {
    first_name: "John",
    company_name: "TechCorp",
    industry: "saas",
    company_size: 150,
    job_title: "VP of Sales",
    seniority_level: "vp" as const,
    department: "sales" as const,
    recent_funding: true,
    funding_stage: "series_b" as const,
    growth_indicators: ["hiring rapidly", "new office"],
    pain_points: ["pipeline_consistency", "scaling_challenges"],
    recent_activity: "just posted about team expansion"
  };

  // Call the POST endpoint with default data
  const testRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({
      prospect_data: defaultProspect,
      test_type: testType
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  });

  return POST(testRequest);
}