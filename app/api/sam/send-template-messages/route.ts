import { NextRequest, NextResponse } from 'next/server';
import { TemplateSelectionEngine, MessageAssembler, ProspectData, MessageTemplate } from '@/app/lib/template-selection-engine';

// Production-ready templates for immediate LinkedIn use
const PRODUCTION_TEMPLATES: MessageTemplate[] = [
  {
    id: 'sam_ai_intro',
    name: 'Sam AI Introduction',
    category: 'generic',
    subcategory: 'sam_intro',
    opening_template: "Hi {{first_name}}, hope you're doing well at {{company_name}}.",
    body_template: "I wanted to reach out because we help companies like {{company_name}} generate more qualified meetings through intelligent, personalized outreach at scale.\n\nMost of our clients see 3-5x more qualified meetings within 30 days while reducing the manual effort by 80%.",
    cta_template: "Worth a quick 15-minute conversation to explore how this could help {{company_name}}?",
    usage_count: 0,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'saas_growth',
    name: 'SaaS Growth Focus',
    category: 'industry_specific',
    subcategory: 'saas',
    opening_template: "Hi {{first_name}}, {{company_name}} looks like it's in a great growth phase.",
    body_template: "SaaS companies often face the challenge of scaling outreach without losing the personal touch. We solve this exact problem with AI that maintains authenticity while reaching 10x more prospects.\n\nWe've helped similar SaaS companies increase their pipeline by 300% without adding headcount.",
    cta_template: "Interested in seeing how other SaaS companies achieve predictable pipeline growth?",
    target_industries: ['saas', 'software', 'technology'],
    usage_count: 0,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'sales_leader',
    name: 'Sales Leader Focus',
    category: 'pain_point',
    subcategory: 'sales_efficiency',
    opening_template: "Hi {{first_name}}, as {{job_title}} at {{company_name}}, you probably know the challenge of scaling personalized outreach.",
    body_template: "Sales leaders consistently tell us their biggest bottleneck is generating enough quality pipeline without burning out their team on manual prospecting.\n\nOur AI-powered system maintains the personal touch while automating the heavy lifting - most teams see 4x more qualified opportunities in their first month.",
    cta_template: "Worth a brief conversation about how we help sales leaders hit their pipeline targets?",
    target_seniority: ['vp', 'director', 'c_level'],
    target_department: ['sales'],
    usage_count: 0,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'growth_stage',
    name: 'Growth Stage Company',
    category: 'growth_stage',
    subcategory: 'scaling',
    opening_template: "Hi {{first_name}}, {{company_name}} seems to be scaling rapidly - congratulations!",
    body_template: "Growing companies often hit a wall where their current outreach methods don't scale with their ambitions. The choice becomes: hire more SDRs (expensive) or send generic messages (poor conversion).\n\nWe offer a third option: AI-powered personalization that scales with your growth while maintaining authentic conversations.",
    cta_template: "Want to see how other growth-stage companies maintain personal outreach at scale?",
    target_company_size: { min: 20, max: 500 },
    usage_count: 0,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'pipeline_consistency',
    name: 'Pipeline Consistency',
    category: 'pain_point',
    subcategory: 'pipeline',
    opening_template: "Hi {{first_name}}, consistent pipeline is probably one of {{company_name}}'s biggest priorities right now.",
    body_template: "Most companies struggle with feast-or-famine pipeline - great months followed by dry spells. This makes forecasting and resource planning nearly impossible.\n\nWe help companies create predictable, consistent pipeline through systematic, intelligent outreach that generates steady flow of qualified opportunities.",
    cta_template: "Interested in discussing how to create more predictable pipeline for {{company_name}}?",
    target_pain_points: ['pipeline_consistency', 'forecasting', 'lead_generation'],
    usage_count: 0,
    created_at: new Date(),
    updated_at: new Date()
  }
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prospects, send_immediately = false, template_preference = 'auto_select' } = body;

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
      return NextResponse.json({
        error: 'Prospects array is required'
      }, { status: 400 });
    }

    const templateEngine = new TemplateSelectionEngine(PRODUCTION_TEMPLATES);
    const messagesGenerated = [];
    const messagesSent = [];
    const errors = [];

    // Generate messages for all prospects
    for (const prospectData of prospects) {
      try {
        const prospect: ProspectData = {
          first_name: prospectData.first_name,
          company_name: prospectData.company_name,
          industry: prospectData.industry,
          company_size: prospectData.company_size,
          job_title: prospectData.job_title,
          seniority_level: prospectData.seniority_level,
          department: prospectData.department,
          pain_points: prospectData.pain_points,
          recent_activity: prospectData.recent_activity
        };

        // Select optimal template
        let selectedTemplate;
        if (template_preference === 'auto_select') {
          selectedTemplate = templateEngine.selectOptimalTemplate(prospect);
        } else {
          selectedTemplate = PRODUCTION_TEMPLATES.find(t => t.id === template_preference);
        }

        if (!selectedTemplate) {
          errors.push({
            prospect: prospect.first_name,
            error: 'No suitable template found'
          });
          continue;
        }

        // Generate message with zero-token personalization
        const assembledMessage = MessageAssembler.assembleMessage(
          selectedTemplate, 
          prospect, 
          'variable_only'
        );

        messagesGenerated.push({
          prospect_name: prospect.first_name,
          company_name: prospect.company_name,
          template_used: selectedTemplate.name,
          message: assembledMessage.full_message,
          personalization_cost: assembledMessage.personalization_cost,
          ready_to_send: true
        });

        // If send_immediately is true, execute LinkedIn campaign
        if (send_immediately) {
          try {
            const linkedinResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/campaigns/direct/send-connection-requests`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignId: `template_${Date.now()}_${prospect.first_name}`
              })
            });

            const linkedinResult = await linkedinResponse.json();
            
            messagesSent.push({
              prospect_name: prospect.first_name,
              company_name: prospect.company_name,
              template_used: selectedTemplate.name,
              linkedin_result: linkedinResult,
              sent_at: new Date().toISOString()
            });

          } catch (sendError) {
            errors.push({
              prospect: prospect.first_name,
              error: `Failed to send LinkedIn message: ${sendError}`
            });
          }
        }

      } catch (prospectError) {
        errors.push({
          prospect: prospectData.first_name || 'Unknown',
          error: `Failed to process prospect: ${prospectError}`
        });
      }
    }

    // Calculate cost savings
    const totalMessages = messagesGenerated.length;
    const totalTokensSaved = totalMessages * 300; // vs full personalization
    const costSaved = (totalTokensSaved / 1000000) * 4; // Mistral Medium pricing

    const response = {
      success: true,
      summary: {
        messages_generated: totalMessages,
        messages_sent: messagesSent.length,
        errors: errors.length,
        total_cost: 0, // Variable-only personalization
        tokens_saved: totalTokensSaved,
        cost_saved_usd: costSaved,
        templates_used: [...new Set(messagesGenerated.map(m => m.template_used))]
      },
      messages_generated: messagesGenerated,
      messages_sent: send_immediately ? messagesSent : [],
      errors: errors.length > 0 ? errors : undefined,
      next_steps: send_immediately ? 
        ["Monitor LinkedIn responses", "Track template performance", "Optimize based on results"] :
        ["Review generated messages", "Send via LinkedIn when ready", "Use send_immediately: true to auto-send"]
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Template message sending error:', error);
    return NextResponse.json({
      error: 'Failed to process template messages',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'show_templates';

  if (action === 'show_templates') {
    return NextResponse.json({
      message: "Available production templates for immediate use",
      templates: PRODUCTION_TEMPLATES.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        subcategory: t.subcategory,
        target_industries: t.target_industries,
        target_seniority: t.target_seniority,
        target_company_size: t.target_company_size,
        sample_message: {
          opening: t.opening_template,
          body: t.body_template.substring(0, 100) + '...',
          cta: t.cta_template
        }
      })),
      usage_instructions: {
        endpoint: "POST /api/sam/send-template-messages",
        required_fields: ["prospects"],
        optional_fields: ["send_immediately", "template_preference"],
        example_prospect: {
          first_name: "John",
          company_name: "TechCorp",
          industry: "saas",
          job_title: "VP of Sales",
          company_size: 150
        }
      }
    });
  }

  if (action === 'quick_test') {
    // Quick test with sample data
    const testRequest = new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({
        prospects: [
          {
            first_name: "Test User",
            company_name: "Sample Company",
            industry: "saas",
            job_title: "VP of Sales",
            company_size: 150,
            seniority_level: "vp",
            department: "sales"
          }
        ],
        send_immediately: false,
        template_preference: 'auto_select'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    return POST(testRequest);
  }

  return NextResponse.json({
    message: "Template message sender ready",
    available_actions: [
      "?action=show_templates - View all available templates",
      "?action=quick_test - Test with sample prospect data"
    ]
  });
}