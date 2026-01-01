import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// LinkedIn Contact Discovery API
// Discovers and maps LinkedIn profile URLs to internal IDs for existing connections

interface DiscoveryJob {
  id: string;
  job_type: 'message_history_scan' | 'connection_sync' | 'campaign_id_resolution';
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_profiles_to_process: number;
  profiles_processed: number;
  ids_discovered: number;
  errors_encountered: number;
}

interface MessageHistoryContact {
  sender_id: string; // LinkedIn internal ID
  sender_name?: string;
  chat_id: string;
  timestamp: string;
  account_id: string;
}

// Helper function to make Unipile API calls
async function callUnipileAPI(endpoint: string, method: string = 'GET') {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile API credentials not configured');
  }

  const url = `https://${unipileDsn}/api/v1/${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json',
    }
  };

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Extract LinkedIn profile URL from various LinkedIn identifiers
function constructLinkedInProfileURL(publicIdentifier: string): string {
  // Construct standard LinkedIn URL from public identifier
  return `https://www.linkedin.com/in/${publicIdentifier}`;
}

// Start message history scanning job
async function startMessageHistoryScan(
  userId: string, 
  workspaceId: string, 
  supabase: any,
  batchSize: number = 500
): Promise<string> {
  
  // Create discovery job
  const { data: job, error: jobError } = await supabase
    .from('linkedin_discovery_jobs')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      job_type: 'message_history_scan',
      status: 'running',
      parameters: { batch_size: batchSize },
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (jobError) {
    throw new Error(`Failed to create discovery job: ${jobError.message}`);
  }

  // Get available LinkedIn accounts via MCP
  try {
    const availableAccounts = await mcp__unipile__unipile_get_accounts();
    const linkedinAccounts = availableAccounts.filter(account => 
      account.type === 'LINKEDIN' && 
      account.sources?.[0]?.status === 'OK'
    );

    if (linkedinAccounts.length === 0) {
      await supabase
        .from('linkedin_discovery_jobs')
        .update({
          status: 'failed',
          error_message: 'No active LinkedIn accounts found',
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);
      
      throw new Error('No active LinkedIn accounts available');
    }

    let totalDiscovered = 0;
    let totalProcessed = 0;
    let totalErrors = 0;
    const discoveredContacts = new Map<string, MessageHistoryContact>();

    // Scan message history for each LinkedIn account
    for (const account of linkedinAccounts) {
      try {
        console.log(`Scanning message history for account: ${account.name}`);
        
        // Get recent messages using MCP
        const recentMessages = await mcp__unipile__unipile_get_recent_messages({
          account_id: account.sources[0].id,
          batch_size: batchSize
        });

        for (const message of recentMessages) {
          totalProcessed++;
          
          if (message.sender_id && message.sender_id !== account.connection_params?.im?.id) {
            // This is a message from someone else (potential contact)
            const contactKey = message.sender_id;
            
            if (!discoveredContacts.has(contactKey)) {
              discoveredContacts.set(contactKey, {
                sender_id: message.sender_id,
                sender_name: message.sender_name,
                chat_id: message.chat_info?.id,
                timestamp: message.timestamp,
                account_id: account.sources[0].id
              });
              totalDiscovered++;
            }
          }
        }
        
      } catch (accountError) {
        console.error(`Error scanning account ${account.name}:`, accountError);
        totalErrors++;
      }
    }

    // Store discovered contacts in database
    for (const [senderId, contact] of discoveredContacts) {
      try {
        // Create contact record with internal ID
        await supabase.rpc('upsert_linkedin_contact', {
          p_user_id: userId,
          p_workspace_id: workspaceId,
          p_linkedin_profile_url: `linkedin://internal/${senderId}`, // Temporary URL format
          p_linkedin_internal_id: senderId,
          p_full_name: contact.sender_name,
          p_discovery_method: 'message_history',
          p_connection_status: 'connected',
          p_can_message: true
        });
      } catch (contactError) {
        console.error(`Error storing contact ${senderId}:`, contactError);
        totalErrors++;
      }
    }

    // Update job completion
    await supabase
      .from('linkedin_discovery_jobs')
      .update({
        status: 'completed',
        total_profiles_to_process: totalProcessed,
        profiles_processed: totalProcessed,
        ids_discovered: totalDiscovered,
        errors_encountered: totalErrors,
        results: {
          accounts_scanned: linkedinAccounts.length,
          contacts_discovered: totalDiscovered,
          discovery_rate: totalProcessed > 0 ? (totalDiscovered / totalProcessed * 100).toFixed(2) : 0
        },
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id);

    return job.id;

  } catch (error: any) {
    // Update job with error
    await supabase
      .from('linkedin_discovery_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id);
    
    throw error;
  }
}

// Resolve LinkedIn IDs for campaign prospects
async function resolveCampaignLinkedInIds(
  campaignId: string,
  userId: string,
  supabase: any
): Promise<any> {
  
  console.log(`Resolving LinkedIn IDs for campaign: ${campaignId}`);
  
  // Get campaign prospects that need ID resolution
  const { data: resolutionResults, error: resolutionError } = await supabase
    .rpc('resolve_campaign_linkedin_ids', {
      p_campaign_id: campaignId,
      p_user_id: userId
    });

  if (resolutionError) {
    throw new Error(`Failed to resolve campaign LinkedIn IDs: ${resolutionError.message}`);
  }

  const stats = {
    total_prospects: resolutionResults.length,
    ids_found: resolutionResults.filter((r: any) => r.resolution_status === 'found').length,
    ids_missing: resolutionResults.filter((r: any) => r.resolution_status === 'not_found').length
  };

  return {
    resolution_results: resolutionResults,
    statistics: stats
  };
}

export async function POST(req: NextRequest) {
  try {
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      action, 
      campaign_id,
      batch_size = 500 
    } = await req.json();

    if (!action) {
      return NextResponse.json({ error: 'Action required' }, { status: 400 });
    }

    switch (action) {
      case 'scan_message_history':
        try {
          const jobId = await startMessageHistoryScan(
            user.id, 
            user.user_metadata.workspace_id,
            supabase,
            batch_size
          );
          
          return NextResponse.json({
            message: 'Message history scan started',
            job_id: jobId,
            status: 'running'
          });
        } catch (error: any) {
          return NextResponse.json({
            error: 'Failed to start message history scan',
            details: error.message
          }, { status: 500 });
        }

      case 'resolve_campaign_ids':
        if (!campaign_id) {
          return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
        }
        
        try {
          const results = await resolveCampaignLinkedInIds(
            campaign_id,
            user.id,
            supabase
          );
          
          return NextResponse.json({
            message: 'Campaign LinkedIn ID resolution completed',
            ...results
          });
        } catch (error: any) {
          return NextResponse.json({
            error: 'Failed to resolve campaign LinkedIn IDs',
            details: error.message
          }, { status: 500 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('LinkedIn discovery error:', error);
    return NextResponse.json(
      { error: 'LinkedIn discovery failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const jobId = searchParams.get('job_id');
    const searchTerm = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');

    switch (action) {
      case 'job_status':
        if (!jobId) {
          return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
        }
        
        const { data: job, error: jobError } = await supabase
          .from('linkedin_discovery_jobs')
          .select('*')
          .eq('id', jobId)
          .eq('user_id', user.id)
          .single();

        if (jobError || !job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json(job);

      case 'recent_jobs':
        const { data: jobs, error: jobsError } = await supabase
          .from('linkedin_discovery_jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (jobsError) {
          return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
        }

        return NextResponse.json({ jobs });

      case 'messageable_contacts':
        const { data: contacts, error: contactsError } = await supabase
          .rpc('get_messageable_linkedin_contacts', {
            p_user_id: user.id,
            p_search_term: searchTerm,
            p_limit: limit
          });

        if (contactsError) {
          return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
        }

        return NextResponse.json({ contacts });

      case 'discovery_stats':
        const { data: stats, error: statsError } = await supabase
          .from('linkedin_contacts')
          .select('discovery_method, connection_status, can_message', { count: 'exact' })
          .eq('user_id', user.id);

        if (statsError) {
          return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
        }

        const discoveryStats = {
          total_contacts: stats.length,
          by_discovery_method: {},
          by_connection_status: {},
          messageable_contacts: stats.filter(s => s.can_message).length
        };

        stats.forEach(stat => {
          discoveryStats.by_discovery_method[stat.discovery_method] = 
            (discoveryStats.by_discovery_method[stat.discovery_method] || 0) + 1;
          discoveryStats.by_connection_status[stat.connection_status] = 
            (discoveryStats.by_connection_status[stat.connection_status] || 0) + 1;
        });

        return NextResponse.json({ stats: discoveryStats });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('LinkedIn discovery GET error:', error);
    return NextResponse.json(
      { error: 'Request failed', details: error.message },
      { status: 500 }
    );
  }
}