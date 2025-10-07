/**
 * Context-Aware Document Intelligence System
 *
 * Analyzes uploaded documents to understand context and extract structured data:
 * - Auto-detects document type (LinkedIn profile, pitch deck, case study, etc.)
 * - Extracts relevant information based on document context
 * - Routes data to appropriate Knowledge Base sections
 * - Stores as Q&A pairs in dual storage system
 */

import { storeQAInKnowledgeBase } from './sam-kb-integration';
import type { QuestionAnswer } from './sam-qa-storage';

// Document type classifications
export type DocumentType =
  | 'linkedin_profile'
  | 'pitch_deck'
  | 'case_study'
  | 'icp_document'
  | 'product_sheet'
  | 'pricing_doc'
  | 'competitor_analysis'
  | 'prospect_list'
  | 'email_template'
  | 'sales_script'
  | 'unknown';

// Document analysis result
export interface DocumentAnalysis {
  documentType: DocumentType;
  confidence: number;
  extractedData: Record<string, any>;
  suggestedKBSections: string[];
  qaPairs: QuestionAnswer[];
  summary: string;
}

// LinkedIn profile extraction
interface LinkedInProfileData {
  name?: string;
  headline?: string;
  location?: string;
  about?: string;
  currentRole?: string;
  currentCompany?: string;
  industry?: string;
  skills?: string[];
  experience?: Array<{
    title: string;
    company: string;
    duration?: string;
  }>;
}

// Pitch deck extraction
interface PitchDeckData {
  companyName?: string;
  valueProposition?: string;
  problemStatement?: string;
  solution?: string;
  targetMarket?: string;
  competitiveAdvantage?: string;
  businessModel?: string;
  traction?: string;
  pricing?: string;
  teamInfo?: string;
}

// Case study extraction
interface CaseStudyData {
  clientName?: string;
  industry?: string;
  challenge?: string;
  solution?: string;
  results?: string;
  metrics?: Array<{
    metric: string;
    value: string;
  }>;
  testimonial?: string;
}

/**
 * Analyze document using AI to understand context and extract structured data
 */
export async function analyzeDocumentWithAI(
  extractedText: string,
  fileName: string,
  userProvidedType?: string
): Promise<DocumentAnalysis> {
  try {
    // Build analysis prompt
    const analysisPrompt = `Analyze this document and extract structured information.

DOCUMENT FILENAME: ${fileName}
USER PROVIDED TYPE: ${userProvidedType || 'Not specified'}

DOCUMENT CONTENT:
${extractedText.substring(0, 8000)} ${extractedText.length > 8000 ? '...(truncated)' : ''}

TASK: Analyze this document and provide a JSON response with the following structure:
{
  "documentType": "linkedin_profile" | "pitch_deck" | "case_study" | "icp_document" | "product_sheet" | "pricing_doc" | "competitor_analysis" | "prospect_list" | "email_template" | "sales_script" | "unknown",
  "confidence": 0.0-1.0,
  "summary": "Brief summary of document content",
  "extractedData": {
    // Structured data based on document type
    // For LinkedIn: name, headline, currentRole, currentCompany, industry, skills, experience
    // For Pitch Deck: valueProposition, problemStatement, solution, targetMarket, pricing
    // For Case Study: clientName, industry, challenge, solution, results, metrics, testimonial
    // For ICP Document: targetRole, targetIndustry, painPoints, objectives, companySize
    // For Product Sheet: productName, description, features, benefits, useCases
    // For Pricing: pricingModel, tiers, features, pricing
    // For Competitor: competitorName, strengths, weaknesses, differentiation
  },
  "suggestedKBSections": ["section1", "section2"], // Which KB sections this should populate
  "keyInsights": ["insight1", "insight2"] // Key takeaways
}

IMPORTANT:
- Be specific and extract actual data from the document
- Use the file name and content to determine document type
- Confidence should reflect how certain you are about the classification
- Extract all relevant structured data based on document type`;

    // Call LLM for analysis
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
        'X-Title': 'SAM Document Intelligence'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`AI analysis failed: ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const analysisResult = JSON.parse(aiResponse.choices[0].message.content);

    // Convert analysis to Q&A pairs based on document type
    const qaPairs = generateQAPairsFromAnalysis(analysisResult);

    return {
      documentType: analysisResult.documentType || 'unknown',
      confidence: analysisResult.confidence || 0.5,
      extractedData: analysisResult.extractedData || {},
      suggestedKBSections: analysisResult.suggestedKBSections || [],
      qaPairs,
      summary: analysisResult.summary || 'No summary available'
    };

  } catch (error) {
    console.error('Document AI analysis failed:', error);

    // Fallback: basic type detection from filename
    const fallbackType = detectTypeFromFilename(fileName);

    return {
      documentType: fallbackType,
      confidence: 0.3,
      extractedData: { rawText: extractedText },
      suggestedKBSections: getSuggestedSectionsForType(fallbackType),
      qaPairs: [],
      summary: 'AI analysis failed, basic detection used'
    };
  }
}

/**
 * Generate Q&A pairs from analysis result
 */
function generateQAPairsFromAnalysis(analysisResult: any): QuestionAnswer[] {
  const qaPairs: QuestionAnswer[] = [];
  const { documentType, extractedData } = analysisResult;

  switch (documentType) {
    case 'linkedin_profile':
      if (extractedData.currentRole && extractedData.currentCompany) {
        qaPairs.push({
          questionId: 'linkedin_current_role',
          questionText: 'What is the current role and company?',
          answerText: `${extractedData.currentRole} at ${extractedData.currentCompany}`,
          answerStructured: extractedData,
          stage: 'discovery',
          category: 'linkedin_profile'
        });
      }
      if (extractedData.headline) {
        qaPairs.push({
          questionId: 'linkedin_headline',
          questionText: 'What is the LinkedIn headline?',
          answerText: extractedData.headline,
          stage: 'discovery',
          category: 'linkedin_profile'
        });
      }
      break;

    case 'pitch_deck':
      if (extractedData.valueProposition) {
        qaPairs.push({
          questionId: 'value_proposition',
          questionText: 'What is the company value proposition?',
          answerText: extractedData.valueProposition,
          answerStructured: extractedData,
          stage: 'discovery',
          category: 'business_model'
        });
      }
      if (extractedData.targetMarket) {
        qaPairs.push({
          questionId: 'target_market_from_deck',
          questionText: 'Who is the target market?',
          answerText: extractedData.targetMarket,
          stage: 'discovery',
          category: 'icp_definition'
        });
      }
      if (extractedData.pricing) {
        qaPairs.push({
          questionId: 'pricing_from_deck',
          questionText: 'What is the pricing model?',
          answerText: extractedData.pricing,
          stage: 'discovery',
          category: 'pricing'
        });
      }
      break;

    case 'case_study':
      if (extractedData.challenge && extractedData.solution) {
        qaPairs.push({
          questionId: 'case_study_challenge',
          questionText: 'What challenge did the client face?',
          answerText: extractedData.challenge,
          stage: 'discovery',
          category: 'success_stories'
        });
        qaPairs.push({
          questionId: 'case_study_solution',
          questionText: 'How was the challenge solved?',
          answerText: extractedData.solution,
          stage: 'discovery',
          category: 'success_stories'
        });
      }
      if (extractedData.results) {
        qaPairs.push({
          questionId: 'case_study_results',
          questionText: 'What results were achieved?',
          answerText: extractedData.results,
          answerStructured: { metrics: extractedData.metrics },
          stage: 'discovery',
          category: 'metrics'
        });
      }
      break;

    case 'icp_document':
      if (extractedData.targetRole) {
        qaPairs.push({
          questionId: 'icp_target_role',
          questionText: 'What is the target role/title?',
          answerText: extractedData.targetRole,
          stage: 'discovery',
          category: 'icp_definition'
        });
      }
      if (extractedData.painPoints) {
        qaPairs.push({
          questionId: 'icp_pain_points',
          questionText: 'What are the key pain points?',
          answerText: Array.isArray(extractedData.painPoints)
            ? extractedData.painPoints.join(', ')
            : extractedData.painPoints,
          answerStructured: { pain_points: extractedData.painPoints },
          stage: 'discovery',
          category: 'pain_points'
        });
      }
      break;

    case 'product_sheet':
      if (extractedData.productName && extractedData.description) {
        qaPairs.push({
          questionId: 'product_info',
          questionText: 'What product information is available?',
          answerText: `${extractedData.productName}: ${extractedData.description}`,
          answerStructured: extractedData,
          stage: 'discovery',
          category: 'products'
        });
      }
      break;

    case 'competitor_analysis':
      if (extractedData.competitorName) {
        qaPairs.push({
          questionId: 'competitor_info',
          questionText: `What do we know about ${extractedData.competitorName}?`,
          answerText: extractedData.differentiation || 'Competitor analysis available',
          answerStructured: extractedData,
          stage: 'discovery',
          category: 'competition'
        });
      }
      break;
  }

  return qaPairs;
}

/**
 * Fallback: Detect document type from filename
 */
function detectTypeFromFilename(fileName: string): DocumentType {
  const lowerName = fileName.toLowerCase();

  if (lowerName.includes('linkedin') || lowerName.includes('profile')) {
    return 'linkedin_profile';
  }
  if (lowerName.includes('pitch') || lowerName.includes('deck') || lowerName.includes('presentation')) {
    return 'pitch_deck';
  }
  if (lowerName.includes('case') && lowerName.includes('study')) {
    return 'case_study';
  }
  if (lowerName.includes('icp') || lowerName.includes('ideal customer')) {
    return 'icp_document';
  }
  if (lowerName.includes('product') || lowerName.includes('feature')) {
    return 'product_sheet';
  }
  if (lowerName.includes('pric')) {
    return 'pricing_doc';
  }
  if (lowerName.includes('competitor') || lowerName.includes('competition')) {
    return 'competitor_analysis';
  }
  if (lowerName.includes('prospect') || lowerName.includes('lead')) {
    return 'prospect_list';
  }
  if (lowerName.includes('email') || lowerName.includes('template')) {
    return 'email_template';
  }
  if (lowerName.includes('script') || lowerName.includes('talk track')) {
    return 'sales_script';
  }

  return 'unknown';
}

/**
 * Get suggested KB sections for document type
 */
function getSuggestedSectionsForType(documentType: DocumentType): string[] {
  const sectionMap: Record<DocumentType, string[]> = {
    'linkedin_profile': ['linkedin-profile', 'personas'],
    'pitch_deck': ['business-model', 'products', 'pricing', 'icp-definition'],
    'case_study': ['success-stories', 'metrics'],
    'icp_document': ['icp-definition', 'pain-points', 'objections'],
    'product_sheet': ['products'],
    'pricing_doc': ['pricing'],
    'competitor_analysis': ['competition'],
    'prospect_list': ['prospects'],
    'email_template': ['messaging', 'content-strategy'],
    'sales_script': ['messaging', 'objections'],
    'unknown': ['documents']
  };

  return sectionMap[documentType] || ['documents'];
}

/**
 * Process uploaded document with context awareness
 */
export async function processDocumentWithContext(params: {
  extractedText: string;
  fileName: string;
  fileType: string;
  workspaceId: string;
  userId: string;
  sessionId?: string;
  userProvidedType?: string;
  attachmentId?: string; // Link Q&A pairs to source document
}): Promise<DocumentAnalysis> {
  const { extractedText, fileName, workspaceId, userId, sessionId, userProvidedType, attachmentId } = params;

  // Skip AI analysis for very short documents
  if (extractedText.length < 50) {
    return {
      documentType: 'unknown',
      confidence: 0.1,
      extractedData: { rawText: extractedText },
      suggestedKBSections: ['documents'],
      qaPairs: [],
      summary: 'Document too short for analysis'
    };
  }

  // Analyze document with AI
  const analysis = await analyzeDocumentWithAI(extractedText, fileName, userProvidedType);

  // Store Q&A pairs in dual storage system with source tracking
  if (analysis.qaPairs.length > 0 && workspaceId) {
    for (const qa of analysis.qaPairs) {
      try {
        // Add source attachment ID to link Q&A to original document
        const qaWithSource = {
          ...qa,
          sourceAttachmentId: attachmentId
        };
        await storeQAInKnowledgeBase(workspaceId, userId, sessionId, qaWithSource);
      } catch (error) {
        console.error('Failed to store Q&A from document:', error);
      }
    }
  }

  return analysis;
}
