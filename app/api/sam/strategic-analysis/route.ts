/**
 * SAM Strategic Analysis API
 * Provides AI-driven competitor analysis, market trends, and industry news
 * Updated Dec 31, 2025: Migrated to verifyAuth and pool.query
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { verifyAuth, pool } from '@/lib/auth';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAuth(request);
        if (!auth.isAuthenticated || !auth.user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { workspaceId, analysisType, context } = await request.json();

        if (!workspaceId || !analysisType) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // Verify user has access to this workspace
        const workspaceRes = await pool.query(
            'SELECT 1 FROM users WHERE id = $1 AND current_workspace_id = $2',
            [auth.user.uid, workspaceId]
        );

        // If not their current workspace, check workspace_members
        if (workspaceRes.rowCount === 0) {
            const memberRes = await pool.query(
                'SELECT 1 FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
                [auth.user.uid, workspaceId]
            );
            if (memberRes.rowCount === 0) {
                return NextResponse.json({ success: false, error: 'Unauthorized access to workspace' }, { status: 403 });
            }
        }

        // Fetch existing knowledge context (product, ICP, company)
        const kbRes = await pool.query(
            `SELECT title, summary, section FROM knowledge_base 
             WHERE workspace_id = $1 AND section ANY($2)
             LIMIT 10`,
            [workspaceId, ['company', 'product', 'value_prop', 'icp']]
        );
        const kbDocs = kbRes.rows;

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
