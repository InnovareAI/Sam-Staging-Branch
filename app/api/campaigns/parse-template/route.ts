import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/campaigns/parse-template
 * Parse pasted message templates using AI to:
 * - Identify message sequence (connection, alternative, follow-ups)
 * - Replace specific values with placeholders
 * - Return structured template data
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pastedText, campaignType } = body;

    if (!pastedText) {
      return NextResponse.json(
        { error: 'pastedText is required' },
        { status: 400 }
      );
    }

    // Call OpenRouter AI to parse the template
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
        'X-Title': 'SAM AI Platform'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        messages: [
          {
            role: 'system',
            content: `CRITICAL: You are a TEMPLATE PLACEHOLDER REPLACER, NOT a copywriter. Your ONLY job is to replace specific names/companies with placeholders while keeping EVERYTHING ELSE EXACTLY AS-IS.

🚨 STRICT RULES - DO NOT DEVIATE:

1. PRESERVE THE EXACT ORIGINAL WORDING
   - DO NOT rewrite, rephrase, improve, or change ANY words
   - DO NOT change tone, style, punctuation, or formatting
   - DO NOT add or remove emoji, exclamation marks, or slang
   - Keep casual language casual ("Hey", "love", "wanna" stay as-is)
   - Keep typos and grammar as-is (user may want them)

2. ONLY REPLACE THESE SPECIFIC VALUES:
   - Person's first/last names → {first_name} or {last_name}
   - Company names (proper nouns) → {company_name}
   - Job titles (when referencing a specific person) → {job_title}
   - Industries (when specific like "SaaS", "FinTech") → {industry}
   - Locations (cities/states when personal) → {location}

3. NEVER REPLACE GENERIC WORDS:
   - Generic roles: "sales", "marketing", "CEO" in general context stay as-is
   - Product categories: "CRM", "software", "platform" stay as-is
   - Common phrases: "VP of Sales", "your company" stay as-is UNLESS specific name follows

4. IDENTIFY MESSAGE TYPES:
   - First substantial message = connectionMessage
   - If contains "Follow-up:", "Follow up 2:", split into followUpMessages
   - Alternative message only if explicitly labeled

5. RETURN JSON EXACTLY:
{
  "connectionMessage": "exact text with only placeholders replaced",
  "alternativeMessage": "exact text or null",
  "followUpMessages": ["exact text array"] or []
}

EXAMPLE - CORRECT:
Input: "Hey Sarah! Love your work at Acme Corp. Wanna grab coffee?"
Output: "Hey {first_name}! Love your work at {company_name}. Wanna grab coffee?"

EXAMPLE - WRONG (don't do this):
Input: "Hey Sarah! Love your work at Acme Corp. Wanna grab coffee?"
Output: "Hi {first_name}, I noticed your role at {company_name}. Would you like to connect?" ❌

Remember: You are NOT a copywriter. You are a FIND-AND-REPLACE tool. Keep the user's voice intact!`
          },
          {
            role: 'user',
            content: `Campaign Type: ${campaignType || 'connector'}

Pasted Template Text:
${pastedText}

Please parse this into the JSON structure with proper placeholder replacement.`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!openRouterResponse.ok) {
      const error = await openRouterResponse.text();
      console.error('OpenRouter API error:', error);
      return NextResponse.json(
        { error: 'AI parsing failed' },
        { status: 500 }
      );
    }

    const aiResult = await openRouterResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content;

    if (!aiContent) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    // Parse the AI response (it should be JSON)
    let parsedTemplate;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedTemplate = JSON.parse(jsonMatch[0]);
      } else {
        parsedTemplate = JSON.parse(aiContent);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);

      // SAFETY: Return original text as fallback instead of failing
      console.warn('⚠️ Parse failed - returning original text as fallback');
      return NextResponse.json({
        success: true,
        parsed: {
          connectionMessage: pastedText,
          alternativeMessage: '',
          followUpMessages: []
        },
        originalText: pastedText,
        warning: 'AI parsing failed, using original text'
      });
    }

    // CRITICAL SAFETY CHECK: Ensure at least one message exists
    const hasConnectionMsg = parsedTemplate.connectionMessage && parsedTemplate.connectionMessage.trim().length > 0;
    const hasAltMsg = parsedTemplate.alternativeMessage && parsedTemplate.alternativeMessage.trim().length > 0;
    const hasFollowUps = Array.isArray(parsedTemplate.followUpMessages) && parsedTemplate.followUpMessages.length > 0;

    if (!hasConnectionMsg && !hasAltMsg && !hasFollowUps) {
      console.error('⚠️ SAFETY: Parsed template is empty! Returning original text as fallback');
      return NextResponse.json({
        success: true,
        parsed: {
          connectionMessage: pastedText,
          alternativeMessage: '',
          followUpMessages: []
        },
        originalText: pastedText,
        warning: 'Parsed result was empty, using original text'
      });
    }

    console.log('✅ Template parsed successfully:', {
      hasConnectionMsg,
      hasAltMsg,
      hasFollowUps,
      connectionMsgLength: parsedTemplate.connectionMessage?.length || 0
    });

    return NextResponse.json({
      success: true,
      parsed: {
        connectionMessage: parsedTemplate.connectionMessage || '',
        alternativeMessage: parsedTemplate.alternativeMessage || '',
        followUpMessages: Array.isArray(parsedTemplate.followUpMessages)
          ? parsedTemplate.followUpMessages
          : []
      },
      originalText: pastedText
    });

  } catch (error: any) {
    console.error('Template parsing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
