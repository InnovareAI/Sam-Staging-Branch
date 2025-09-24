import { NextRequest, NextResponse } from 'next/server';
import { VariableReplacer } from '@/app/lib/template-selection-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template_message, workspace_id, user_id, action = 'process' } = body;

    if (!template_message) {
      return NextResponse.json({
        error: 'Template message is required'
      }, { status: 400 });
    }

    // Clean and format the template message
    const cleanedTemplate = template_message
      .trim()
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    // Analyze the template for personalization variables
    const detectedVariables = analyzeTemplateVariables(cleanedTemplate);
    
    // Enhance template with standard variables if missing
    const enhancedTemplate = enhanceTemplateWithVariables(cleanedTemplate, detectedVariables);

    switch (action) {
      case 'process': {
        return NextResponse.json({
          success: true,
          template_processed: true,
          original_template: template_message,
          enhanced_template: enhancedTemplate,
          detected_variables: detectedVariables,
          personalization_opportunities: getPersonalizationOpportunities(cleanedTemplate),
          cost_analysis: {
            variable_only: {
              tokens: 0,
              cost_usd: 0,
              description: "Pure variable replacement - no AI tokens used"
            },
            ai_enhanced: {
              tokens: 50,
              cost_usd: 0.0002, // Mistral Medium pricing
              description: "AI-generated opening paragraph + your template body"
            }
          },
          next_actions: [
            "test_personalization",
            "send_to_prospects",
            "save_as_template"
          ],
          message: "Template processed successfully! Ready for personalization and sending."
        });
      }

      case 'test_personalization': {
        // Test with sample prospect data
        const sampleProspect = {
          first_name: "John",
          company_name: "TechCorp",
          industry: "saas",
          job_title: "VP of Sales",
          company_size: 150
        };

        const personalizedMessage = VariableReplacer.replaceVariables(enhancedTemplate, sampleProspect);

        return NextResponse.json({
          success: true,
          sample_personalization: {
            prospect: sampleProspect,
            original_template: enhancedTemplate,
            personalized_message: personalizedMessage,
            variables_replaced: detectedVariables.filter(v => sampleProspect[v as keyof typeof sampleProspect])
          },
          message: "Here's how your template looks with sample personalization"
        });
      }

      case 'save_as_template': {
        // Save to user's template library (placeholder for future database integration)
        return NextResponse.json({
          success: true,
          template_saved: true,
          template_id: `user_template_${Date.now()}`,
          message: "Template saved to your library for future use"
        });
      }

      default:
        return NextResponse.json({
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Template processing error:', error);
    return NextResponse.json({
      error: 'Failed to process template',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Analyze template for existing personalization variables
 */
function analyzeTemplateVariables(template: string): string[] {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const matches = template.match(variablePattern) || [];
  
  return [...new Set(matches.map(match => match.replace(/[{}]/g, '')))];
}

/**
 * Enhance template with standard variables if they're missing
 */
function enhanceTemplateWithVariables(template: string, existingVariables: string[]): string {
  let enhanced = template;
  
  // If no first_name variable, try to add it naturally at the beginning
  if (!existingVariables.includes('first_name') && !enhanced.toLowerCase().startsWith('hi ')) {
    enhanced = `Hi {{first_name}}, ${enhanced.charAt(0).toLowerCase() + enhanced.slice(1)}`;
  }
  
  // Look for company mentions and suggest variable replacement
  const companyMentions = enhanced.match(/\b(company|organization|firm|business)\b/gi);
  if (companyMentions && !existingVariables.includes('company_name')) {
    // Don't automatically replace - just suggest in analysis
  }
  
  return enhanced;
}

/**
 * Get personalization opportunities analysis
 */
function getPersonalizationOpportunities(template: string) {
  const opportunities = [];
  
  // Check for greeting personalization
  if (!template.toLowerCase().includes('{{first_name}}') && !template.toLowerCase().startsWith('hi ')) {
    opportunities.push({
      type: 'greeting',
      suggestion: 'Add "Hi {{first_name}}," at the beginning for personal touch',
      impact: 'high'
    });
  }
  
  // Check for company personalization
  if (!template.includes('{{company_name}}')) {
    const companyMentions = (template.match(/\b(company|organization|firm|business|team)\b/gi) || []).length;
    if (companyMentions > 0) {
      opportunities.push({
        type: 'company',
        suggestion: 'Replace generic company references with {{company_name}}',
        impact: 'high'
      });
    }
  }
  
  // Check for industry personalization
  if (!template.includes('{{industry}}')) {
    opportunities.push({
      type: 'industry',
      suggestion: 'Consider adding {{industry}} for sector-specific messaging',
      impact: 'medium'
    });
  }
  
  // Check for role/title personalization
  if (!template.includes('{{job_title}}')) {
    opportunities.push({
      type: 'role',
      suggestion: 'Add {{job_title}} to acknowledge their specific role',
      impact: 'medium'
    });
  }
  
  return opportunities;
}

/**
 * GET endpoint for testing and documentation
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'info';

  if (action === 'test') {
    // Test with sample template
    const sampleTemplate = `I wanted to reach out because I noticed your company is growing rapidly. Our platform helps companies scale their outreach without losing the personal touch. Worth a quick call to discuss?`;

    const testRequest = new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({
        template_message: sampleTemplate,
        workspace_id: 'test_workspace',
        user_id: 'test_user',
        action: 'process'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    return POST(testRequest);
  }

  return NextResponse.json({
    message: "Template Processing API",
    description: "Process user-provided templates for LinkedIn outreach",
    supported_inputs: [
      "Copy/paste text directly in chat",
      "Upload PDF files",
      "Upload TXT files", 
      "Upload DOCX files"
    ],
    template_indicators: [
      "use this message:",
      "send this message:",
      "template:",
      "message template:",
      "personalize this:",
      "send to prospects:",
      "linkedin message:",
      "outreach message:"
    ],
    available_actions: [
      "process - Analyze and enhance template",
      "test_personalization - See sample with variables filled",
      "save_as_template - Save to template library"
    ],
    example_usage: {
      chat_input: "Use this message: Hi there, I wanted to reach out about helping your company with outreach automation.",
      file_upload: "Upload a PDF/TXT file containing your message templates"
    }
  });
}