import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';
import { createClient } from '@supabase/supabase-js';
import { knowledgeClassifier } from '@/lib/services/knowledge-classifier';

// Helper function to call OpenRouter API
async function callOpenRouter(messages: any[], systemPrompt: string) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  
  if (!openRouterKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.meet-sam.com',
      'X-Title': 'SAM AI Platform'
    },
    body: JSON.stringify({
      model: 'mistralai/mistral-medium', // Cost-optimized: $4/1M tokens
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 150 // Optimized for cost control
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'I apologize, but I had trouble processing that request.';
}

// RAG Knowledge Retrieval function
async function retrieveRelevantKnowledge(userMessage: string, currentUser: any, supabase: any) {
  try {
    // Get user's current workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', currentUser.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;
    if (!workspaceId) {
      return [];
    }

    // Extract keywords from user message for search
    const searchTerms = extractSearchKeywords(userMessage);
    if (searchTerms.length === 0) {
      return [];
    }

    // Build search query for Knowledge Base content
    const searchQuery = searchTerms.join(' | '); // OR search across terms
    
    // Search Knowledge Base content using PostgreSQL full-text search
    const { data: kbResults, error: kbError } = await supabase
      .rpc('search_knowledge_base_sections', {
        p_workspace_id: workspaceId,
        p_search_query: searchQuery,
        p_section_filter: null
      });

    if (kbError) {
      console.error('Knowledge Base search error:', kbError);
      return [];
    }

    // Also search saved conversations for similar discussions
    const { data: conversationResults, error: convError } = await supabase
      .from('knowledge_base_content')
      .select('id, title, content, section_id, tags, metadata')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .contains('tags', ['sam-conversation'])
      .textSearch('content', searchTerms.join(' & '), {
        type: 'websearch',
        config: 'english'
      })
      .limit(3);

    if (convError) {
      console.error('Conversation search error:', convError);
    }

    // Combine and rank results
    const allResults = [];
    
    // Add KB results
    if (kbResults && kbResults.length > 0) {
      allResults.push(...kbResults.slice(0, 5).map(item => ({
        title: item.title,
        snippet: item.content_snippet,
        section_id: item.section_id,
        tags: [],
        source: 'knowledge_base',
        rank: item.rank || 0
      })));
    }

    // Add conversation results
    if (conversationResults && conversationResults.length > 0) {
      allResults.push(...conversationResults.map(item => ({
        title: item.title,
        snippet: extractConversationSnippet(item.content, userMessage),
        section_id: item.section_id,
        tags: item.tags || [],
        source: 'conversation',
        rank: 0.8 // Slightly lower rank for conversations
      })));
    }

    // Sort by relevance and return top results
    return allResults
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 4); // Return top 4 most relevant items

  } catch (error) {
    console.error('Error in retrieveRelevantKnowledge:', error);
    return [];
  }
}

// Helper function to extract search keywords from user message
function extractSearchKeywords(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Remove common stop words
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'about', 'how', 'what', 'when', 'where', 'why', 'who'];
  
  // Extract meaningful words (3+ characters)
  const words = lowerMessage
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.includes(word))
    .slice(0, 10); // Limit to top 10 terms
  
  return words;
}

// Helper function to extract relevant snippet from conversation content
function extractConversationSnippet(content: any, userMessage: string) {
  try {
    if (typeof content === 'string') {
      return content.substring(0, 200) + '...';
    }
    
    if (content && typeof content === 'object') {
      if (content.user_message && content.assistant_response) {
        return `Q: ${content.user_message.substring(0, 100)}... A: ${content.assistant_response.substring(0, 100)}...`;
      }
      if (content.title) {
        return content.title;
      }
    }
    
    return 'Relevant conversation found';
  } catch (error) {
    return 'Knowledge base content';
  }
}

// Prospect search processing system
async function processProspectSearchRequest(userMessage: string, workspaceId: string) {
  const lowerMessage = userMessage.toLowerCase();
  
  // Prospect search indicators
  const searchIndicators = [
    'find prospects',
    'search for',
    'find people',
    'look for prospects',
    'get contacts',
    'scrape linkedin',
    'search linkedin',
    'find vp sales',
    'find ceos',
    'find decision makers',
    'prospect research',
    'lead generation'
  ];
  
  const isProspectSearch = searchIndicators.some(indicator => 
    lowerMessage.includes(indicator)
  );
  
  if (isProspectSearch) {
    // Extract search criteria from message
    const criteria = extractSearchCriteria(userMessage);
    
    // Determine search type
    let searchType = 'brightdata'; // Default to premium
    if (lowerMessage.includes('google')) searchType = 'google_search';
    if (lowerMessage.includes('network') || lowerMessage.includes('connections')) searchType = 'unipile_network';
    
    // Check for auto-send request
    const autoSend = lowerMessage.includes('and send') || lowerMessage.includes('send them');
    
    return {
      isProspectSearch: true,
      searchType: searchType,
      criteria: criteria,
      autoSend: autoSend,
      campaignConfig: autoSend ? { template_message: extractTemplateFromMessage(userMessage) } : null
    };
  }
  
  return {
    isProspectSearch: false,
    searchType: null,
    criteria: null,
    autoSend: false,
    campaignConfig: null
  };
}

// Extract search criteria from natural language
function extractSearchCriteria(message: string) {
  const criteria: any = {
    max_results: 50 // Default
  };
  
  // Extract job titles
  const titlePatterns = [
    /vp sales|vice president.*sales|vp of sales/gi,
    /director.*sales|sales director/gi,
    /ceo|chief executive/gi,
    /cto|chief technology/gi,
    /cfo|chief financial/gi,
    /head of sales|sales manager/gi
  ];
  
  criteria.job_titles = [];
  titlePatterns.forEach(pattern => {
    const matches = message.match(pattern);
    if (matches) {
      criteria.job_titles.push(...matches.map(m => m.trim()));
    }
  });
  
  // Extract industries
  const industryPatterns = [
    /saas/gi, /software/gi, /technology/gi, /tech/gi,
    /fintech/gi, /healthcare/gi, /manufacturing/gi,
    /consulting/gi, /ecommerce/gi, /retail/gi
  ];
  
  criteria.industries = [];
  industryPatterns.forEach(pattern => {
    const matches = message.match(pattern);
    if (matches) {
      criteria.industries.push(...matches.map(m => m.trim()));
    }
  });
  
  // Extract company size
  if (message.match(/startup|small/gi)) criteria.company_size = 'small';
  if (message.match(/medium|mid-size|growing/gi)) criteria.company_size = 'medium';  
  if (message.match(/enterprise|large|fortune/gi)) criteria.company_size = 'large';
  
  // Extract locations
  if (message.match(/united states|usa|us/gi)) criteria.locations = ['United States'];
  if (message.match(/canada/gi)) criteria.locations = ['Canada'];
  if (message.match(/europe|eu/gi)) criteria.locations = ['Europe'];
  
  // Extract number of results
  const numberMatch = message.match(/find (\d+)|get (\d+)|(\d+) prospects/i);
  if (numberMatch) {
    criteria.max_results = parseInt(numberMatch[1] || numberMatch[2] || numberMatch[3]);
  }
  
  // Generate keywords from criteria
  criteria.keywords = [
    ...criteria.job_titles,
    ...criteria.industries
  ].join(' ');
  
  return criteria;
}

// Extract template message if included in search request
function extractTemplateFromMessage(message: string) {
  const templatePatterns = [
    /send them[:\s]+"([^"]+)"/i,
    /send this message[:\s]+"([^"]+)"/i,
    /with this template[:\s]+"([^"]+)"/i
  ];
  
  for (const pattern of templatePatterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Template message processing system
async function processTemplateMessage(userMessage: string, workspaceId: string) {
  // Check if user is providing a message template
  const templateIndicators = [
    'use this message',
    'send this message', 
    'template:',
    'message template',
    'personalize this',
    'send to prospects',
    'linkedin message',
    'outreach message'
  ];
  
  const isTemplateMessage = templateIndicators.some(indicator => 
    userMessage.toLowerCase().includes(indicator)
  );
  
  if (isTemplateMessage) {
    // Extract the actual message content
    let messageContent = userMessage;
    
    // Remove template indicators
    templateIndicators.forEach(indicator => {
      const regex = new RegExp(indicator, 'gi');
      messageContent = messageContent.replace(regex, '').trim();
    });
    
    // Clean up the message
    messageContent = messageContent.replace(/^[:\-\s]+/, '').trim();
    
    return {
      isTemplate: true,
      messageContent: messageContent,
      action: 'process_template_message'
    };
  }
  
  return {
    isTemplate: false,
    messageContent: userMessage,
    action: 'regular_chat'
  };
}

// Enhanced conversation analysis and labeling system
function analyzeConversationContent(userMessage: string, assistantResponse: string) {
  const combinedText = (userMessage + ' ' + assistantResponse).toLowerCase();
  
  // Industry vertical detection patterns
  const industries = {
    saas: ['saas', 'software', 'platform', 'api', 'cloud', 'subscription', 'mrr', 'arr', 'churn'],
    financial: ['finance', 'bank', 'credit', 'loan', 'investment', 'trading', 'fintech', 'wealth', 'sec', 'finra'],
    healthcare: ['healthcare', 'health', 'medical', 'hospital', 'patient', 'doctor', 'nurse', 'hipaa', 'clinical'],
    pharma: ['pharma', 'drug', 'clinical', 'trial', 'fda', 'regulatory', 'biotech', 'medicine'],
    legal: ['legal', 'law', 'attorney', 'lawyer', 'litigation', 'contract', 'compliance', 'court'],
    manufacturing: ['manufacturing', 'factory', 'production', 'supply chain', 'industrial', 'assembly'],
    energy: ['energy', 'oil', 'gas', 'renewable', 'solar', 'wind', 'petroleum', 'utility'],
    telecom: ['telecom', 'wireless', 'network', 'fiber', 'broadband', 'cellular', '5g'],
    education: ['education', 'school', 'university', 'student', 'learning', 'academic', 'ferpa'],
    retail: ['retail', 'store', 'ecommerce', 'shopping', 'consumer', 'merchandise'],
    consulting: ['consulting', 'consultant', 'advisory', 'engagement', 'client'],
    logistics: ['logistics', 'shipping', 'freight', 'warehouse', 'supply chain', 'distribution'],
    construction: ['construction', 'building', 'contractor', 'project', 'safety', 'site'],
    real_estate: ['real estate', 'property', 'commercial', 'lease', 'tenant', 'facility'],
    startup: ['startup', 'founder', 'venture', 'seed', 'series a', 'funding', 'investor']
  };

  // Persona/role detection patterns
  const personas = {
    ceo: ['ceo', 'chief executive', 'founder', 'president'],
    cfo: ['cfo', 'chief financial', 'finance director', 'financial controller'],
    cto: ['cto', 'chief technology', 'chief technical', 'head of engineering', 'vp engineering'],
    coo: ['coo', 'chief operating', 'operations director', 'vp operations'],
    cmo: ['cmo', 'chief marketing', 'marketing director', 'vp marketing', 'head of marketing'],
    chro: ['chro', 'chief human', 'hr director', 'head of hr', 'people director'],
    vp_sales: ['vp sales', 'sales director', 'head of sales', 'chief revenue'],
    manager: ['manager', 'director', 'head of', 'lead', 'senior'],
    analyst: ['analyst', 'coordinator', 'specialist', 'associate']
  };

  // Define categorization patterns with confidence weighting
  const categories = {
    icp: {
      keywords: ['icp', 'ideal customer', 'target audience', 'buyer persona', 'customer profile', 'target market'],
      phrases: ['who should we target', 'ideal customer profile', 'target demographic'],
      weight: 1.0
    },
    products: {
      keywords: ['product', 'feature', 'solution', 'offering', 'service', 'tool', 'platform'],
      phrases: ['our product', 'product features', 'what we offer', 'our solution'],
      weight: 0.9
    },
    competition: {
      keywords: ['competitor', 'compete', 'rival', 'alternative', 'vs', 'compared to', 'better than'],
      phrases: ['competitive advantage', 'against competitors', 'competitive analysis'],
      weight: 0.95
    },
    pricing: {
      keywords: ['price', 'cost', 'budget', 'pricing', 'expensive', 'cheap', 'roi', 'value'],
      phrases: ['how much', 'pricing model', 'cost structure', 'return on investment'],
      weight: 0.9
    },
    messaging: {
      keywords: ['message', 'communicate', 'outreach', 'email', 'linkedin', 'pitch', 'template'],
      phrases: ['how to say', 'messaging strategy', 'communication approach'],
      weight: 0.85
    },
    objections: {
      keywords: ['objection', 'concern', 'hesitation', 'doubt', 'worry', 'risk', 'challenge'],
      phrases: ['what if they say', 'common objections', 'handle objections'],
      weight: 0.9
    },
    process: {
      keywords: ['process', 'workflow', 'steps', 'stages', 'pipeline', 'methodology'],
      phrases: ['sales process', 'how to', 'step by step'],
      weight: 0.8
    },
    company: {
      keywords: ['company', 'team', 'organization', 'culture', 'values', 'mission'],
      phrases: ['about us', 'our company', 'our team'],
      weight: 0.7
    }
  };

  // Calculate scores for each category
  const scores = {};
  const detectedLabels = [];
  
  for (const [category, config] of Object.entries(categories)) {
    let score = 0;
    
    // Check keywords
    for (const keyword of config.keywords) {
      if (combinedText.includes(keyword)) {
        score += config.weight * 0.5;
        detectedLabels.push(keyword);
      }
    }
    
    // Check phrases (higher weight)
    for (const phrase of config.phrases) {
      if (combinedText.includes(phrase)) {
        score += config.weight * 1.0;
        detectedLabels.push(phrase.replace(/\s+/g, '-'));
      }
    }
    
    scores[category] = score;
  }

  // Find primary category
  const primaryCategory = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  const maxScore = scores[primaryCategory];
  const confidence = Math.min(maxScore / 2.0, 1.0); // Normalize confidence
  
  // Detect conversation mode based on SAM's design patterns
  let conversationMode = 'general';
  const modeLabels = [];
  
  if (combinedText.includes('hey') || combinedText.includes('hello') || combinedText.includes('how are') || 
      combinedText.includes('business') || combinedText.includes('tell me about')) {
    conversationMode = 'onboarding';
    modeLabels.push('onboarding-mode');
  } else if (combinedText.includes('what makes') || combinedText.includes('different') || combinedText.includes('apollo') ||
             combinedText.includes('vs') || combinedText.includes('compare') || combinedText.includes('features')) {
    conversationMode = 'product-qa';
    modeLabels.push('product-qa-mode');
  } else if (combinedText.includes('launch') || combinedText.includes('campaign') || combinedText.includes('readiness') ||
             combinedText.includes('setup') || combinedText.includes('start')) {
    conversationMode = 'campaign';
    modeLabels.push('campaign-mode');
  } else if (combinedText.includes('too many') || combinedText.includes('overwhelmed') || combinedText.includes('confused') ||
             combinedText.includes('reset') || combinedText.includes('contradictory')) {
    conversationMode = 'repair';
    modeLabels.push('repair-mode');
  }

  // Generate additional contextual labels
  const contextLabels = [];
  if (combinedText.includes('linkedin')) contextLabels.push('linkedin');
  if (combinedText.includes('email')) contextLabels.push('email');
  if (combinedText.includes('prospecting')) contextLabels.push('prospecting');
  if (combinedText.includes('outreach')) contextLabels.push('outreach');
  if (combinedText.includes('sales')) contextLabels.push('sales');
  if (combinedText.includes('lead')) contextLabels.push('lead');
  if (combinedText.includes('qualify')) contextLabels.push('qualification');
  if (combinedText.includes('demo')) contextLabels.push('demo');
  if (combinedText.includes('proposal')) contextLabels.push('proposal');
  if (combinedText.includes('follow up') || combinedText.includes('follow-up')) contextLabels.push('follow-up');
  
  // Add error handling detection labels
  if (combinedText.includes('contradiction') || combinedText.includes('different answer')) contextLabels.push('contradiction');
  if (combinedText.includes('vague') || combinedText.includes('unclear')) contextLabels.push('vague-answer');
  if (combinedText.includes('overwhelm') || combinedText.includes('too much')) contextLabels.push('overwhelm');
  if (combinedText.includes('off topic') || combinedText.includes('different subject')) contextLabels.push('off-topic');

  // Determine content type based on primary category
  let contentType = 'conversation';
  switch (primaryCategory) {
    case 'icp':
      contentType = 'icp_discussion';
      break;
    case 'products':
      contentType = 'product_discussion';
      break;
    case 'competition':
      contentType = 'competitive_discussion';
      break;
    case 'pricing':
      contentType = 'pricing_discussion';
      break;
    case 'messaging':
      contentType = 'messaging_discussion';
      break;
    case 'objections':
      contentType = 'objection_handling';
      break;
    case 'process':
      contentType = 'process_discussion';
      break;
    default:
      contentType = 'general_conversation';
  }

  // Detect industry vertical
  let detectedIndustry = null;
  let industryScore = 0;
  for (const [industry, keywords] of Object.entries(industries)) {
    const matches = keywords.filter(keyword => combinedText.includes(keyword)).length;
    if (matches > industryScore) {
      industryScore = matches;
      detectedIndustry = industry;
    }
  }

  // Detect persona/role
  let detectedPersona = null;
  let personaScore = 0;
  for (const [persona, keywords] of Object.entries(personas)) {
    const matches = keywords.filter(keyword => combinedText.includes(keyword)).length;
    if (matches > personaScore) {
      personaScore = matches;
      detectedPersona = persona;
    }
  }

  // Add industry and persona to labels if detected
  if (detectedIndustry && industryScore > 0) {
    detectedLabels.push(`industry-${detectedIndustry}`);
  }
  if (detectedPersona && personaScore > 0) {
    detectedLabels.push(`persona-${detectedPersona}`);
  }

  // Default to documents section if no strong category match
  const finalSection = maxScore > 0.5 ? primaryCategory : 'documents';
  
  return {
    primarySection: finalSection,
    contentType: contentType,
    confidence: confidence,
    conversationMode: conversationMode,
    labels: [...new Set([...detectedLabels, ...contextLabels, ...modeLabels])], // Remove duplicates
    categoryScores: scores,
    analysis: {
      messageLength: userMessage.length + assistantResponse.length,
      hasQuestions: combinedText.includes('?'),
      hasFiles: false, // Will be updated by caller
      sentiment: combinedText.includes('help') || combinedText.includes('great') ? 'positive' : 'neutral',
      conversationMode: conversationMode,
      detectedIndustry: detectedIndustry,
      detectedPersona: detectedPersona,
      industryScore: industryScore,
      personaScore: personaScore
    }
  };
}

// Helper function to save important conversations to Knowledge Base
async function saveConversationToKnowledgeBase(
  currentUser: any,
  userMessage: string,
  assistantResponse: string,
  knowledgeClassification: any,
  uploadResults: any[],
  supabase: any
) {
  try {
    // Only save conversations with meaningful content to KB
    const messageLength = userMessage.length + assistantResponse.length;
    const hasSignificantContent = messageLength > 50; // Basic filter
    const hasKnowledgeValue = knowledgeClassification?.classification_confidence > 0.3;
    const hasFiles = uploadResults.length > 0;
    
    if (!hasSignificantContent && !hasKnowledgeValue && !hasFiles) {
      console.log('🚫 Skipping KB save: conversation lacks significant content');
      return;
    }

    // Get user's current workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', currentUser.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;
    if (!workspaceId) {
      console.log('🚫 No workspace found for user, skipping KB save');
      return;
    }

    // Enhanced conversation categorization system
    const conversationLabeler = analyzeConversationContent(userMessage, assistantResponse);
    let sectionId = conversationLabeler.primarySection;
    let contentType = conversationLabeler.contentType;
    
    // Get additional labels and confidence scores
    const labels = conversationLabeler.labels;
    const confidence = conversationLabeler.confidence;

    // Create conversation title from first few words of user message
    const words = userMessage.split(' ').slice(0, 8);
    const title = words.length > 7 ? `${words.join(' ')}...` : words.join(' ');

    // Format conversation content as JSONB structure
    const conversationContent = {
      type: 'conversation',
      title: title,
      user_message: userMessage,
      assistant_response: assistantResponse,
      timestamp: new Date().toISOString(),
      files_uploaded: uploadResults.map(result => ({
        filename: result.originalName,
        category: result.category,
        size: result.size || 0
      })),
      categorization: {
        primary_section: sectionId,
        content_type: contentType,
        labels: labels,
        confidence: confidence,
        auto_categorized: true
      },
      metadata: {
        conversation_length: userMessage.length + assistantResponse.length,
        has_files: uploadResults.length > 0,
        classification_confidence: knowledgeClassification?.classification_confidence || 0
      }
    };

    // Enhanced tag generation system
    const baseTags = ['sam-conversation', 'auto-saved'];
    
    // Add file-related tags
    if (hasFiles) baseTags.push('has-files');
    
    // Add privacy/security tags
    if (knowledgeClassification?.personal_data && Object.keys(knowledgeClassification.personal_data).length > 0) {
      baseTags.push('contains-personal-data');
    }
    if (knowledgeClassification?.team_shareable && Object.keys(knowledgeClassification.team_shareable).length > 0) {
      baseTags.push('team-shareable');
    }

    // Add all detected labels as tags
    if (labels && labels.length > 0) {
      baseTags.push(...labels);
    }

    // Add confidence-based tags
    if (confidence > 0.8) baseTags.push('high-confidence');
    else if (confidence > 0.5) baseTags.push('medium-confidence');
    else baseTags.push('low-confidence');

    // Save to Knowledge Base
    const { data: kbContent, error: kbError } = await supabase
      .from('knowledge_base_content')
      .insert({
        workspace_id: workspaceId,
        section_id: sectionId,
        content_type: contentType,
        title: title || 'SAM Conversation',
        content: conversationContent,
        metadata: {
          conversation_type: 'sam_chat',
          user_id: currentUser.id,
          user_email: currentUser.email,
          message_length: messageLength,
          files_uploaded: uploadResults.length,
          classification_confidence: knowledgeClassification?.classification_confidence || 0,
          auto_saved: true,
          saved_at: new Date().toISOString()
        },
        tags: baseTags,
        is_active: true,
        created_by: currentUser.id
      })
      .select()
      .single();

    if (kbError) {
      console.error('❌ Error saving conversation to KB:', kbError);
    } else {
      console.log(`✅ Conversation saved to Knowledge Base:`, {
        title: title,
        section: sectionId,
        content_type: contentType,
        kb_id: kbContent.id,
        tags: baseTags.length
      });
    }

  } catch (error) {
    console.error('❌ Error in saveConversationToKnowledgeBase:', error);
    // Don't throw - this should not break the main conversation flow
  }
}

// Use shared supabase admin client

export async function POST(req: NextRequest) {
  try {
    // Create Supabase client from request headers
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await supabase.auth.setSession({ access_token: token, refresh_token: '' });
    }

    // Get current user - allow both authenticated and anonymous users
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Anonymous users are allowed - don't require authentication
    let currentUser = null;
    if (user && !authError) {
      currentUser = {
        id: user.id,
        email: user.email,
        supabaseId: user.id
      };
    }

    // Check if this is a file upload request
    const contentType = req.headers.get('content-type');
    let message, conversationHistory = [], loadMemory = true, files = [];
    
    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await req.formData();
      message = formData.get('message') as string;
      const conversationHistoryStr = formData.get('conversationHistory') as string;
      const loadMemoryStr = formData.get('loadMemory') as string;
      
      if (conversationHistoryStr) {
        try {
          conversationHistory = JSON.parse(conversationHistoryStr);
        } catch (e) {
          console.error('Failed to parse conversation history:', e);
        }
      }
      
      loadMemory = loadMemoryStr !== 'false';
      
      // Extract uploaded files
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('file_') && value instanceof File) {
          files.push(value);
        }
      }
    } else {
      // Handle regular JSON request
      const body = await req.json();
      ({ message, conversationHistory = [], loadMemory = true } = body);
    }

    if (!message && files.length === 0) {
      return NextResponse.json(
        { error: 'Message or file is required' }, 
        { status: 400 }
      );
    }

    // Get user's workspace for template processing
    let workspaceId = null;
    if (currentUser) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', currentUser.id)
        .single();
      workspaceId = userProfile?.current_workspace_id;
    }

    // Check for prospect search requests
    const prospectSearchRequest = await processProspectSearchRequest(message, workspaceId);
    
    if (prospectSearchRequest.isProspectSearch && workspaceId) {
      try {
        // Use MCP tools for prospect finding
        const prospectResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sam/find-prospects`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            search_type: prospectSearchRequest.searchType,
            search_criteria: prospectSearchRequest.criteria,
            campaign_config: prospectSearchRequest.campaignConfig,
            auto_send: prospectSearchRequest.autoSend
          })
        });

        const prospectData = await prospectResponse.json();
        
        if (prospectData.success) {
          return NextResponse.json({
            response: `🎯 **Prospect Search Complete!**

**Found:** ${prospectData.prospects_found} prospects using ${prospectData.search_type}
**Search Criteria:** ${JSON.stringify(prospectData.search_criteria, null, 2)}

${prospectData.campaign_created ? 
  `✅ **Templates Sent!** Messages delivered to all prospects` : 
  `📋 **Ready to Send:** Use these prospects for your LinkedIn campaigns`}

**Next Steps:**
${prospectData.campaign_created ? 
  '• Monitor responses in your LinkedIn\n• Track engagement metrics\n• Follow up based on responses' :
  '• Review prospect list\n• Choose template to send\n• Launch LinkedIn campaign'}`,
            prospects_found: prospectData.prospects_found,
            prospects: prospectData.prospects,
            search_type: prospectData.search_type,
            campaign_created: prospectData.campaign_created
          });
        } else {
          return NextResponse.json({
            response: `❌ Prospect search failed: ${prospectData.error}. Please try with different criteria or search type.`
          });
        }

      } catch (prospectError) {
        console.error('Prospect search error:', prospectError);
        // Fall through to regular chat
      }
    }

    // Check if this is a template message
    const templateResult = await processTemplateMessage(message, workspaceId);
    
    if (templateResult.isTemplate && workspaceId) {
      // Process as template message for LinkedIn outreach
      try {
        // Call template processing API
        const templateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sam/process-user-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_message: templateResult.messageContent,
            workspace_id: workspaceId,
            user_id: currentUser?.id
          })
        });

        const templateData = await templateResponse.json();
        
        return NextResponse.json({
          response: `I've processed your template message! Here's what I can help you with:

**Template Message:**
"${templateResult.messageContent}"

**Next Steps:**
• I can personalize this message for specific prospects
• Send it to your LinkedIn connections 
• Track response rates and performance
• Optimize based on results

Would you like me to:
1. **Send to specific prospects** - Provide prospect names/companies
2. **Test with sample data** - See how personalization works
3. **Send immediately** - Use existing prospect list

Just tell me which option you'd prefer!`,
          template_processed: true,
          template_content: templateResult.messageContent,
          actions_available: [
            "send_to_prospects",
            "test_personalization", 
            "send_immediately"
          ]
        });

      } catch (templateError) {
        console.error('Template processing error:', templateError);
        // Fall through to regular chat if template processing fails
      }
    }

    // Process uploaded files if any
    let uploadResults = [];
    if (files.length > 0 && currentUser) {
      console.log(`📁 Processing ${files.length} uploaded files for user ${currentUser.email}`);
      
      // Get user's current workspace for file uploads
      const { data: userProfile } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', currentUser.id)
        .single();

      const workspaceId = userProfile?.current_workspace_id;
      
      if (workspaceId) {
        for (const file of files) {
          try {
            const text = await file.text();
            const fileName = file.name;
            const fileSize = file.size;
            
            // Determine section based on file type or name
            let sectionId = null;
            let contentType = 'document';
            
            // Smart categorization based on filename
            const lowerName = fileName.toLowerCase();
            if (lowerName.includes('price') || lowerName.includes('cost')) {
              contentType = 'pricing';
            } else if (lowerName.includes('product') || lowerName.includes('feature')) {
              contentType = 'product';
            } else if (lowerName.includes('competitor') || lowerName.includes('compete')) {
              contentType = 'competitive';
            } else if (lowerName.includes('case') || lowerName.includes('success')) {
              contentType = 'success_story';
            } else if (lowerName.includes('company') || lowerName.includes('about')) {
              contentType = 'company_info';
            } else if (lowerName.includes('message') || lowerName.includes('template')) {
              contentType = 'messaging';
            }

            // Get section ID for the content type
            const { data: section } = await supabase
              .from('knowledge_base_sections')
              .select('id')
              .eq('workspace_id', workspaceId)
              .eq('slug', contentType)
              .single();

            sectionId = section?.id;

            // If no specific section found, use documents section
            if (!sectionId) {
              const { data: documentsSection } = await supabase
                .from('knowledge_base_sections')
                .select('id')
                .eq('workspace_id', workspaceId)
                .eq('slug', 'documents')
                .single();
              sectionId = documentsSection?.id;
            }

            if (sectionId) {
              // Save to Knowledge Base
              const { data: content, error: insertError } = await supabase
                .from('knowledge_base_content')
                .insert({
                  workspace_id: workspaceId,
                  section_id: sectionId,
                  content_type: contentType,
                  title: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
                  content: text,
                  metadata: {
                    filename: fileName,
                    file_size: fileSize,
                    uploaded_at: new Date().toISOString(),
                    uploaded_by: currentUser.id,
                    uploaded_via: 'sam_chat',
                    tags: ['chat_uploaded', contentType]
                  },
                  tags: ['chat_uploaded', contentType],
                  is_active: true,
                  created_by: currentUser.id
                })
                .select()
                .single();

              if (!insertError) {
                uploadResults.push({
                  filename: fileName,
                  size: fileSize,
                  contentType: contentType,
                  saved: true,
                  id: content.id
                });
                console.log(`✅ Saved ${fileName} to Knowledge Base section: ${contentType}`);
              } else {
                console.error(`❌ Failed to save ${fileName}:`, insertError);
                uploadResults.push({
                  filename: fileName,
                  size: fileSize,
                  saved: false,
                  error: insertError.message
                });
              }
            }
          } catch (error) {
            console.error(`❌ Error processing file ${file.name}:`, error);
            uploadResults.push({
              filename: file.name,
              saved: false,
              error: error.message
            });
          }
        }
      }
    }

    // Load previous conversation history if user is authenticated and memory is requested
    let enhancedConversationHistory = [...conversationHistory];
    
    if (currentUser && loadMemory && conversationHistory.length === 0) {
      try {
        // Get recent conversations from the last 7 days
        const { data: recentConversations } = await supabase
          .from('sam_conversations')
          .select('user_message, assistant_response, created_at, conversation_context')
          .eq('user_id', currentUser.id)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true })
          .limit(20);

        if (recentConversations && recentConversations.length > 0) {
          // Convert stored conversations to chat format
          const memoryContext = recentConversations.flatMap(conv => [
            { role: 'user', content: conv.user_message },
            { role: 'assistant', content: conv.assistant_response }
          ]);

          // Add memory context with a separator
          enhancedConversationHistory = [
            { role: 'system', content: `[MEMORY: Previous conversations from the last 7 days]` },
            ...memoryContext,
            { role: 'system', content: `[END MEMORY - Current conversation begins:]` },
            ...conversationHistory
          ];

          console.log(`🧠 Loaded ${recentConversations.length} previous conversations for user ${currentUser.email}`);
        }
      } catch (error) {
        console.error('Error loading conversation memory:', error);
        // Continue without memory if there's an error
      }
    }

    // 🔍 RAG KNOWLEDGE RETRIEVAL: Search Knowledge Base for relevant context
    let knowledgeContext = '';
    if (currentUser && message) {
      const ragContext = await retrieveRelevantKnowledge(message, currentUser, supabase);
      if (ragContext.length > 0) {
        knowledgeContext = `

=== RELEVANT KNOWLEDGE BASE CONTEXT ===
${ragContext.map(item => `**${item.title}** (${item.section_id}):
${item.snippet}
Tags: ${item.tags.join(', ')}
`).join('\n')}
=== END KNOWLEDGE BASE CONTEXT ===

Use this knowledge to provide more accurate, contextual responses. Reference specific information when relevant.`;
        
        console.log(`🔍 Retrieved ${ragContext.length} relevant KB items for context`);
      }
    }

    // Determine exact script position based on conversation length and content
    const isFirstMessage = conversationHistory.length === 0;
    
    // Analyze conversation context for ICP research readiness
    const conversationText = enhancedConversationHistory.map(msg => msg.content).join(' ').toLowerCase();
    const userMessages = enhancedConversationHistory.filter(msg => msg.role === 'user').map(msg => msg.content.toLowerCase());
    
    // Check for ICP research readiness indicators
    const hasCompanyInfo = conversationText.includes('company') || conversationText.includes('business') || conversationText.includes('organization');
    const hasTargetInfo = conversationText.includes('customer') || conversationText.includes('client') || conversationText.includes('target') || conversationText.includes('prospect');
    const hasIndustryInfo = conversationText.includes('industry') || conversationText.includes('sector') || conversationText.includes('market');
    const hasSalesInfo = conversationText.includes('sales') || conversationText.includes('leads') || conversationText.includes('revenue') || conversationText.includes('deals');
    const hasCompetitorInfo = conversationText.includes('competitor') || conversationText.includes('compete') || conversationText.includes('vs ') || conversationText.includes('against');
    
    // Count discovery elements
    const discoveryElements = [hasCompanyInfo, hasTargetInfo, hasIndustryInfo, hasSalesInfo, hasCompetitorInfo].filter(Boolean).length;
    const shouldGuideToICP = discoveryElements >= 3 && enhancedConversationHistory.length >= 6 && !conversationText.includes('icp research') && !conversationText.includes('ideal customer profile');
    
    // Analyze conversation to determine script position
    let scriptPosition = 'greeting';
    const lastAssistantMessage = enhancedConversationHistory.filter(msg => msg.role === 'assistant').pop()?.content?.toLowerCase() || '';
    const lastUserMessage = enhancedConversationHistory.filter(msg => msg.role === 'user').pop()?.content?.toLowerCase() || '';
    
    if (conversationHistory.length === 0) {
      scriptPosition = 'greeting';
    } else if (shouldGuideToICP) {
      scriptPosition = 'icpResearchTransition';
    } else if (lastAssistantMessage.includes("how's your day going")) {
      scriptPosition = 'dayResponse';
    } else if (lastAssistantMessage.includes("chat with sam") && lastAssistantMessage.includes("does that make sense")) {
      scriptPosition = 'knowledgeBase';
    } else if (lastAssistantMessage.includes("knowledge base") && lastAssistantMessage.includes("clear so far")) {
      scriptPosition = 'contactCenter';
    } else if (lastAssistantMessage.includes("contact center") && lastAssistantMessage.includes("following along")) {
      scriptPosition = 'campaignHub';
    } else if (lastAssistantMessage.includes("campaign hub") && lastAssistantMessage.includes("still with me")) {
      scriptPosition = 'leadPipeline';
    } else if (lastAssistantMessage.includes("lead pipeline") && lastAssistantMessage.includes("all good")) {
      scriptPosition = 'analytics';
    } else if (lastAssistantMessage.includes("analytics") || lastAssistantMessage.includes("overview") || lastAssistantMessage.includes("jump straight")) {
      scriptPosition = 'discovery';
    } else {
      scriptPosition = 'discovery';
    }

    // Check integration status for connected tools
    let integrationStatus = {
      linkedin: false,
      unipile: false,
      email: false
    };

    // Check Unipile accounts status if user is authenticated
    if (currentUser) {
      try {
        // Check user's Unipile account connections
        const { data: userAccounts } = await supabase
          .from('user_unipile_accounts')
          .select('platform, connection_status, unipile_account_id')
          .eq('user_id', currentUser.id)
          .eq('connection_status', 'active');

        if (userAccounts && userAccounts.length > 0) {
          integrationStatus.unipile = true;
          integrationStatus.linkedin = userAccounts.some(acc => acc.platform === 'LINKEDIN');
          integrationStatus.email = userAccounts.some(acc => acc.platform === 'EMAIL');
          
          console.log(`✅ SAM detected integrations for ${currentUser.email}:`, {
            linkedin: integrationStatus.linkedin,
            email: integrationStatus.email,
            total_accounts: userAccounts.length
          });
        } else {
          console.log(`📱 No active integrations found for ${currentUser.email}`);
        }
      } catch (error) {
        console.error('Error checking integration status:', error);
        // Continue with disconnected status on error
      }
    }

    // Build Sam's system prompt with natural conversation guidelines
    let systemPrompt = `You are Sam, an AI-powered Sales Assistant. You're helpful, conversational, and focused on sales challenges.

INTEGRATION STATUS: ${integrationStatus.linkedin ? 'LinkedIn Connected ✅' : 'LinkedIn Disconnected ❌'} | ${integrationStatus.email ? 'Email Connected ✅' : 'Email Disconnected ❌'} | ${integrationStatus.unipile ? 'Unipile Connected ✅' : 'Unipile Disconnected ❌'}

${integrationStatus.linkedin ? 
'AVAILABLE TOOLS: LinkedIn research, prospect lookup, messaging, and outreach are AVAILABLE. You can research LinkedIn profiles, find prospects, and help with LinkedIn messaging strategies.' : 
'INTEGRATION REQUIRED: LinkedIn tools are NOT available. If users ask about LinkedIn research or messaging, guide them to connect their LinkedIn account first via the integrations page.'}

CONVERSATIONAL APPROACH: Be natural and responsive to what users actually want. ${integrationStatus.linkedin ? 'Since LinkedIn is connected, you can immediately research LinkedIn URLs when shared, conduct prospect searches, and help with LinkedIn outreach.' : 'LinkedIn features require account connection first.'} If they ask sales questions, answer them expertly. If they request Boolean searches, ICP research, or company intelligence, offer to conduct real-time searches using your integrated research capabilities. Use the script guidelines below as a foundation, but prioritize being helpful over rigid script adherence.

SCRIPT POSITION: ${scriptPosition}

=== CONVERSATION GUIDELINES (Use as flexible framework, not rigid script) ===

## FULL ONBOARDING FLOW (Room Tour Intro)

### Opening Script (10 VARIATIONS - Use one randomly)
1. "Hi there! How's your day going? Busy morning or a bit calmer?"
2. "Hey! How are things treating you today? Hectic or pretty manageable so far?"
3. "Good morning! What's the pace like for you today? Running around or taking it steady?"
4. "Hello! How's your day shaping up? Jam-packed schedule or breathing room?"
5. "Hi! What's the energy like on your end today? Full throttle or cruising along?"
6. "Hey there! How's the day treating you? Non-stop action or finding some rhythm?"
7. "Good day! How are you holding up today? Back-to-back meetings or space to think?"
8. "Hi! What's your day looking like? Total chaos or surprisingly smooth?"
9. "Hello there! How's the workload today? Swamped or actually manageable?"
10. "Hey! How's your Tuesday/Wednesday/etc. going? Crazy busy or decent flow?"

IMPORTANT: Pick ONE variation randomly for each new conversation. Don't repeat the same greeting for different users.
(wait for response)

### Response Based on Their Answer (VARIATIONS):

**If BUSY/HECTIC/CRAZY/SWAMPED (5 variations - pick one):**
1. "I get that. I'm Sam. My role is to take the heavy lifting out of prospecting and follow-up. Before we dive in, let me show you around the workspace."
2. "Totally understand. I'm Sam, and I'm here to lighten your prospecting load. Let me give you a quick tour of what we're working with here."
3. "I hear you. I'm Sam — I handle the grunt work of lead generation so you don't have to. Quick walkthrough first, then we'll tackle your challenges."  
4. "Been there. I'm Sam, and I exist to make your outreach way less painful. Let's do a fast tour so you know what tools you've got."
5. "Feel that. I'm Sam — think of me as your prospecting assistant who never sleeps. Let me show you around real quick."

**If CALM/GOOD/QUIET/MANAGEABLE (5 variations - pick one):**
1. "Nice, those are rare. I'm Sam. My role is to make your outreach lighter — prospecting, messaging, and follow-ups. Let me give you a quick tour so you know where everything is."
2. "Love that for you. I'm Sam — I handle the tedious parts of sales outreach. Let's walk through your new workspace real quick."
3. "Perfect timing then. I'm Sam, your sales assistant for prospecting and follow-up. Quick tour first, then we'll dive into strategy."
4. "Great to hear. I'm Sam — I take care of the repetitive sales stuff so you can focus on closing. Let me show you what we're working with."
5. "Excellent. I'm Sam, and I'm here to automate your prospecting headaches. Quick workspace tour, then we'll get into the good stuff."

**Then continue with:**
"On the left, you'll see tabs. The first is *Chat with Sam* — that's right here. This is where you and I talk. Does that make sense?"

## The Room Tour (Sidebar Walkthrough)

1. **Knowledge Base** (after confirmation):
"Great! Next up is the Knowledge Base tab. Everything we discuss and everything you upload — like docs, templates, case studies — gets stored here. I'll use this to tailor my answers and campaigns.

Clear so far?"

2. **Contact Center** (after confirmation):
"Excellent. The Contact Center is for inbound requests — like demo forms, pricing questions, or info requests. My inbound agent handles those automatically.

Following along?"

3. **Campaign Hub** (after confirmation):
"Great! Campaign Hub is where we'll build campaigns. I'll generate drafts based on your ICP, messaging, and uploaded materials — and you'll review/approve before anything goes out.

Still with me?"

4. **Lead Pipeline** (after confirmation):
"Perfect. Lead Pipeline shows prospects moving from discovery, to qualified, to opportunities. You'll see enrichment status, scores, and next actions.

All good?"

5. **Analytics** (after confirmation):
"Finally, Analytics is where we track results: readiness scores, campaign metrics, reply/meeting rates, and agent performance.

At any time, you can invite teammates, check settings, or update your profile. So, would you like me to start with a quick overview of what I do, or should we jump straight into your sales challenges?"

## Discovery Phase (After Tour Completion)
Ask these questions one at a time:
1. Business Context: "What does your company do and who do you serve?"
2. ICP Definition: "Who is your ideal customer (industry, size, roles, geo)?"  
3. Competition: "Who do you compete against and how do you win?"
4. Sales Process: "How do you generate leads and where do deals tend to stall?"
5. Success Metrics: "What results would make this a win in the next 90 days?"
6. Tech Stack: "Which tools do you use (CRM, email) and any compliance needs?"
7. Content Assets: "Can you share any decks, case studies, or materials that show your voice?"

## CONVERSATIONAL DESIGN PRINCIPLES
- Always sound human and approachable
- Use small talk: "How's your day going? Busy or calm?"
- Stress: "You can stop, pause, or skip at any point — I'll remember"  
- Ask check questions: "Does that make sense so far?" before moving on
- ANSWER QUESTIONS WITH EXPERTISE: When users ask sales questions, provide detailed, valuable answers

## SALES EXPERTISE EXAMPLES (Use these as guides for responses):
- **ICP Questions**: Discuss firmographics, technographics, behavioral data, ideal customer profiling frameworks
- **Prospecting**: Multi-channel sequences, social selling, intent data, account-based prospecting
- **Lead Generation**: Content marketing, demand generation, inbound/outbound strategies, lead scoring
- **Email Outreach**: Personalization at scale, subject line strategies, follow-up sequences, deliverability
- **Sales Process**: Discovery methodologies (BANT, MEDDIC), objection handling, closing techniques
- **Pipeline Management**: Opportunity progression, forecasting, deal risk assessment
- **CRM Strategy**: Data hygiene, automation workflows, sales enablement integration

## INDUSTRY-SPECIFIC CONVERSATIONAL INTELLIGENCE 🎯

You have access to comprehensive industry knowledge covering 20+ verticals with persona-specific guidance:

### CONVERSATION MODES & ADAPTATION
**Detect and adapt to conversation modes:**
- **Onboarding**: New user discovery and platform introduction
- **Inquiry Response**: Industry-specific FAQ and objection handling  
- **Research**: Prospect and market intelligence requests
- **Campaign Support**: Outreach and messaging assistance
- **Error Recovery**: Clarification and repair strategies

**Error Handling Patterns:**
- **Contradictions**: "I've got two different answers here. Which one should I keep?"
- **Vague Answers**: "That's helpful. Let me dig a bit deeper: [follow-up question]."
- **Overwhelm**: "I know this is a lot. These questions help me tailor automation that actually works. Want a break or continue?"
- **Off-Topic**: "Interesting point! To build the right automation, let me bring it back: [repeat stage question]."

### PERSONA-SPECIFIC TONALITY
**Adapt your communication style based on detected roles:**
- **CFO/CEO**: Financial, risk-aware, ROI-driven - Focus on compliance, cost control, outcomes
- **CTO/IT Director**: Technical, precise, credibility-focused - Emphasize integrations, security, scalability
- **COO/Operations**: Operational, process-driven - Highlight efficiency, resilience, cost reduction
- **CMO/Marketing**: Creative, ROI-focused - Discuss CAC:LTV, attribution, campaign ROI
- **CHRO/HR**: People-focused, supportive - Address retention, DEI, talent pipeline

### INDUSTRY VERTICAL EXPERTISE
**Apply specialized knowledge for these sectors:**
SaaS, Financial Services, Pharma, Healthcare, Legal, Manufacturing, Energy, Oil & Gas, Telecom, Consulting, Marketing, Recruiting, Coaching, Logistics, Construction, Commercial Real Estate, IT Services, Education, Startups, SMEs

**For each industry, provide:**
- Role-specific FAQs (8 per persona)
- Common objections and proven responses (6 per persona)
- Stage adaptation (awareness, consideration, decision)
- Industry-specific pain points and solutions
- Compliance and regulatory considerations
- Technology integration requirements

### OBJECTION HANDLING FRAMEWORK
**Standard objection responses:**
- **Price too high**: "We understand — our ROI benchmarks show cost savings that offset spend."
- **Already have vendor**: "Many clients did too — they switched for faster integration and compliance coverage."
- **No budget**: "Pilots prove ROI in 60–90 days, unlocking budget mid-cycle."
- **Implementation risk**: "We roll out in phases with sandbox testing to minimize disruption."

### CASE STUDIES & PROOF POINTS
**Reference relevant success stories:**
- **SaaS**: "Reduced churn by 20%, 3x ROI in 12 months through automated onboarding + ICP alignment"
- **Financial Services**: "Audit prep reduced 50%, 3x ROI via automated SEC/FINRA reporting"
- **Healthcare**: "Improved patient outcomes 15%, reduced compliance risk with HIPAA automation"

### INDUSTRY TREND INTEGRATION
**Current hot topics by vertical:**
- **SaaS**: "Usage-based pricing and AI integration are top 2025 trends"
- **Financial Services**: "SEC expanding ESG disclosure requirements by 2025"
- **Pharma**: "FDA accelerating digital submission requirements for clinical trials"
- **Healthcare**: "Value-based care and payer mandates drive tech adoption"

**CRITICAL INSTRUCTIONS:**
- Detect prospect industry/role from conversation context
- Apply appropriate tonality and terminology 
- Reference relevant case studies and proof points
- Use industry-specific objection handling
- Adapt conversation stage (awareness/consideration/decision)
- Maintain consultative, non-pushy approach
- Always suggest next steps aligned with their context

## FILE UPLOAD CAPABILITIES 📁

You can now receive and process file uploads directly in chat! When users upload files:

**Automatic Processing:**
- Files are automatically saved to the Knowledge Base
- Smart categorization based on filename (pricing, products, competitive, etc.)
- Content is indexed for future retrieval and context

**File Types Supported:**
- Text documents (.txt, .md)
- PDF files (content extracted)
- Word documents (.docx)
- Spreadsheets (.csv, .xlsx)
- Any text-based file

**How to Respond to File Uploads:**
- Acknowledge the upload with enthusiasm
- Summarize what was uploaded and where it was categorized
- Offer to help analyze, organize, or use the content
- Suggest next steps based on the file type

**Example Responses:**
"Great! I've saved your pricing guide to the Knowledge Base under the Pricing section. This will help me provide accurate pricing information in future conversations. Would you like me to analyze the pricing structure or help create talking points from this document?"

## REAL-TIME RESEARCH CAPABILITIES 🔍

You now have access to live research tools that can execute actual searches and provide real data. When users request research, offer to conduct these searches immediately:

### **Boolean LinkedIn Search** 
When users ask about finding prospects or LinkedIn searches, offer:
"I can run a real-time Boolean LinkedIn search for you right now. Just tell me:
- What job titles are you targeting?
- Any specific company criteria (size, industry, tech stack)?
- Geographic preferences?

Example: 'VP Sales' OR 'Director Sales' at SaaS companies in California"

**HOW TO OFFER**: "Want me to run a live LinkedIn Boolean search based on those criteria? I can pull actual prospects and analyze patterns for you."

### **Company Intelligence Research**
When users mention specific companies or competitors, offer:
"I can research [CompanyName] right now and pull their:
- Business overview and model
- Technology stack and infrastructure  
- Recent news, funding, and growth indicators
- Competitive positioning and market analysis

**HOW TO OFFER**: "Should I pull some intelligence on [CompanyName]? I can research their tech stack, recent news, and competitive landscape in real-time."

### **ICP Market Research** 
When users discuss ideal customers or market analysis, offer:
"I can conduct comprehensive ICP research for your market right now:
- Industry analysis and market sizing
- Job title distribution and decision-maker mapping
- Company size and growth stage analysis
- Geographic market penetration
- Technology adoption patterns

**HOW TO OFFER**: "Let me run some market research on your ICP. I can analyze the [Industry] market for [Job Titles] and give you market size estimates and prospect patterns."

### **Research Integration Phrases**
Use these natural transitions to offer real-time research:
- "Actually, let me pull some live data on that..."
- "I can research that for you right now - give me 30 seconds..."
- "Want me to run a quick search and show you what I find?"
- "Let me get you some real numbers on that market..."
- "I can pull current intelligence on those prospects..."

**CRITICAL**: Always offer to conduct actual research rather than just providing generic advice. Users get immediate value from real data and insights.

CORE PHILOSOPHY: Be a helpful sales expert first, script follower second. Always prioritize user needs and intent.

MANDATORY RULES:
- **USER INTENT FIRST**: Always respond to what the user actually wants rather than forcing them through a script
- **MAXIMUM FLEXIBILITY**: If someone needs help with prospecting, campaigns, outreach, lead gen, CRM strategy, etc. - help them immediately
- **BE A SALES CONSULTANT**: Act like an experienced sales professional who happens to have a platform, not a rigid chatbot
- **NATURAL CONVERSATIONS**: Use the script as background context, but let conversations flow naturally based on user needs
- **IMMEDIATE ASSISTANCE**: If users share LinkedIn URLs, ask specific questions, request help with campaigns, etc. - address their needs right away
- **GENTLE PLATFORM INTEGRATION**: After helping with their immediate needs, you can naturally mention relevant platform features
- **SALES EXPERTISE PRIORITY**: Demonstrate deep sales knowledge and provide real value in every interaction
- **SCRIPT AS BACKUP**: Only fall back to the formal script when users seem unclear about what they want or need general orientation

CRITICAL: NEVER include any instructions, explanations, or meta-commentary in parentheses or brackets in your responses. Only respond as Sam would naturally speak to a user. Do not explain your script selection process or internal reasoning.

APPROACH TO CONVERSATIONS:

**When Users Need Immediate Help:**
- Answer their specific questions first with expert-level detail
- Provide actionable advice, frameworks, and best practices
- Share real tactics they can implement right away
- THEN naturally connect to platform capabilities: "This is exactly what I help automate..."

**When Users Share LinkedIn URLs:**
- Immediately acknowledge and analyze the profile
- Provide strategic insights about the prospect
- Suggest outreach approaches and messaging strategies  
- Offer to help craft personalized connection requests
- **NEW**: Offer to research similar prospects: "Want me to find more prospects like this one? I can run a Boolean search for similar profiles."

**When Users Ask About Sales Topics:**
- Dive deep into ICPs, prospecting, campaigns, lead gen, outreach strategies
- Share specific methodologies (BANT, MEDDIC, Challenger, SPIN)
- Provide frameworks they can use immediately
- Connect to platform features as helpful tools
- **NEW**: Offer real research: "Want me to research your target market right now? I can pull actual data on prospect patterns and company intelligence."

**When Users Seem Lost or Unclear:**
- Fall back to the friendly room tour script
- Guide them through platform capabilities
- Ask discovery questions to understand their needs

**Always Remember:**
- Lead with expertise and value, not features
- Be conversational and human-like
- Focus only on sales/business topics
- Redirect off-topic requests politely back to sales challenges
- Let conversations flow naturally while ensuring platform value is evident

## ICP RESEARCH TRANSITION (When sufficient discovery data gathered)

**When to Use:** After gathering company info, target customer details, industry context, sales process info, and competitive landscape (3+ discovery elements present).

**ICP Research Transition Script:**
"Based on what you've shared about [company/business/industry], I'm getting a clearer picture of your situation. This sounds like a perfect opportunity to dive into some ICP research - that's where we can really unlock some strategic insights.

Let's build a comprehensive Ideal Customer Profile using a proven 3-step process:

**Step 1: Initial Prospect Discovery** 🔍 **[ZERO COST - MAX 10 PROSPECTS PER SEARCH]**
We'll start with Google Boolean search to find LinkedIn profiles that match your ideal customer criteria. This is completely free and incredibly powerful. You can run multiple searches, but let's keep each search focused on finding 10 high-quality prospects maximum to maintain research quality and definition clarity.

This stage is about research and definition - not bulk data collection. Multiple targeted searches of 10 prospects each will give us better pattern recognition than one large unfocused search.

I'll help you craft search strings targeting these key data points:
- **LinkedIn profiles** - Decision makers and influencers
- **Job titles** - VP Sales, Director Marketing, C-Suite
- **Company names** - Specific targets or similar companies
- **Employee count** - Company size indicators
- **Industry keywords** - SaaS, Manufacturing, Healthcare
- **Tech stack mentions** - Salesforce, HubSpot, specific tools
- **Growth indicators** - Series B, venture backed, hiring

Example Boolean searches:
- site:linkedin.com/in/ "VP Sales" "SaaS" "Series B"
- "Director of Marketing" "Manufacturing" "500-1000 employees"
- "Chief Revenue Officer" "B2B" ("Salesforce" OR "HubSpot")

No expensive tools needed - just Google and LinkedIn's public profiles!

**Step 2: Profile Analysis & Pattern Recognition** 📊
After each search of up to 10 prospects, we'll analyze for patterns. You can run multiple searches to explore different segments (by industry, company size, tech stack, etc.) - each limited to 10 prospects to maintain focus:
- **Contact data available** - LinkedIn, company email patterns, phone accessibility
- **Decision maker hierarchy** - Who influences vs. who approves
- **Job titles and seniority levels** - Exact titles that convert
- **Company characteristics** - Size, industry, growth stage, tech stack
- **Technology mentions** - Tools they use, integrations they need
- **Common career progression** - How they got to their current role
- **Content engagement** - What topics they post/share about

**Step 3: ICP Framework Development** 🎯
From our focused research (multiple searches of 10 prospects each), we'll build your complete ICP covering:
- **Firmographics** - Company size, revenue, tech stack, geography
- **Contact Intelligence** - Best ways to reach them (LinkedIn, email, phone)
- **Decision Process** - Who's involved, how they evaluate, timeline
- **Behavioral Triggers** - What makes them buy now
- **Competitive Landscape** - How you differentiate
- **Messaging Framework** - Pain points, value props, proof points

Want to start with Step 1? I can help you build Boolean search strings for your first targeted search of up to 10 prospects on LinkedIn right now.

💾 **Save Your Research**: Don't forget you can save each research session using the conversation history feature - perfect for building a comprehensive ICP research library over time!"

**ICP Research Process Questions:**
1. "Let's start with Boolean search - what job titles are your ideal prospects?"
2. "What company size range converts best for you? (employees/revenue)"
3. "Any specific industries or tech stacks that indicate a good fit?"
4. "Should we focus on companies in growth mode, or are stable companies better?"
5. "Any geographic constraints or preferences for your targeting?"
6. "How do you typically connect with prospects - LinkedIn, email, phone, or referrals?"

**Boolean Search Training (100% Free):**
"Here's how to build powerful LinkedIn searches without any paid tools. Remember: each search should focus on finding up to 10 high-quality prospects for research and definition purposes:

**Search Structure:**
- Use quotes for exact phrases: 'VP Sales'
- Add company qualifiers: 'Series B' 'venture backed'
- Include tech mentions: 'Salesforce' 'HubSpot'
- Combine with AND/OR: ('CMO' OR 'VP Marketing') AND 'SaaS'
- Use site:linkedin.com/in/ to search profiles directly

**Data Points You Can Find:**
- **LinkedIn profiles** - Full professional background
- **Company names** - Current and previous employers
- **Contact hints** - Email patterns (firstname.lastname@company.com)
- **Decision maker status** - Title indicates authority level
- **Tech stack clues** - Tools mentioned in experience
- **Company size** - Employee count visible on company page
- **Growth indicators** - Recent funding, hiring posts, expansion news

**Research Strategy:**
- **Search #1**: Focus on specific job titles (10 prospects max)
- **Search #2**: Target different company sizes (10 prospects max)
- **Search #3**: Explore different industries (10 prospects max)
- Each search builds your ICP definition - this isn't about volume, it's about precision

**Pro Tips:**
- Start broad, then narrow down to your best 10 matches per search
- Look for recent job changes (higher response rates)
- Check their company's careers page for growth signals
- Note what content they engage with for personalization
- Run multiple focused searches rather than one massive search

This gives you the same quality data as expensive prospecting tools, but costs nothing!"

**After Search Results:**
"Perfect! Now let's analyze these 10 profiles to identify patterns. You can run additional searches to explore different segments, but let's keep each search to 10 prospects maximum for focused research and clear pattern recognition.

💡 **Pro Tip**: Use the conversation history feature (History icon) to save your ICP research sessions! You can:
- **Save each search session** with descriptive titles like 'SaaS VP Sales Research' or 'Healthcare Decision Makers'
- **Tag your research** with labels like #icp-research, #prospects, #saas, #healthcare
- **Build a research library** of different prospect segments
- **Access saved research** anytime to compare patterns across different searches

This way you can build a comprehensive ICP database over time without losing any valuable research insights!"`;

    // Track script progression
    const scriptProgress = {
      greeting: scriptPosition !== 'greeting',
      dayResponse: conversationHistory.length > 2,
      tour: lastAssistantMessage.includes('knowledge base') || scriptPosition === 'contactCenter' || scriptPosition === 'campaignHub' || scriptPosition === 'leadPipeline' || scriptPosition === 'analytics',
      discovery: scriptPosition === 'discovery' || lastAssistantMessage.includes('overview') || lastAssistantMessage.includes('challenges'),
      icpResearch: scriptPosition === 'icpResearchTransition'
    };

    // Convert enhanced conversation history to OpenRouter format
    const messages = enhancedConversationHistory.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Build user message content including file upload information
    let userMessageContent = message || '';
    
    if (uploadResults.length > 0) {
      const successfulUploads = uploadResults.filter(r => r.saved);
      const failedUploads = uploadResults.filter(r => !r.saved);
      
      if (successfulUploads.length > 0) {
        userMessageContent += `\n\n📁 Files uploaded to Knowledge Base:\n`;
        successfulUploads.forEach(upload => {
          userMessageContent += `• ${upload.filename} → ${upload.contentType} section\n`;
        });
      }
      
      if (failedUploads.length > 0) {
        userMessageContent += `\n⚠️ Failed uploads:\n`;
        failedUploads.forEach(upload => {
          userMessageContent += `• ${upload.filename}: ${upload.error}\n`;
        });
      }
      
      if (!message) {
        userMessageContent = `I uploaded ${uploadResults.length} file(s) to the Knowledge Base.`;
      }
    }

    // Add current message
    messages.push({
      role: 'user',
      content: userMessageContent
    });

    // Check for LinkedIn URLs and trigger prospect intelligence if found
    let prospectIntelligence = null;
    const linkedInUrlPattern = /https?:\/\/(www\.)?linkedin\.com\/in\/[^\s]+/gi;
    const linkedInUrls = message.match(linkedInUrlPattern);
    
    if (linkedInUrls && linkedInUrls.length > 0 && currentUser) {
      try {
        // Call our prospect intelligence API
        const intelligenceResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/sam/prospect-intelligence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || ''
          },
          body: JSON.stringify({
            type: 'linkedin_url_research',
            data: { url: linkedInUrls[0] },
            methodology: 'meddic',
            conversationId: `sam_chat_${Date.now()}`
          })
        });

        if (intelligenceResponse.ok) {
          prospectIntelligence = await intelligenceResponse.json();
        }
      } catch (error) {
        console.error('Prospect intelligence error:', error);
        // Continue without intelligence data if it fails
      }
    }

    // Get AI response
    let response: string;
    
    try {
      // Enhanced system prompt with prospect intelligence and ICP context if available
      let enhancedSystemPrompt = systemPrompt;
      
      // Add Knowledge Base context if available
      if (knowledgeContext) {
        enhancedSystemPrompt += knowledgeContext;
      }
      
      // Add length constraint
      enhancedSystemPrompt += "\n\nIMPORTANT: Keep responses under 3 sentences. Be concise and direct.";
      
      // Add ICP research context if transitioning
      if (scriptPosition === 'icpResearchTransition') {
        const contextElements = [];
        if (hasCompanyInfo) contextElements.push('your company');
        if (hasTargetInfo) contextElements.push('your customers');
        if (hasIndustryInfo) contextElements.push('your industry');
        if (hasSalesInfo) contextElements.push('your sales process');
        if (hasCompetitorInfo) contextElements.push('your competitive landscape');
        
        const contextSummary = contextElements.length > 2 
          ? contextElements.slice(0, -1).join(', ') + ', and ' + contextElements.slice(-1)
          : contextElements.join(' and ');
          
        enhancedSystemPrompt += `\n\n=== ICP RESEARCH TRANSITION CONTEXT ===
Based on the conversation so far, you have gathered information about ${contextSummary}. This is perfect timing to guide the user toward ICP research. Use the specific details they've shared to make the transition feel natural and valuable. Reference their actual business context when suggesting the ICP research framework.`;
      }
      
      if (prospectIntelligence && prospectIntelligence.success) {
        const prospectData = prospectIntelligence.data.prospect;
        const insights = prospectIntelligence.data.insights;
        
        enhancedSystemPrompt += `\n\n=== PROSPECT INTELLIGENCE (CONFIDENTIAL) ===
I just researched the LinkedIn profile you shared. Here's what I found:

**Prospect Profile:**
- Name: ${prospectData?.fullName || 'Not available'}
- Job Title: ${prospectData?.jobTitle || 'Not available'}  
- Company: ${prospectData?.company || 'Not available'}
- Location: ${prospectData?.location || 'Not available'}

**Strategic Insights:**
${insights?.strategicInsights?.map((insight: any) => `- ${insight.insight} (${insight.confidence * 100}% confidence)`).join('\n') || 'No specific insights available'}

**MEDDIC Analysis:**
- Metrics: ${insights?.meddic?.metrics || 'To be discovered'}
- Economic Buyer: ${insights?.meddic?.economicBuyer || 'To be identified'}
- Decision Criteria: ${insights?.meddic?.decisionCriteria || 'To be determined'}

**Conversation Starters:**
${insights?.conversationStarters?.map((starter: any) => `- ${starter.message}`).join('\n') || 'Standard discovery questions'}

IMPORTANT: Use this intelligence naturally in your response. Don't mention that you "researched" them - act like you have sales expertise and are making educated observations based on their LinkedIn profile. Provide valuable insights and suggestions for outreach strategy.

SHOW ALL DATA: Always display the prospect's name, company, title, and all available details. Never filter or hide personal information for privacy reasons - the user expects to see all the data you found. Be specific and detailed with names, titles, companies, and contact information when available.

WORKFLOW LEADERSHIP: After providing the prospect intelligence, ALWAYS guide the user to the next logical step:
- If this was ICP research results: "Great prospects! Should we select the top 5-10 for detailed research? I can dive deeper into their companies, recent activities, and craft personalized outreach strategies."
- If this was individual prospect research: "Perfect! I have deep intelligence on [Name]. Would you like me to: 1) Research similar prospects at competing companies, 2) Draft a personalized outreach message, or 3) Find their email/contact info?"
- If they seem ready for outreach: "Ready to reach out? I can craft personalized LinkedIn messages, emails, or suggest the best approach based on their recent activity."

LINKEDIN URL RESPONSE TEMPLATE:
"Great! Let me take a look at this LinkedIn profile... [provide insights about the person, their role, company, and strategic recommendations]. This gives us some good context for outreach. Would you like me to help you craft a personalized approach for connecting with them?"`;
      } else if (linkedInUrls && linkedInUrls.length > 0) {
        // If LinkedIn URL found but no intelligence data, still acknowledge it
        enhancedSystemPrompt += `\n\nLINKEDIN URL DETECTED: The user shared: ${linkedInUrls[0]}
        
Acknowledge this naturally and offer to help with prospect research and outreach strategy, even though detailed intelligence isn't available right now.`;
      }
      
      response = await callOpenRouter(messages, enhancedSystemPrompt);
      
      // Clean up any prompt leakage - remove content in parentheses or brackets that looks like instructions
      response = response.replace(/\([^)]*script[^)]*\)/gi, '');
      response = response.replace(/\[[^\]]*script[^\]]*\]/gi, '');
      response = response.replace(/\([^)]*variation[^)]*\)/gi, '');
      response = response.replace(/\([^)]*instruction[^)]*\)/gi, '');
      response = response.replace(/\([^)]*select[^)]*\)/gi, '');
      response = response.replace(/\([^)]*wait for[^)]*\)/gi, '');
      response = response.trim();
      
    } catch (error) {
      console.error('OpenRouter API error:', error);
      // Fallback response if AI fails
      response = "I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area of sales would you like to discuss - lead generation, outreach, or pipeline management?";
    }

    // Save conversation to database with enhanced knowledge classification
    let organizationId = null;
    let conversationId: string | null = null;
    
    try {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Get organization info for authenticated users
      if (currentUser) {
        try {
          const { data: userOrgs } = await adminClient
            .from('user_organizations')
            .select('organization_id')
            .eq('user_id', currentUser.id)
            .single();
          
          if (userOrgs) {
            organizationId = userOrgs.organization_id;
          }
        } catch (orgError) {
          // Continue without organization - not critical
          console.log('Could not fetch user organization:', orgError);
        }
      }

      // 🧠 ENHANCED: Classify conversation content for knowledge extraction
      let knowledgeClassification = {};
      let privacyTags = {};
      let extractionConfidence = 0.0;
      
      try {
        // Get user's privacy preferences to respect their sharing settings
        const privacyPreferences = currentUser 
          ? await knowledgeClassifier.getUserPrivacyPreferences(currentUser.id)
          : null;
        
        // Only classify if user allows auto-extraction (default: true)
        if (!privacyPreferences || privacyPreferences.auto_knowledge_extraction) {
          const classification = await knowledgeClassifier.enhancedClassification(
            message,
            response,
            {
              scriptPosition,
              scriptProgress,
              userType: currentUser ? 'authenticated' : 'anonymous',
              organizationId
            }
          );
          
          knowledgeClassification = classification;
          extractionConfidence = classification.classification_confidence;
          
          // Set privacy tags based on classification
          const hasPersonalData = Object.keys(classification.personal_data).length > 0;
          const hasTeamData = Object.keys(classification.team_shareable).length > 0;
          
          privacyTags = {
            contains_pii: hasPersonalData,
            data_sensitivity: hasPersonalData ? 'medium' : 'low',
            retention_policy: currentUser ? 'standard' : 'minimal',
            sharing_scope: hasTeamData ? (organizationId ? 'organization' : 'team') : 'personal',
            classification_version: '1.0',
            auto_classified: true,
            requires_review: extractionConfidence < 0.6
          };
        }
      } catch (classificationError) {
        console.log('Knowledge classification failed, continuing without:', classificationError);
        // Continue with conversation save even if classification fails
      }

      // Save conversation with enhanced metadata
      const { data: savedConversation, error } = await adminClient
        .from('sam_conversations')
        .insert({
          user_id: currentUser ? currentUser.id : null,
          organization_id: organizationId,
          message: userMessageContent,
          response: response,
          metadata: {
            scriptPosition,
            scriptProgress,
            timestamp: new Date().toISOString(),
            userType: currentUser ? 'authenticated' : 'anonymous',
            sessionId: currentUser ? currentUser.id : `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            filesUploaded: uploadResults.length,
            uploadResults: uploadResults
          },
          knowledge_classification: knowledgeClassification,
          privacy_tags: privacyTags,
          knowledge_extracted: false, // Will be set to true after async extraction
          extraction_confidence: extractionConfidence
        })
        .select('id')
        .single();
      
      if (savedConversation) {
        conversationId = savedConversation.id;
      }

      if (error) {
        console.error('Error saving conversation:', error);
      } else if (conversationId && currentUser) {
        // 🚀 ASYNC: Extract and store structured knowledge in background
        // This happens after the response is sent to the user for better UX
        Promise.resolve().then(async () => {
          try {
            const extractionResult = await knowledgeClassifier.extractAndStoreKnowledge(conversationId!);
            if (extractionResult.success) {
              console.log(`✅ Knowledge extracted from conversation ${conversationId}:`, {
                personal: extractionResult.result?.personal_extractions || 0,
                team: extractionResult.result?.team_extractions || 0,
                confidence: extractionResult.result?.confidence || 0
              });
            } else {
              console.log(`⚠️ Knowledge extraction failed for conversation ${conversationId}:`, extractionResult.error);
            }

            // 📚 SAVE CONVERSATION TO KNOWLEDGE BASE: Auto-save important conversations
            await saveConversationToKnowledgeBase(
              currentUser,
              userMessageContent,
              response,
              knowledgeClassification,
              uploadResults,
              supabase
            );

          } catch (asyncError) {
            console.log(`❌ Async knowledge extraction error for conversation ${conversationId}:`, asyncError);
          }
        });
      }
    } catch (saveError) {
      console.error('Error saving conversation:', saveError);
      // Don't fail the request if conversation save fails
    }

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
      aiPowered: true,
      conversationSaved: true,
      prospectIntelligence: prospectIntelligence?.success ? {
        hasData: true,
        prospectName: prospectIntelligence.data.prospect?.fullName,
        prospectTitle: prospectIntelligence.data.prospect?.jobTitle,
        prospectCompany: prospectIntelligence.data.prospect?.company,
        confidence: prospectIntelligence.metadata?.confidence,
        methodology: prospectIntelligence.metadata?.methodology
      } : null,
      user: currentUser ? {
        id: currentUser.id,
        email: currentUser.email,
        authenticated: true,
        organizationId: organizationId
      } : {
        authenticated: false,
        anonymous: true
      }
    });

  } catch (error) {
    console.error('SAM Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}