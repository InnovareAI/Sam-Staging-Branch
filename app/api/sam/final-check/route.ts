import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import {
  detectLanguageFromContent,
  getPersonalizationGuidelines,
  getLanguageSpecificRecommendations
} from '@/utils/linkedin-personalization-languages';

interface FinalCheckRequest {
  message: string;
  recipient: {
    first_name: string;
    last_name: string;
    company_name: string;
    job_title: string;
    location?: string;
    industry?: string;
    linkedin_profile_url?: string;
  };
  context?: {
    campaign_type?: 'sales' | 'recruitment' | 'networking' | 'partnership';
    message_type?: 'connection_request' | 'follow_up_1' | 'follow_up_2' | 'follow_up_3' | 'email';
    platform?: 'linkedin' | 'email';
    account_type?: 'free' | 'premium' | 'sales_navigator' | 'recruiter';
  };
}

interface FinalCheckResponse {
  approved: boolean;
  confidence_score: number;
  issues: Array<{
    type: 'error' | 'warning' | 'suggestion';
    category: 'length' | 'personalization' | 'cultural' | 'compliance' | 'tone' | 'content';
    message: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
  optimized_message?: string;
  recommendations: string[];
  cultural_notes?: string[];
  character_count: {
    current: number;
    max_limit: number;
    recommended_max: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = auth.user;

    // Parse and validate request body
    let requestBody: FinalCheckRequest;
    try {
      requestBody = await req.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { message, recipient, context = {} } = requestBody;

    // Input validation
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    if (!recipient || !recipient.first_name || !recipient.last_name) {
      return NextResponse.json(
        { error: 'Recipient with first_name and last_name is required' },
        { status: 400 }
      );
    }

    // Perform AI final check
    const finalCheckResult = await performAIFinalCheck(message, recipient, context);

    // Log the final check for analytics
    await logFinalCheck(user.uid, message, recipient, finalCheckResult);

    return NextResponse.json({
      success: true,
      final_check: finalCheckResult
    });

  } catch (error: any) {
    console.error('Final check error:', error);
    return NextResponse.json(
      { error: 'Failed to perform final check', details: error.message },
      { status: 500 }
    );
  }
}

async function performAIFinalCheck(
  message: string,
  recipient: any,
  context: any
): Promise<FinalCheckResponse> {
  const issues: FinalCheckResponse['issues'] = [];
  const recommendations: string[] = [];
  let cultural_notes: string[] = [];
  let optimized_message: string | undefined;

  // Language detection and cultural analysis
  const detectedLanguage = detectLanguageFromContent(message);
  const guidelines = getPersonalizationGuidelines(detectedLanguage);
  const languageRecommendations = getLanguageSpecificRecommendations(message, detectedLanguage);

  if (detectedLanguage !== 'en') {
    cultural_notes = guidelines.culturalNotes.slice(0, 3);
  }

  // Character count analysis
  const platform = context.platform || 'linkedin';
  const messageType = context.message_type || 'connection_request';
  const accountType = context.account_type || 'free';

  let maxLimit = 300; // LinkedIn premium default
  let recommendedMax = 280; // Leave buffer

  if (platform === 'linkedin') {
    if (messageType === 'connection_request') {
      maxLimit = accountType === 'free' ? 200 : 300;
      recommendedMax = maxLimit - 20; // Leave 20 char buffer
    } else {
      maxLimit = 8000; // LinkedIn messages
      recommendedMax = 1000; // Keep messages concise
    }
  } else if (platform === 'email') {
    maxLimit = 50000; // Email essentially unlimited
    recommendedMax = 2000; // Keep emails readable
  }

  const characterCount = {
    current: message.length,
    max_limit: maxLimit,
    recommended_max: recommendedMax
  };

  // Critical Issues (will block sending)

  // 1. Character limit violations
  if (message.length > maxLimit) {
    issues.push({
      type: 'error',
      category: 'length',
      message: `Message exceeds ${platform} character limit (${message.length}/${maxLimit} chars)`,
      severity: 'critical'
    });
  }

  // 2. Missing personalization
  const hasPersonalization = message.includes(recipient.first_name) ||
    message.includes(recipient.last_name) ||
    message.includes(recipient.company_name);

  if (!hasPersonalization) {
    issues.push({
      type: 'error',
      category: 'personalization',
      message: 'Message lacks personalization - should include recipient name or company',
      severity: 'critical'
    });
  }

  // 3. Cultural compliance for non-English
  if (detectedLanguage === 'de') {
    if (!message.includes('Sie') && !message.includes('Sehr geehrte')) {
      issues.push({
        type: 'error',
        category: 'cultural',
        message: 'German messages must use formal "Sie" addressing and "Sehr geehrte/r" greeting',
        severity: 'high'
      });
    }
  }

  if (detectedLanguage === 'fr') {
    if (!message.includes('Vous') && !message.includes('Monsieur') && !message.includes('Madame')) {
      issues.push({
        type: 'error',
        category: 'cultural',
        message: 'French messages must use formal "Vous" and "Monsieur/Madame" addressing',
        severity: 'high'
      });
    }
  }

  // Warnings (should be addressed but won't block)

  // 1. Length warnings
  if (message.length > recommendedMax) {
    issues.push({
      type: 'warning',
      category: 'length',
      message: `Message is longer than recommended (${message.length}/${recommendedMax} chars)`,
      severity: 'medium'
    });
  }

  // 2. Tone analysis
  if (message.toLowerCase().includes('urgent') || message.toLowerCase().includes('asap')) {
    issues.push({
      type: 'warning',
      category: 'tone',
      message: 'Avoid urgent language in cold outreach - can appear pushy',
      severity: 'medium'
    });
  }

  // 3. Compliance checks
  if (message.toLowerCase().includes('buy') || message.toLowerCase().includes('purchase')) {
    issues.push({
      type: 'warning',
      category: 'compliance',
      message: 'Direct sales language in connection requests may violate LinkedIn policies',
      severity: 'high'
    });
  }

  // Suggestions for improvement

  // 1. Add language-specific recommendations
  if (languageRecommendations.length > 0) {
    recommendations.push(...languageRecommendations.slice(0, 2));
  }

  // 2. Personalization suggestions
  if (!message.includes(recipient.job_title) && recipient.job_title) {
    recommendations.push(`Consider mentioning their role as ${recipient.job_title} for better personalization`);
  }

  if (!message.includes(recipient.company_name) && recipient.company_name) {
    recommendations.push(`Reference ${recipient.company_name} to show you researched their background`);
  }

  // 3. Call-to-action suggestions
  if (!message.includes('?') && !message.match(/\b(call|chat|meet|discuss|connect|schedule)\b/i)) {
    recommendations.push('Consider adding a soft call-to-action or question to encourage response');
  }

  // 4. Cultural enhancement suggestions
  if (detectedLanguage !== 'en' && guidelines.characterEfficiency.tips.length > 0) {
    recommendations.push(...guidelines.characterEfficiency.tips.slice(0, 1));
  }

  // Generate optimized message if there are fixable issues
  if (issues.some(issue => issue.severity === 'critical' || issue.severity === 'high')) {
    optimized_message = generateOptimizedMessage(message, recipient, guidelines, issues);
  }

  // Calculate confidence score
  let confidence_score = 1.0;

  // Deduct for critical issues
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  confidence_score -= criticalIssues * 0.3;

  // Deduct for high severity issues
  const highIssues = issues.filter(i => i.severity === 'high').length;
  confidence_score -= highIssues * 0.2;

  // Deduct for medium/low issues
  const otherIssues = issues.filter(i => i.severity === 'medium' || i.severity === 'low').length;
  confidence_score -= otherIssues * 0.05;

  // Ensure confidence score doesn't go below 0
  confidence_score = Math.max(0, confidence_score);

  // Add bonuses for good practices
  if (hasPersonalization) confidence_score += 0.1;
  if (message.length <= recommendedMax) confidence_score += 0.05;
  if (detectedLanguage !== 'en' && languageRecommendations.length === 0) confidence_score += 0.1; // Good cultural compliance

  // Cap at 1.0
  confidence_score = Math.min(1.0, confidence_score);

  // Determine if message is approved
  const approved = issues.filter(i => i.severity === 'critical').length === 0;

  return {
    approved,
    confidence_score,
    issues,
    optimized_message,
    recommendations,
    cultural_notes: cultural_notes.length > 0 ? cultural_notes : undefined,
    character_count: characterCount
  };
}

function generateOptimizedMessage(
  originalMessage: string,
  recipient: any,
  guidelines: any,
  issues: any[]
): string {
  let optimized = originalMessage;

  // Fix personalization if missing
  const hasPersonalization = optimized.includes(recipient.first_name) ||
    optimized.includes(recipient.last_name) ||
    optimized.includes(recipient.company_name);

  if (!hasPersonalization) {
    // Add basic personalization at the beginning
    const greeting = guidelines.language === 'German' ? `Sehr geehrte/r ${recipient.first_name} ${recipient.last_name}` :
      guidelines.language === 'French' ? `Bonjour ${recipient.first_name}` :
        guidelines.language === 'Dutch' ? `Hallo ${recipient.first_name}` :
          `Hi ${recipient.first_name}`;

    optimized = `${greeting},\n\n${optimized}`;
  }

  // Fix cultural addressing for German
  if (guidelines.language === 'German' && !optimized.includes('Sie')) {
    optimized = optimized.replace(/\bdu\b/gi, 'Sie');
    optimized = optimized.replace(/\bdich\b/gi, 'Sie');
    optimized = optimized.replace(/\bdir\b/gi, 'Ihnen');
  }

  // Fix cultural addressing for French  
  if (guidelines.language === 'French' && !optimized.includes('Vous')) {
    optimized = optimized.replace(/\btu\b/gi, 'Vous');
    optimized = optimized.replace(/\btoi\b/gi, 'Vous');
  }

  // Trim if too long
  const criticalLengthIssue = issues.find(i => i.category === 'length' && i.severity === 'critical');
  if (criticalLengthIssue) {
    const maxLength = parseInt(criticalLengthIssue.message.match(/\d+/)?.[0] || '300') - 20; // Leave buffer
    if (optimized.length > maxLength) {
      optimized = optimized.substring(0, maxLength - 3) + '...';
    }
  }

  return optimized;
}

async function logFinalCheck(
  userId: string,
  message: string,
  recipient: any,
  result: FinalCheckResponse
) {
  try {
    await pool.query(
      `INSERT INTO sam_final_checks 
       (user_id, message_content, recipient_name, recipient_company, approved, confidence_score, 
        issues_count, critical_issues_count, issues_summary, recommendations_count, character_count, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        userId,
        message,
        `${recipient.first_name} ${recipient.last_name}`,
        recipient.company_name,
        result.approved,
        result.confidence_score,
        result.issues.length,
        result.issues.filter(i => i.severity === 'critical').length,
        result.issues.map(i => `${i.category}: ${i.message}`).join('; '),
        result.recommendations.length,
        result.character_count.current
      ]
    );
  } catch (error) {
    console.error('Failed to log final check:', error);
    // Don't throw - logging failure shouldn't block the API
  }
}