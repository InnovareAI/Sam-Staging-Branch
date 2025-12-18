import { NextRequest } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { importQueue } from '@/lib/import-queue';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Streaming LinkedIn Import API
 *
 * Uses Server-Sent Events (SSE) to stream prospects to frontend in real-time
 * as they are fetched from LinkedIn/Unipile API.
 *
 * Data is displayed immediately while being saved to DB in background.
 *
 * POST /api/linkedin/import-saved-search-stream
 */
export async function POST(request: NextRequest) {
  console.log('🌊 STREAMING IMPORT START');

  const encoder = new TextEncoder();

  try {
    // Parse request body
    const body = await request.json();
    const { saved_search_url, campaign_name, target_count, user_id, workspace_id } = body;

    if (!saved_search_url) {
      return new Response(
        encoder.encode(`event: error\ndata: ${JSON.stringify({error: 'saved_search_url is required'})}\n\n`),
        { status: 400 }
      );
    }

    if (!user_id || !workspace_id) {
      return new Response(
        encoder.encode(`event: error\ndata: ${JSON.stringify({error: 'Authentication required'})}\n\n`),
        { status: 401 }
      );
    }

    // Create ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Get user data
          const { data: userData } = await supabaseAdmin
            .from('users')
            .select('id, email')
            .eq('id', user_id)
            .single();

          if (!userData) {
            controller.enqueue(encoder.encode(
              `event: error\ndata: ${JSON.stringify({error: 'User not found'})}\n\n`
            ));
            controller.close();
            return;
          }

          // Get LinkedIn account
          const { data: linkedInAccounts } = await supabaseAdmin
            .from('workspace_accounts')
            .select('unipile_account_id, account_name')
            .eq('workspace_id', workspace_id)
            .eq('account_type', 'linkedin')
            .in('connection_status', VALID_CONNECTION_STATUSES)
            .eq('user_id', user_id);

          if (!linkedInAccounts || linkedInAccounts.length === 0) {
            controller.enqueue(encoder.encode(
              `event: error\ndata: ${JSON.stringify({error: 'No LinkedIn account connected'})}\n\n`
            ));
            controller.close();
            return;
          }

          const linkedInAccount = linkedInAccounts[0];

          // Create session first
          const sessionId = uuidv4();
          const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

          const { data: workspace } = await supabaseAdmin
            .from('workspaces')
            .select('name')
            .eq('id', workspace_id)
            .single();

          const companyCode = workspace?.name?.substring(0, 3).toUpperCase() || 'IAI';
          const searchIdMatch = saved_search_url.match(/savedSearchId=(\d+)/);
          const savedSearchId = searchIdMatch ? searchIdMatch[1] : Date.now().toString().slice(-6);
          const finalCampaignName = campaign_name || `${today}-${companyCode}-SavedSearch-${savedSearchId}`;

          // Get next batch number
          const { data: existingSessions } = await supabaseAdmin
            .from('prospect_approval_sessions')
            .select('batch_number')
            .eq('user_id', user_id)
            .eq('workspace_id', workspace_id)
            .order('batch_number', { ascending: false })
            .limit(1);

          const nextBatchNumber = (existingSessions?.[0]?.batch_number || 0) + 1;

          // Create session
          await supabaseAdmin
            .from('prospect_approval_sessions')
            .insert({
              id: sessionId,
              batch_number: nextBatchNumber,
              user_id: user_id,
              workspace_id: workspace_id,
              campaign_name: finalCampaignName,
              campaign_tag: `saved_search_${savedSearchId}`,
              total_prospects: 0, // Will be updated incrementally
              approved_count: 0,
              rejected_count: 0,
              pending_count: 0,
              status: 'active',
              created_at: new Date().toISOString()
            });

          console.log(`✅ Created session: ${sessionId}`);

          // Send session info to frontend
          controller.enqueue(encoder.encode(
            `event: session\ndata: ${JSON.stringify({
              session_id: sessionId,
              campaign_name: finalCampaignName
            })}\n\n`
          ));

          // Prepare for batch import
          const targetProspects = Math.min(Math.max(target_count || 500, 25), 2500);
          const batchSize = 50;
          const maxBatches = Math.ceil(targetProspects / batchSize);

          const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6';
          const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

          // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
          const searchUrl = `https://${UNIPILE_DSN}/api/v1/linkedin/search`;

          let allProspects: any[] = [];
          let cursor: string | null = null;
          let batchCount = 0;

          controller.enqueue(encoder.encode(
            `event: start\ndata: ${JSON.stringify({
              target: targetProspects,
              batch_size: batchSize,
              max_batches: maxBatches
            })}\n\n`
          ));

          // Fetch batches and stream to frontend
          while (allProspects.length < targetProspects && batchCount < maxBatches) {
            batchCount++;
            console.log(`📦 Fetching batch ${batchCount}/${maxBatches}`);

            const params = new URLSearchParams({
              account_id: linkedInAccount.unipile_account_id,
              limit: batchSize.toString()
            });

            if (cursor) {
              params.append('cursor', cursor);
            }

            const searchPayload = { url: saved_search_url };

            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 45000);

            try {
              const searchResponse = await fetch(`${searchUrl}?${params}`, {
                method: 'POST',
                headers: {
                  'X-API-KEY': UNIPILE_API_KEY!,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchPayload),
                signal: abortController.signal
              });

              clearTimeout(timeoutId);

              if (!searchResponse.ok) {
                throw new Error(`Unipile API error: ${searchResponse.status}`);
              }

              const searchData = await searchResponse.json();
              const batchProspects = searchData.items || [];

              allProspects.push(...batchProspects);
              cursor = searchData.cursor || null;

              console.log(`✅ Batch ${batchCount}: +${batchProspects.length} prospects (total: ${allProspects.length})`);
              console.log(`   Response keys: ${Object.keys(searchData).join(', ')}`);
              console.log(`   Cursor value: ${cursor || 'NULL'}`);
              console.log(`   Has more results: ${!!cursor}`);

              // Stream batch to frontend immediately
              controller.enqueue(encoder.encode(
                `event: batch\ndata: ${JSON.stringify({
                  batch: batchCount,
                  prospects: batchProspects,
                  total: allProspects.length,
                  target: targetProspects,
                  has_more: cursor !== null
                })}\n\n`
              ));

              // Queue for background save (non-blocking)
              await importQueue.add(sessionId, batchProspects, batchCount);

              // Stop if no more results
              if (!cursor || batchProspects.length === 0) {
                console.log(`🏁 No more results available`);
                break;
              }

              // Small delay between batches
              if (allProspects.length < targetProspects && cursor) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }

            } catch (error: any) {
              clearTimeout(timeoutId);
              console.error(`❌ Batch ${batchCount} error:`, error);

              // Send error but continue with next batch
              controller.enqueue(encoder.encode(
                `event: batch_error\ndata: ${JSON.stringify({
                  batch: batchCount,
                  error: error.message
                })}\n\n`
              ));

              // If we have some prospects, continue
              if (allProspects.length === 0) {
                // If first batch fails, abort
                controller.enqueue(encoder.encode(
                  `event: error\ndata: ${JSON.stringify({
                    error: 'Failed to fetch prospects from LinkedIn'
                  })}\n\n`
                ));
                controller.close();
                return;
              }
            }
          }

          // Send completion event
          controller.enqueue(encoder.encode(
            `event: complete\ndata: ${JSON.stringify({
              total: allProspects.length,
              batches: batchCount,
              session_id: sessionId,
              campaign_name: finalCampaignName
            })}\n\n`
          ));

          console.log(`✅ Streaming complete: ${allProspects.length} prospects across ${batchCount} batches`);
          controller.close();

        } catch (error) {
          console.error('❌ Streaming error:', error);
          controller.enqueue(encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error'
            })}\n\n`
          ));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable Nginx buffering
      }
    });

  } catch (error) {
    console.error('❌ Import stream error:', error);
    return new Response(
      encoder.encode(`event: error\ndata: ${JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      })}\n\n`),
      { status: 500 }
    );
  }
}
