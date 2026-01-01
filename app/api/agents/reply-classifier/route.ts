/**
 * Reply Classifier Agent
 * Auto-classifies incoming LinkedIn/email replies for routing
 *
 * Categories: interested, not_interested, out_of_office, referral, question, objection
 *
 * POST /api/agents/reply-classifier
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { claudeClient } from '@/lib/llm/claude-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ClassificationResult {
  category: 'interested' | 'not_interested' | 'out_of_office' | 'referral' | 'question' | 'objection' | 'spam' | 'unknown';
  confidence: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'high' | 'medium' | 'low';
  suggested_action: string;
  key_signals: string[];
  requires_human_review: boolean;
}

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');

  if (!cronSecret && !authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = pool;

    // If specific reply provided, classify it
    if (body.reply_id || body.message) {
      const result = await classifySingleReply(supabase, body);
      return NextResponse.json({ success: true, classification: result });
    }

    // Otherwise, process unclassified replies in batch
    const { data: unclassified } = await supabase
      .from('campaign_replies')
      .select('id, message, prospect_id, campaign_id, created_at')
      .is('classification', null)
      .order('created_at', { ascending: false })
      .limit(body.batch_size || 20);

    if (!unclassified?.length) {
      return NextResponse.json({ success: true, processed: 0, message: 'No unclassified replies' });
    }

    const results = [];
    for (const reply of unclassified) {
      const classification = await classifyReply(reply.message);

      await supabase
        .from('campaign_replies')
        .update({
          classification: classification.category,
          classification_confidence: classification.confidence,
          classification_metadata: classification,
          requires_human_review: classification.requires_human_review,
          updated_at: new Date().toISOString()
        })
        .eq('id', reply.id);

      results.push({ id: reply.id, ...classification });
    }

    // Summary stats
    const stats = {
      interested: results.filter(r => r.category === 'interested').length,
      not_interested: results.filter(r => r.category === 'not_interested').length,
      out_of_office: results.filter(r => r.category === 'out_of_office').length,
      referral: results.filter(r => r.category === 'referral').length,
      question: results.filter(r => r.category === 'question').length,
      objection: results.filter(r => r.category === 'objection').length,
      requires_review: results.filter(r => r.requires_human_review).length
    };

    return NextResponse.json({
      success: true,
      processed: results.length,
      stats,
      classifications: results
    });

  } catch (error) {
    console.error('Reply classifier error:', error);
    return NextResponse.json({
      error: 'Classification failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}

async function classifySingleReply(supabase: any, body: any): Promise<ClassificationResult> {
  let message = body.message;

  if (body.reply_id) {
    const { data: reply } = await supabase
      .from('campaign_replies')
      .select('message')
      .eq('id', body.reply_id)
      .single();
    message = reply?.message;
  }

  if (!message) {
    throw new Error('No message to classify');
  }

  return classifyReply(message);
}

async function classifyReply(message: string): Promise<ClassificationResult> {
  const prompt = `Classify this LinkedIn/email reply from a B2B sales prospect.

MESSAGE:
"${message}"

Classify into ONE category:
- interested: Shows genuine interest, wants to learn more, agrees to meeting
- not_interested: Declines, unsubscribes, asks to stop contacting
- out_of_office: Auto-reply, vacation, temporary unavailability
- referral: Suggests contacting someone else
- question: Asks for more information without clear interest/disinterest
- objection: Raises concerns about price, timing, competition, etc.
- spam: Irrelevant, promotional, or bot response
- unknown: Cannot determine intent

Return JSON:
{
  "category": "interested|not_interested|out_of_office|referral|question|objection|spam|unknown",
  "confidence": 0.0-1.0,
  "sentiment": "positive|neutral|negative",
  "urgency": "high|medium|low",
  "suggested_action": "Brief action recommendation",
  "key_signals": ["Signal 1", "Signal 2"],
  "requires_human_review": true/false
}

Rules:
- "interested" requires explicit positive signals (meeting agreement, demo request, pricing inquiry)
- High urgency for interested prospects or time-sensitive replies
- requires_human_review=true if confidence < 0.7 or category is "question"/"objection"

Return ONLY valid JSON.`;

  try {
    const response = await claudeClient.chat({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.2
    });

    const content = response.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      category: 'unknown',
      confidence: 0.3,
      sentiment: 'neutral',
      urgency: 'low',
      suggested_action: 'Manual review required',
      key_signals: [],
      requires_human_review: true
    };
  } catch (error) {
    console.error('Claude classification error:', error);
    return {
      category: 'unknown',
      confidence: 0,
      sentiment: 'neutral',
      urgency: 'low',
      suggested_action: 'Classification failed - manual review',
      key_signals: [],
      requires_human_review: true
    };
  }
}
