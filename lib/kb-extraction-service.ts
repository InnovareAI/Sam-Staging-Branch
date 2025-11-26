/**
 * Knowledge Base Extraction Service
 * Extracts structured knowledge from SAM conversations and auto-populates KB
 */

interface ExtractionResult {
  category: string;
  data: any;
  confidence: number;
  source: 'conversation' | 'document' | 'search';
}

/**
 * Extract structured knowledge from conversation messages
 */
export async function extractKnowledgeFromConversation(
  messages: Array<{ role: string; content: string }>,
  workspaceId: string
): Promise<ExtractionResult[]> {
  const conversationText = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n\n');

  if (conversationText.length < 50) {
    return []; // Not enough content to extract
  }

  try {
    // Use OpenRouter to extract structured data
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
        'X-Title': 'SAM AI Knowledge Extraction'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [
          {
            role: 'system',
            content: `You are a knowledge extraction AI. Extract structured business information from sales conversations.

Extract the following categories if present:
- ICP (ideal customer profile): industries, company sizes, job titles, locations
- Products/Services: names, descriptions, features, benefits
- Pricing: price points, packages, terms, discounts
- Value Propositions: key benefits, differentiators, ROI claims
- Pain Points: customer problems, challenges, frustrations
- Objections: common concerns and how to handle them
- Competitors: competitor names, strengths, weaknesses
- Success Stories: customer wins, metrics, outcomes
- Use Cases: specific scenarios where product helps

Return JSON array of extracted items:
{
  "extractions": [
    {
      "category": "icp" | "products" | "pricing" | "value_props" | "pain_points" | "objections" | "competitors" | "success_stories" | "use_cases",
      "data": { ... structured data ... },
      "confidence": 0.0-1.0,
      "evidence": "quote from conversation"
    }
  ]
}

Only extract if confidence >= 0.7. Return empty array if nothing found.`
          },
          {
            role: 'user',
            content: `Extract knowledge from this conversation:\n\n${conversationText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      console.error('[KB Extract] OpenRouter error:', response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return [];
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const extractions = parsed.extractions || [];

    return extractions.map((item: any) => ({
      category: item.category,
      data: item.data,
      confidence: item.confidence,
      source: 'conversation' as const
    }));

  } catch (error) {
    console.error('[KB Extract] Extraction failed:', error);
    return [];
  }
}

/**
 * Map extracted data to KB table inserts
 */
export function mapExtractionsToKBUpdates(
  extractions: ExtractionResult[],
  workspaceId: string
) {
  const updates: Array<{
    table: string;
    operation: 'insert' | 'upsert';
    data: any;
  }> = [];

  for (const extraction of extractions) {
    switch (extraction.category) {
      case 'icp':
        // Update ICP configuration
        if (extraction.data.industries || extraction.data.company_sizes || extraction.data.job_titles) {
          updates.push({
            table: 'icp_configurations',
            operation: 'upsert',
            data: {
              workspace_id: workspaceId,
              industry_segmentation: {
                primary_industries: extraction.data.industries || []
              },
              company_demographics: {
                employee_count: extraction.data.company_sizes || [],
                job_titles: extraction.data.job_titles || []
              },
              updated_at: new Date().toISOString(),
              source: 'conversation_extraction'
            }
          });
        }
        break;

      case 'products':
        // Add to products knowledge
        if (extraction.data.name) {
          updates.push({
            table: 'knowledge_base',
            operation: 'insert',
            data: {
              workspace_id: workspaceId,
              category: 'products',
              title: extraction.data.name,
              content: extraction.data.description || '',
              tags: extraction.data.features || [],
              source_type: 'sam_discovery',
              source_metadata: {
                extraction_confidence: extraction.confidence,
                extracted_from: 'conversation',
                features: extraction.data.features,
                benefits: extraction.data.benefits
              },
              is_active: true
            }
          });
        }
        break;

      case 'pricing':
        // Add pricing information
        updates.push({
          table: 'knowledge_base',
          operation: 'insert',
          data: {
            workspace_id: workspaceId,
            category: 'pricing',
            title: `Pricing - ${extraction.data.package_name || 'General'}`,
            content: JSON.stringify(extraction.data, null, 2),
            tags: ['pricing', extraction.data.package_name].filter(Boolean),
            source_type: 'sam_discovery',
            source_metadata: {
              extraction_confidence: extraction.confidence,
              price_points: extraction.data.price_points,
              terms: extraction.data.terms
            },
            is_active: true
          }
        });
        break;

      case 'value_props':
        // Add to messaging/value prop section
        updates.push({
          table: 'knowledge_base',
          operation: 'insert',
          data: {
            workspace_id: workspaceId,
            category: 'messaging',
            title: 'Value Proposition',
            content: extraction.data.description || '',
            tags: ['value-prop', ...(extraction.data.key_benefits || [])],
            source_type: 'sam_discovery',
            source_metadata: {
              extraction_confidence: extraction.confidence,
              differentiators: extraction.data.differentiators,
              roi_claims: extraction.data.roi_claims
            },
            is_active: true
          }
        });
        break;

      case 'pain_points':
        // Add to pain points section
        updates.push({
          table: 'knowledge_base',
          operation: 'insert',
          data: {
            workspace_id: workspaceId,
            category: 'icp',
            subcategory: 'pain_points',
            title: 'Customer Pain Points',
            content: (extraction.data.pain_points || []).join('\n'),
            tags: ['pain-points'],
            source_type: 'sam_discovery',
            source_metadata: {
              extraction_confidence: extraction.confidence,
              pain_points: extraction.data.pain_points
            },
            is_active: true
          }
        });
        break;

      case 'objections':
        // Add to objections section
        if (extraction.data.objection && extraction.data.response) {
          updates.push({
            table: 'knowledge_base',
            operation: 'insert',
            data: {
              workspace_id: workspaceId,
              category: 'objections',
              title: extraction.data.objection,
              content: extraction.data.response,
              tags: ['objection-handling'],
              source_type: 'sam_discovery',
              source_metadata: {
                extraction_confidence: extraction.confidence,
                objection_type: extraction.data.type
              },
              is_active: true
            }
          });
        }
        break;

      case 'competitors':
        // Add to competitive intel
        if (extraction.data.competitor_name) {
          updates.push({
            table: 'knowledge_base_competitors',
            operation: 'insert',
            data: {
              workspace_id: workspaceId,
              name: extraction.data.competitor_name,
              strengths: extraction.data.strengths || [],
              weaknesses: extraction.data.weaknesses || [],
              is_active: true,
              source_metadata: {
                extraction_confidence: extraction.confidence,
                extracted_from: 'conversation'
              }
            }
          });
        }
        break;

      case 'success_stories':
        // Add to success stories
        if (extraction.data.customer || extraction.data.outcome) {
          updates.push({
            table: 'knowledge_base',
            operation: 'insert',
            data: {
              workspace_id: workspaceId,
              category: 'success',
              title: extraction.data.customer || 'Customer Success Story',
              content: extraction.data.story || '',
              tags: ['case-study', ...(extraction.data.metrics || [])],
              source_type: 'sam_discovery',
              source_metadata: {
                extraction_confidence: extraction.confidence,
                outcome: extraction.data.outcome,
                metrics: extraction.data.metrics
              },
              is_active: true
            }
          });
        }
        break;

      case 'use_cases':
        // Add to use cases (if table exists)
        if (extraction.data.title) {
          updates.push({
            table: 'knowledge_base',
            operation: 'insert',
            data: {
              workspace_id: workspaceId,
              category: 'products',
              subcategory: 'use_cases',
              title: extraction.data.title,
              content: extraction.data.description || '',
              tags: ['use-case', extraction.data.industry].filter(Boolean),
              source_type: 'sam_discovery',
              source_metadata: {
                extraction_confidence: extraction.confidence,
                industry: extraction.data.industry,
                problem: extraction.data.problem,
                solution: extraction.data.solution
              },
              is_active: true
            }
          });
        }
        break;
    }
  }

  return updates;
}

/**
 * Execute KB updates from extractions
 */
export async function applyKBUpdates(
  updates: Array<{ table: string; operation: string; data: any }>,
  supabase: any
) {
  const results = [];

  for (const update of updates) {
    try {
      if (update.operation === 'insert') {
        const { data, error } = await supabase
          .from(update.table)
          .insert(update.data)
          .select()
          .single();

        if (error) {
          console.error(`[KB Update] Insert failed for ${update.table}:`, error);
          results.push({ success: false, table: update.table, error: error.message });
        } else {
          results.push({ success: true, table: update.table, id: data.id });
        }
      } else if (update.operation === 'upsert') {
        const { data, error } = await supabase
          .from(update.table)
          .upsert(update.data, { onConflict: 'workspace_id' })
          .select()
          .single();

        if (error) {
          console.error(`[KB Update] Upsert failed for ${update.table}:`, error);
          results.push({ success: false, table: update.table, error: error.message });
        } else {
          results.push({ success: true, table: update.table, id: data?.id });
        }
      }
    } catch (err) {
      console.error(`[KB Update] Exception for ${update.table}:`, err);
      results.push({ success: false, table: update.table, error: String(err) });
    }
  }

  return results;
}
