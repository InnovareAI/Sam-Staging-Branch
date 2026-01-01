import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { generateEmbedding } from '@/lib/services/reply-rag';

// Initialize Supabase client
// Extract insights from SAM conversations using Mistral AI
async function extractConversationInsights(conversationData: any[]) {
  const systemPrompt = `You are an AI conversation analyst specialized in extracting valuable business insights from SAM AI conversations for knowledge base enhancement.

Analyze the provided SAM conversation and extract:
1. **Knowledge Gaps**: Information SAM needed but didn't have
2. **Successful Patterns**: What worked well in the conversation
3. **Customer Insights**: Pain points, objections, interests mentioned
4. **Product/Service Questions**: What prospects asked about
5. **Competitive Mentions**: Competitors or alternatives discussed
6. **Messaging Effectiveness**: Which messages resonated
7. **Process Improvements**: Suggested enhancements for SAM

Return your analysis in this exact JSON format:
{
  "knowledge_gaps": [
    {
      "category": "products/competition/pricing/etc",
      "missing_info": "specific information needed",
      "impact": "high/medium/low",
      "suggested_section": "products/competition/messaging/etc"
    }
  ],
  "successful_patterns": [
    {
      "pattern_type": "messaging/objection_handling/value_prop/etc",
      "description": "what worked well",
      "reusable": true
    }
  ],
  "customer_insights": [
    {
      "insight_type": "pain_point/objection/interest/requirement",
      "description": "the specific insight",
      "frequency": "common/rare/new",
      "business_impact": "high/medium/low"
    }
  ],
  "product_questions": [
    {
      "question_category": "features/pricing/implementation/support",
      "question": "the actual question asked",
      "sam_response_quality": "excellent/good/poor/missing"
    }
  ],
  "competitive_mentions": [
    {
      "competitor": "competitor name",
      "context": "how they were mentioned",
      "positioning_opportunity": "how to position against them"
    }
  ],
  "messaging_effectiveness": [
    {
      "message_type": "value_prop/case_study/feature_benefit",
      "message": "the message used",
      "response": "positive/neutral/negative",
      "improvement_suggestion": "how to improve"
    }
  ],
  "knowledge_base_recommendations": [
    {
      "section": "section to update",
      "priority": "high/medium/low",
      "recommendation": "specific recommendation",
      "content_suggestion": "what content to add"
    }
  ],
  "conversation_summary": "brief summary of the conversation outcome and key points"
}`;

  const conversationText = conversationData
    .map(msg => `${msg.role === 'user' ? 'User' : 'SAM'}: ${msg.content}`)
    .join('\n\n');

  const userPrompt = `Analyze this SAM AI conversation for knowledge base insights:

${conversationText.substring(0, 12000)}${conversationText.length > 12000 ? '...' : ''}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
        'X-Title': 'SAM AI Knowledge Base'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-small-3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from Mistral AI');
    }

    // Parse the JSON response
    const analysisMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!analysisMatch) {
      throw new Error('Invalid JSON response from Mistral AI');
    }

    return JSON.parse(analysisMatch[0]);

  } catch (error) {
    console.error('Conversation analysis error:', error);

    // Fallback analysis
    return {
      knowledge_gaps: [{
        category: "general",
        missing_info: "Unable to analyze conversation",
        impact: "low",
        suggested_section: "general"
      }],
      successful_patterns: [],
      customer_insights: [],
      product_questions: [],
      competitive_mentions: [],
      messaging_effectiveness: [],
      knowledge_base_recommendations: [{
        section: "general",
        priority: "low",
        recommendation: "Review conversation manually",
        content_suggestion: "Manual analysis needed"
      }],
      conversation_summary: "Conversation analysis failed - manual review required",
      error: error instanceof Error ? error.message : 'Analysis failed'
    };
  }
}

// Automatic conversation processing (called via webhook or cron)
export async function POST(request: NextRequest) {
  try {
    const { conversationId, messages, userId, trigger = 'manual' } = await request.json();

    if (!conversationId || !messages || !Array.isArray(messages)) {
      return NextResponse.json({
        error: 'Missing required fields: conversationId, messages'
      }, { status: 400 });
    }

    // Filter for meaningful conversations (minimum length, recent, etc.)
    if (messages.length < 4) {
      return NextResponse.json({
        message: 'Conversation too short for meaningful insights',
        processed: false
      });
    }

    // Extract insights using Mistral AI
    const insights = await extractConversationInsights(messages);

    // Store insights in the knowledge base insights table
    const { data: insightRecord, error: insertError } = await supabase
      .from('conversation_insights')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        insights: insights,
        trigger_type: trigger,
        created_at: new Date().toISOString(),
        status: 'pending_review'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store insights:', insertError);
      return NextResponse.json({ error: 'Failed to store insights' }, { status: 500 });
    }

    // Process high-priority recommendations immediately
    const highPriorityRecs = insights.knowledge_base_recommendations?.filter(
      (rec: any) => rec.priority === 'high'
    ) || [];

    if (highPriorityRecs.length > 0) {
      // Create notification for knowledge base managers
      const { error: notifError } = await supabase
        .from('kb_notifications')
        .insert({
          type: 'high_priority_insight',
          title: 'High Priority Knowledge Gap Identified',
          message: `SAM conversation revealed ${highPriorityRecs.length} high-priority knowledge gaps`,
          data: {
            conversation_id: conversationId,
            insight_id: insightRecord.id,
            recommendations: highPriorityRecs
          },
          created_at: new Date().toISOString()
        });

      if (notifError) {
        console.warn('Failed to create notification:', notifError);
      }
    }

    // Auto-process certain types of insights
    await processAutomaticInsights(insights, conversationId, insightRecord.id);

    return NextResponse.json({
      insightId: insightRecord.id,
      conversationId,
      insightsExtracted: {
        knowledge_gaps: insights.knowledge_gaps?.length || 0,
        customer_insights: insights.customer_insights?.length || 0,
        competitive_mentions: insights.competitive_mentions?.length || 0,
        recommendations: insights.knowledge_base_recommendations?.length || 0
      },
      highPriorityCount: highPriorityRecs.length,
      success: true
    });

  } catch (error) {
    console.error('Insight extraction error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Insight extraction failed'
    }, { status: 500 });
  }
}

// Process insights that can be automatically integrated
async function processAutomaticInsights(insights: any, conversationId: string, insightId: string) {
  try {
    // 1. Auto-add new competitors to competition tracking
    if (insights.competitive_mentions?.length > 0) {
      for (const mention of insights.competitive_mentions) {
        // Generate embedding for semantic check
        const embedding = await generateEmbedding(mention.competitor);

        const { error } = await supabase
          .from('competitive_intelligence')
          .upsert({
            competitor_name: mention.competitor,
            first_mentioned: new Date().toISOString(),
            last_mentioned: new Date().toISOString(),
            mention_context: mention.context,
            positioning_notes: mention.positioning_opportunity,
            source: `conversation_${conversationId}`,
            status: 'auto_detected',
            embedding: embedding
          }, { onConflict: 'competitor_name' });

        if (error) {
          console.warn('Failed to add competitor:', error);
        }
      }
    }

    // 2. Auto-categorize frequent customer insights with SEMANTIC DEDUPLICATION
    if (insights.customer_insights?.length > 0) {
      for (const insight of insights.customer_insights) {
        const textToEmbed = `${insight.insight_type}: ${insight.description}`;
        const embedding = await generateEmbedding(textToEmbed);

        if (embedding) {
          // Check for similar existing patterns
          const { data: similarPatterns, error: searchError } = await supabase.rpc('match_customer_insights', {
            p_query_embedding: embedding,
            p_match_threshold: 0.85,
            p_match_count: 1
          });

          if (!searchError && similarPatterns && similarPatterns.length > 0) {
            // Found a similar pattern - CLUSTER it
            const existing = similarPatterns[0];
            console.log(`[Insight] Clustering insight with existing pattern: ${existing.id} (sim: ${existing.similarity})`);

            // Using a simple append for source_conversations if we don't have a specific RPC
            const { data: current } = await supabase
              .from('customer_insight_patterns')
              .select('source_conversations, frequency_score')
              .eq('id', existing.id)
              .single();

            const updatedSources = Array.from(new Set([...(current?.source_conversations || []), conversationId]));

            await supabase
              .from('customer_insight_patterns')
              .update({
                frequency_score: (current?.frequency_score || existing.frequency_score || 1) + 1,
                last_seen: new Date().toISOString(),
                source_conversations: updatedSources
              })
              .eq('id', existing.id);

            continue;
          }
        }

        // No similar pattern found - INSERT NEW
        const { error } = await supabase
          .from('customer_insight_patterns')
          .insert({
            insight_type: insight.insight_type,
            description: insight.description,
            frequency_score: 1,
            business_impact: insight.business_impact || 'medium',
            last_seen: new Date().toISOString(),
            source_conversations: [conversationId],
            embedding: embedding
          });

        if (error) {
          console.warn('Failed to insert insight pattern:', error);
        }
      }
    }

    // 3. Auto-flag urgent knowledge gaps with SEMANTIC DEDUPLICATION
    if (insights.knowledge_gaps?.length > 0) {
      for (const gap of insights.knowledge_gaps) {
        const textToEmbed = `${gap.category}: ${gap.missing_info}`;
        const embedding = await generateEmbedding(textToEmbed);

        if (embedding) {
          // Check for existing similar gaps
          const { data: similarGaps } = await supabase.rpc('match_knowledge_gaps', {
            p_query_embedding: embedding,
            p_match_threshold: 0.85,
            p_match_count: 1
          });

          if (similarGaps && similarGaps.length > 0) {
            const existing = similarGaps[0];
            console.log(`[Insight] Skip redundant knowledge gap: ${existing.id} (sim: ${existing.similarity})`);

            // Optionally update existing gap priority or status
            if (gap.impact === 'high' && existing.impact_level !== 'high') {
              await supabase
                .from('knowledge_gap_tracking')
                .update({ impact_level: 'high', status: 'urgent' })
                .eq('id', existing.id);
            }
            continue;
          }
        }

        // Insert new gap if unique
        const { error } = await supabase
          .from('knowledge_gap_tracking')
          .insert({
            category: gap.category,
            missing_info: gap.missing_info,
            impact_level: gap.impact,
            suggested_section: gap.suggested_section,
            source_conversation: conversationId,
            insight_id: insightId,
            status: gap.impact === 'high' ? 'urgent' : 'open',
            embedding: embedding,
            created_at: new Date().toISOString()
          });

        if (error) {
          console.warn('Failed to track knowledge gap:', error);
        }
      }
    }

  } catch (error) {
    console.error('Automatic insight processing error:', error);
  }
}

// Bulk conversation analysis endpoint
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const since = url.searchParams.get('since') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get recent conversation threads that haven't been analyzed
    const { data: threads, error: threadsError } = await supabase
      .from('sam_conversation_threads')
      .select('id, user_id, created_at')
      .gte('created_at', since)
      .is('analyzed_for_insights', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (threadsError) {
      throw threadsError;
    }

    const results = [];

    for (const thread of threads || []) {
      try {
        // Fetch messages for this thread
        const { data: messages, error: messagesError } = await supabase
          .from('sam_thread_messages')
          .select('role, content')
          .eq('thread_id', thread.id)
          .order('message_order', { ascending: true });

        if (messagesError || !messages || messages.length < 4) {
          continue;
        }

        // Process each conversation thread
        const insights = await extractConversationInsights(messages);

        // Store insights
        const { data: insightRecord } = await supabase
          .from('conversation_insights')
          .insert({
            conversation_id: thread.id,
            user_id: thread.user_id,
            insights: insights,
            trigger_type: 'bulk_analysis',
            created_at: new Date().toISOString(),
            status: 'auto_processed'
          })
          .select()
          .single();

        // Mark thread as analyzed
        await supabase
          .from('sam_conversation_threads')
          .update({ analyzed_for_insights: true })
          .eq('id', thread.id);

        results.push({
          conversationId: thread.id,
          insightId: insightRecord?.id,
          insights: {
            gaps: insights.knowledge_gaps?.length || 0,
            customer_insights: insights.customer_insights?.length || 0,
            recommendations: insights.knowledge_base_recommendations?.length || 0
          }
        });

      } catch (convError) {
        console.error(`Failed to process conversation ${conversation.id}:`, convError);
        results.push({
          conversationId: conversation.id,
          error: 'Processing failed'
        });
      }
    }

    return NextResponse.json({
      processedCount: results.length,
      results,
      success: true
    });

  } catch (error) {
    console.error('Bulk analysis error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Bulk analysis failed'
    }, { status: 500 });
  }
}