import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const { workspaceId, analysisType, context } = await request.json();

        if (!workspaceId || !analysisType) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // Fetch existing knowledge context (product, ICP, company)
        const { data: kbDocs } = await supabase
            .from('knowledge_base')
            .select('title, summary, section')
            .eq('workspace_id', workspaceId)
            .in('section', ['company', 'product', 'value_prop', 'icp'])
            .limit(10);

        const knowledgeContext = kbDocs?.map(d => `[${d.section}] ${d.title}: ${d.summary || ''}`).join('\n') || 'No existing knowledge found.';

        let systemPrompt = '';
        let userPrompt = '';

        switch (analysisType) {
            case 'competitors':
                systemPrompt = `You are a competitive intelligence analyst. Based on the company's product and positioning, identify likely competitors and analyze their strengths and weaknesses. Format as structured JSON.`;
                userPrompt = `Based on this company knowledge:\n${knowledgeContext}\n\nIdentify 3-5 likely competitors. For each, provide:
- name
- website (if known, otherwise "unknown")
- positioning
- strengths (array)
- weaknesses (array)
- threat_level (low/medium/high)

Return as JSON array.`;
                break;

            case 'trends':
                systemPrompt = `You are a market research analyst. Identify current market trends relevant to the company's industry and target market. Format as structured JSON.`;
                userPrompt = `Based on this company knowledge:\n${knowledgeContext}\n\nIdentify 5 relevant market trends that could impact their sales strategy. For each, provide:
- trend_name
- description
- impact (how it affects their prospects' decisions)
- opportunity (how to leverage in outreach)
- urgency (low/medium/high)

Return as JSON array.`;
                break;

            case 'news':
                systemPrompt = `You are an industry analyst. Identify recent news and events that could impact the company's prospects and their buying decisions. Format as structured JSON.`;
                userPrompt = `Based on this company knowledge:\n${knowledgeContext}\n\nIdentify 5 types of industry news or events that would be relevant to mention in sales outreach. For each, provide:
- news_type
- example
- relevance (why it matters to prospects)
- talking_point (how to reference in conversation)
- freshness_window (how long this stays relevant)

Return as JSON array.`;
                break;

            default:
                return NextResponse.json({ success: false, error: 'Invalid analysis type' }, { status: 400 });
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 2000,
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        let analysisResult;

        try {
            analysisResult = JSON.parse(responseText);
        } catch {
            analysisResult = { raw: responseText };
        }

        return NextResponse.json({
            success: true,
            analysisType,
            result: analysisResult,
            knowledgeUsed: kbDocs?.length || 0,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Strategic analysis error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Analysis failed'
        }, { status: 500 });
    }
}
