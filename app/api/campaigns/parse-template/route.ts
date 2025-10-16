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
            content: `You are an expert at parsing LinkedIn message templates. Your task is to:

1. Analyze the pasted text and identify the message sequence:
   - Connection message (for 2nd/3rd degree connections)
   - Alternative message (for existing 1st degree connections)
   - Follow-up messages (numbered sequence)

2. Replace specific personal information with placeholders:
   - Names → {first_name} or {last_name}
   - Job titles → {job_title}
   - Company names → {company_name}
   - Industries → {industry}
   - Locations → {location}

3. Return a JSON object with this exact structure:
{
  "connectionMessage": "string or null",
  "alternativeMessage": "string or null",
  "followUpMessages": ["string", "string", ...] or []
}

Rules:
- Keep the tone and structure of the original messages
- Only replace values that appear to be specific to an individual/company
- Generic words stay as-is (e.g., "sales" stays "sales", but "VP of Sales at Acme" becomes "VP of {job_title} at {company_name}")
- If text contains phrases like "Follow-up:", "Follow-up 2:", etc., separate them into followUpMessages array
- If unsure about message type, default to connectionMessage
- Preserve line breaks and formatting`
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
      return NextResponse.json(
        { error: 'Failed to parse AI response', rawResponse: aiContent },
        { status: 500 }
      );
    }

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
