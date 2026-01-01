import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// Unipile API for LinkedIn search
// API Docs: https://developer.unipile.com/docs/linkedin-search
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

// Helper to normalize LinkedIn URL to vanity name (for deduplication)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Extract vanity name: remove protocol, domain, /in/, trailing slashes, and query params
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) {
    return match[1].toLowerCase().trim();
  }
  // If it's already just a vanity name
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

// Generate batch ID for grouping search results
function generateBatchId(): string {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8);
  return `search_${timestamp}_${random}`;
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      searchQuery,
      query, // alias
      workspaceId,
      accountId, // LinkedIn account ID to search from
      limit = 25
    } = body;

    const searchTerm = searchQuery || query;

    if (!searchTerm) {
      return NextResponse.json({
        success: false,
        error: 'Search query is required'
      }, { status: 400 });
    }

    // Check if Unipile is configured
    if (!UNIPILE_API_KEY || !UNIPILE_DSN) {
      console.error('Unipile not configured - LinkedIn search unavailable');
      return NextResponse.json({
        success: false,
        error: 'LinkedIn search is not configured. Please contact support.'
      }, { status: 503 });
    }

    // Get LinkedIn account from Unipile API
    let linkedinAccountId = accountId;
    if (!linkedinAccountId) {
      const unipileResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/accounts`, {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!unipileResponse.ok) {
        const errorText = await unipileResponse.text();
        console.error('Unipile accounts error:', errorText);
        return NextResponse.json({
          success: false,
          error: 'Failed to retrieve LinkedIn accounts'
        }, { status: 503 });
      }

      const unipileData = await unipileResponse.json();
      const allAccounts = Array.isArray(unipileData) ? unipileData : (unipileData.items || []);
      const linkedInAccounts = allAccounts.filter((acc: any) => acc.type === 'LINKEDIN');

      if (linkedInAccounts.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No LinkedIn account connected. Please connect your LinkedIn account first.'
        }, { status: 400 });
      }

      linkedinAccountId = linkedInAccounts[0].id;
    }

    // Search via Unipile
    const searchResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/linkedin/search`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        account_id: linkedinAccountId,
        query: searchTerm,
        type: 'people',
        limit: Math.min(limit, 50)
      })
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Unipile search error:', errorText);
      return NextResponse.json({
        success: false,
        error: `LinkedIn search failed: ${errorText}`
      }, { status: 500 });
    }

    const searchData = await searchResponse.json();
    const results = searchData.items || searchData.results || [];

    // Generate batch ID for this search
    const batchId = generateBatchId();

    // Transform to prospect format
    const prospects = results.map((item: any) => {
      const linkedinUrl = item.linkedin_url || (item.public_identifier ? `https://linkedin.com/in/${item.public_identifier}` : null);
      return {
        id: item.id || `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
        firstName: item.first_name,
        lastName: item.last_name,
        title: item.headline || item.title,
        company: item.company || item.company_name,
        linkedinUrl,
        linkedinUrlHash: normalizeLinkedInUrl(linkedinUrl),
        location: item.location,
        profileImage: item.profile_picture || item.photo_url,
        connectionDegree: item.connection_degree || 3,
        linkedinProviderId: item.id || item.provider_id,
        source: 'linkedin_search'
      };
    });

    // Save to workspace_prospects if workspaceId provided
    let savedCount = 0;
    let duplicateCount = 0;
    const savedProspects: any[] = [];
    const duplicates: any[] = [];

    if (workspaceId) {
      for (const prospect of prospects) {
        // Skip if no LinkedIn URL (can't dedupe without it)
        if (!prospect.linkedinUrl || !prospect.linkedinUrlHash) {
          continue;
        }

        // Prepare prospect data for workspace_prospects table
        const prospectData = {
          workspace_id: workspaceId,
          first_name: prospect.firstName || prospect.name?.split(' ')[0] || 'Unknown',
          last_name: prospect.lastName || prospect.name?.split(' ').slice(1).join(' ') || '',
          linkedin_url: prospect.linkedinUrl,
          linkedin_url_hash: prospect.linkedinUrlHash,
          linkedin_profile_url: prospect.linkedinUrl, // Keep old column in sync
          company: prospect.company,
          company_name: prospect.company, // Keep old column in sync
          title: prospect.title,
          job_title: prospect.title, // Keep old column in sync
          location: prospect.location,
          linkedin_provider_id: prospect.linkedinProviderId,
          connection_degree: prospect.connectionDegree,
          source: 'linkedin_search',
          approval_status: 'pending',
          batch_id: batchId,
          enrichment_data: {
            profile_image: prospect.profileImage,
            search_query: searchTerm,
            search_timestamp: new Date().toISOString()
          }
        };

        // Try to upsert (insert or update if exists)
        const { data: upsertedProspect, error: upsertError } = await pool
          .from('workspace_prospects')
          .upsert(prospectData, {
            onConflict: 'workspace_id,linkedin_url_hash',
            ignoreDuplicates: false // Update existing record with new data
          })
          .select()
          .single();

        if (upsertError) {
          // Check if it's a duplicate key error (23505)
          if (upsertError.code === '23505') {
            duplicateCount++;
            // Fetch the existing record
            const { data: existingProspect } = await pool
              .from('workspace_prospects')
              .select('*')
              .eq('workspace_id', workspaceId)
              .eq('linkedin_url_hash', prospect.linkedinUrlHash)
              .single();
            if (existingProspect) {
              duplicates.push({
                ...prospect,
                dbId: existingProspect.id,
                existingApprovalStatus: existingProspect.approval_status
              });
            }
          } else {
            console.error('Error saving prospect:', upsertError);
          }
        } else if (upsertedProspect) {
          savedCount++;
          savedProspects.push({
            ...prospect,
            dbId: upsertedProspect.id,
            approvalStatus: 'pending'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      prospects: savedProspects.length > 0 ? savedProspects : prospects,
      duplicates,
      metadata: {
        source: 'unipile',
        query: searchTerm,
        total_found: prospects.length,
        saved_count: savedCount,
        duplicate_count: duplicateCount,
        batch_id: batchId,
        account_id: linkedinAccountId,
        workspace_id: workspaceId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('LinkedIn search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'LinkedIn search failed'
    }, { status: 500 });
  }
}
