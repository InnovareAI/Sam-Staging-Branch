import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { parse } from 'csv-parse/sync';
import { airtableService } from '@/lib/airtable';

// Prevent 504 timeout on large uploads with LinkedIn resolution
export const maxDuration = 120; // 120 seconds (LinkedIn resolution takes longer)

// Enhanced Campaign Upload with LinkedIn ID Resolution
// Handles CSV upload and automatically resolves LinkedIn IDs for existing connections

interface CSVProspect {
  first_name: string;
  last_name: string;
  company_name?: string;
  job_title?: string;
  linkedin_profile_url: string;
  email_address?: string;
  location?: string;
  industry?: string;
  company_size?: string;
}

interface UploadResult {
  total_prospects: number;
  new_prospects: number;
  existing_prospects: number;
  linkedin_ids_resolved: number;
  linkedin_ids_missing: number;
  ready_for_messaging: number;
  ready_for_connection: number;
  errors: Array<{
    row: number;
    prospect: Partial<CSVProspect>;
    error: string;
  }>;
}

// Validate and clean prospect data
function validateProspectData(prospect: any, rowIndex: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!prospect.first_name?.trim()) {
    errors.push('First name is required');
  }

  if (!prospect.last_name?.trim()) {
    errors.push('Last name is required');
  }

  if (!prospect.linkedin_profile_url?.trim()) {
    errors.push('LinkedIn profile URL is required');
  } else if (!prospect.linkedin_profile_url.includes('linkedin.com/in/')) {
    errors.push('Invalid LinkedIn profile URL format');
  }

  if (prospect.email_address && !prospect.email_address.includes('@')) {
    errors.push('Invalid email address format');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Clean and normalize prospect data
function cleanProspectData(prospect: any): CSVProspect {
  return {
    first_name: prospect.first_name?.trim() || '',
    last_name: prospect.last_name?.trim() || '',
    company_name: prospect.company_name?.trim() || prospect.company?.trim() || null,
    job_title: prospect.job_title?.trim() || prospect.title?.trim() || null,
    linkedin_profile_url: prospect.linkedin_profile_url?.trim() || prospect.linkedin_url?.trim() || '',
    email_address: prospect.email_address?.trim() || prospect.email?.trim() || null,
    location: prospect.location?.trim() || null,
    industry: prospect.industry?.trim() || null,
    company_size: prospect.company_size?.trim() || prospect['company size']?.trim() || null
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const csvFile = formData.get('csv_file') as File;
    const campaignId = formData.get('campaign_id') as string;
    const autoResolveIds = formData.get('auto_resolve_ids') === 'true';

    if (!csvFile) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
    }

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // Verify campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id')
      .eq('id', campaignId)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Parse CSV file
    const csvContent = await csvFile.text();
    let prospects: any[];

    try {
      prospects = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (parseError) {
      return NextResponse.json({
        error: 'Failed to parse CSV file',
        details: 'Please ensure your CSV has headers and is properly formatted'
      }, { status: 400 });
    }

    if (prospects.length === 0) {
      return NextResponse.json({
        error: 'CSV file is empty or has no data rows'
      }, { status: 400 });
    }

    console.log(`Processing ${prospects.length} prospects for campaign: ${campaign.name}`);

    const result: UploadResult = {
      total_prospects: prospects.length,
      new_prospects: 0,
      existing_prospects: 0,
      linkedin_ids_resolved: 0,
      linkedin_ids_missing: 0,
      ready_for_messaging: 0,
      ready_for_connection: 0,
      errors: []
    };

    const prospectIds: string[] = [];

    // Process each prospect
    for (let i = 0; i < prospects.length; i++) {
      try {
        const rawProspect = prospects[i];
        const cleanedProspect = cleanProspectData(rawProspect);

        // Validate prospect data
        const validation = validateProspectData(cleanedProspect, i + 1);
        if (!validation.isValid) {
          result.errors.push({
            row: i + 1,
            prospect: cleanedProspect,
            error: validation.errors.join(', ')
          });
          continue;
        }

        // Check if prospect already exists in workspace
        let prospectId: string;
        const { data: existingProspect } = await supabase
          .from('workspace_prospects')
          .select('id')
          .eq('workspace_id', campaign.workspace_id)
          .eq('linkedin_profile_url', cleanedProspect.linkedin_profile_url)
          .single();

        if (existingProspect) {
          // Prospect already exists
          prospectId = existingProspect.id;
          result.existing_prospects++;

          // Update existing prospect data
          await supabase
            .from('workspace_prospects')
            .update({
              first_name: cleanedProspect.first_name,
              last_name: cleanedProspect.last_name,
              company_name: cleanedProspect.company_name,
              job_title: cleanedProspect.job_title,
              email_address: cleanedProspect.email_address,
              location: cleanedProspect.location,
              industry: cleanedProspect.industry,
              company_size: cleanedProspect.company_size,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospectId);
        } else {
          // Create new prospect
          const { data: newProspect, error: prospectError } = await supabase
            .from('workspace_prospects')
            .insert({
              workspace_id: campaign.workspace_id,
              first_name: cleanedProspect.first_name,
              last_name: cleanedProspect.last_name,
              company_name: cleanedProspect.company_name,
              job_title: cleanedProspect.job_title,
              linkedin_profile_url: cleanedProspect.linkedin_profile_url,
              email_address: cleanedProspect.email_address,
              location: cleanedProspect.location,
              industry: cleanedProspect.industry,
              company_size: cleanedProspect.company_size
            })
            .select('id')
            .single();

          if (prospectError) {
            result.errors.push({
              row: i + 1,
              prospect: cleanedProspect,
              error: `Failed to create prospect: ${prospectError.message}`
            });
            continue;
          }

          prospectId = newProspect.id;
          result.new_prospects++;
        }

        prospectIds.push(prospectId);

      } catch (error: any) {
        result.errors.push({
          row: i + 1,
          prospect: prospects[i],
          error: `Processing error: ${error.message}`
        });
      }
    }

    // Add prospects to campaign
    if (prospectIds.length > 0) {
      const { data: addResults, error: addError } = await supabase
        .rpc('add_prospects_to_campaign', {
          p_campaign_id: campaignId,
          p_prospect_ids: prospectIds
        });

      if (addError) {
        console.error('Error adding prospects to campaign:', addError);
      } else {
        // ============================================
        // AIRTABLE SYNC (Dec 20, 2025): Sync ALL uploaded prospects to Airtable
        // ============================================
        console.log(`📊 Syncing ${prospectIds.length} prospects to Airtable...`);

        // Fetch the prospects with all details for Airtable sync
        const { data: prospectsToSync } = await supabase
          .from('workspace_prospects')
          .select('*')
          .in('id', prospectIds);

        if (prospectsToSync) {
          for (const p of prospectsToSync) {
            // Mapping workspace_prospects to the format expected by syncProspectToAirtable
            // which internally expects linkedin_url, first_name, last_name, etc.
            const prospectForAirtable = {
              ...p,
              linkedin_url: p.linkedin_profile_url, // Airtable service expects linkedin_url
            };

            airtableService.syncProspectToAirtable(prospectForAirtable).catch(err => {
              console.error(`   ⚠️ Failed to sync prospect ${p.id} to Airtable:`, err);
            });
          }
        }
      }
    }

    // Auto-resolve LinkedIn IDs if requested
    if (autoResolveIds && prospectIds.length > 0) {
      try {
        console.log('Auto-resolving LinkedIn IDs for uploaded prospects...');

        // Check existing LinkedIn contacts for ID resolution
        const { data: resolutionResults, error: resolutionError } = await supabase
          .rpc('resolve_campaign_linkedin_ids', {
            p_campaign_id: campaignId,
            p_user_id: user.id
          });

        if (!resolutionError && resolutionResults) {
          result.linkedin_ids_resolved = resolutionResults.filter(
            (r: any) => r.resolution_status === 'found'
          ).length;
          result.linkedin_ids_missing = resolutionResults.filter(
            (r: any) => r.resolution_status === 'not_found'
          ).length;

          // Update campaign prospects with resolved LinkedIn IDs
          for (const resolution of resolutionResults) {
            if (resolution.resolution_status === 'found') {
              await supabase
                .from('campaign_prospects')
                .update({
                  linkedin_user_id: resolution.linkedin_internal_id,
                  updated_at: new Date().toISOString()
                })
                .eq('campaign_id', campaignId)
                .eq('prospect_id', resolution.prospect_id);

              result.ready_for_messaging++;
            } else {
              result.ready_for_connection++;
            }
          }
        }
      } catch (resolutionError) {
        console.error('LinkedIn ID resolution error:', resolutionError);
        // Don't fail the upload, just log the error
      }
    } else {
      result.ready_for_connection = prospectIds.length;
    }

    // Update campaign statistics
    await supabase
      .from('campaigns')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    return NextResponse.json({
      message: 'Campaign upload completed successfully',
      campaign: {
        id: campaign.id,
        name: campaign.name
      },
      results: result,
      next_steps: {
        ready_for_messaging: result.ready_for_messaging > 0 ?
          `${result.ready_for_messaging} prospects ready for direct messaging` : null,
        ready_for_connection: result.ready_for_connection > 0 ?
          `${result.ready_for_connection} prospects ready for connection requests` : null,
        linkedin_id_discovery: result.linkedin_ids_missing > 0 ?
          'Run LinkedIn ID discovery to resolve remaining prospects' : null
      }
    });

  } catch (error: any) {
    console.error('Campaign upload error:', error);
    return NextResponse.json(
      { error: 'Campaign upload failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      message: 'Enhanced Campaign Upload API',
      endpoints: {
        upload: 'POST /api/campaigns/upload-with-resolution',
        required_fields: [
          'csv_file (file)',
          'campaign_id (string)'
        ],
        optional_fields: [
          'auto_resolve_ids (boolean) - Auto-resolve LinkedIn IDs'
        ],
        csv_format: {
          required_columns: [
            'first_name',
            'last_name',
            'linkedin_profile_url'
          ],
          optional_columns: [
            'company_name',
            'job_title',
            'email_address',
            'location',
            'industry'
          ]
        }
      },
      features: [
        'CSV validation and data cleaning',
        'Duplicate prospect detection',
        'LinkedIn ID auto-resolution',
        'Campaign assignment',
        'Detailed upload results'
      ]
    });

  } catch (error: any) {
    console.error('Campaign upload GET error:', error);
    return NextResponse.json(
      { error: 'Request failed', details: error.message },
      { status: 500 }
    );
  }
}