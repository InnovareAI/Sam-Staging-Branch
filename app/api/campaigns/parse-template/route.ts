import { verifyAuth, AuthError } from '@/lib/auth';
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
    // Authenticate user
    await verifyAuth(request);

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
            content: `CRITICAL: You are a TEMPLATE PLACEHOLDER REPLACER, NOT a copywriter. Your ONLY job is to replace RECIPIENT information with placeholders while keeping EVERYTHING ELSE EXACTLY AS-IS.

🚨 STRICT RULES - DO NOT DEVIATE:

1. PRESERVE THE EXACT ORIGINAL WORDING
   - DO NOT rewrite, rephrase, improve, or change ANY words
   - DO NOT change tone, style, punctuation, or formatting
   - DO NOT add or remove emoji, exclamation marks, or slang
   - Keep casual language casual ("Hey", "love", "wanna" stay as-is)
   - Keep typos and grammar as-is (user may want them)

2. ONLY REPLACE THE RECIPIENT'S INFORMATION:
   - Recipient's first/last names (like "Sarah", "John Smith") → {first_name} or {last_name}
   - Recipient's company names (like "Acme Corp", "TechStart Inc") → {company_name}
   - Recipient's job titles (like "VP of Sales at Acme") → {job_title}
   - Recipient's industries (when specific like "your SaaS company") → {industry}
   - Recipient's locations (like "your team in Austin") → {location}
   - Generic placeholders like "[First Name]" → {first_name}

3. NEVER REPLACE SENDER INFORMATION:
   - Sender's company name: KEEP AS-IS (e.g., "I work at 3cubed", "our company Findabl")
   - Product/service names: KEEP AS-IS (e.g., "try Findabl", "our platform HubSpot")
   - Sender's name/role: KEEP AS-IS (e.g., "I'm the co-founder of 3cubed")
   - Links/URLs: KEEP AS-IS
   - Specific tool/brand names mentioned: KEEP AS-IS

4. NEVER REPLACE GENERIC WORDS:
   - Generic roles: "sales", "marketing", "CEO" in general context stay as-is
   - Product categories: "CRM", "software", "platform" stay as-is
   - Common phrases: "VP of Sales", "your company" stay as-is UNLESS specific name follows

5. IDENTIFY MESSAGE TYPES FROM STRUCTURE:
   Look for these patterns to identify message types:
   - "CR", "CR1", "Connection Request" = connectionMessage (the LinkedIn connection request)
   - "FU", "FU1", "Follow-up 1", "Follow up:", "#1 Message" = followUpMessages array
   - Character count indicators like "(259 chars)" should be ignored, not included in output
   - Section headers like "— Post-Connection (Day 1-2)" are descriptive labels, not part of the message

   EXTRACT ONLY THE ACTUAL MESSAGE CONTENT, not the labels/headers.

   For example, if you see:
   "CR1 (259 chars)
   Hi [First Name], I noticed we both work..."

   The connectionMessage is: "Hi {first_name}, I noticed we both work..." (without "CR1 (259 chars)")

6. RETURN JSON EXACTLY:
{
  "connectionMessage": "actual message text only, no labels",
  "alternativeMessage": "actual message text or null",
  "followUpMessages": ["message 1 text only", "message 2 text only"] or []
}

EXAMPLE - CORRECT (Recipient info replaced, Sender info kept):
Input: "Hey Sarah! I'm from 3cubed. Love your work at Acme Corp. Try our tool Findabl!"
Output: "Hey {first_name}! I'm from 3cubed. Love your work at {company_name}. Try our tool Findabl!"
(Notice: "3cubed" and "Findabl" stayed, only "Sarah" and "Acme Corp" were replaced)

EXAMPLE - Message extraction:
Input:
"CR1 (250 chars)
Hi [First Name], noticed your work at XYZ Corp.

FU1 — Day 3
Hi [First Name], following up on my connection request."

Output:
{
  "connectionMessage": "Hi {first_name}, noticed your work at {company_name}.",
  "alternativeMessage": null,
  "followUpMessages": ["Hi {first_name}, following up on my connection request."]
}

Remember: You are NOT a copywriter. You are a FIND-AND-REPLACE tool for RECIPIENT info only. Extract clean message content without labels!`
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
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Template parsing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
