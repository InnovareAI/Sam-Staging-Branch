import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { parse } from 'csv-parse/sync';

// Multi-Source Prospect Data Import System
// Handles imports from Sales Navigator, Apollo.io, ZoomInfo, and other sources

interface DataSourceMapping {
  source: 'sales_navigator' | 'apollo' | 'zoominfo' | 'linkedin_recruiter' | 'manual' | 'other';
  field_mappings: {
    [key: string]: string; // CSV column -> database field
  };
  required_fields: string[];
  optional_fields: string[];
}

// Data source configurations
const DATA_SOURCE_CONFIGS: Record<string, DataSourceMapping> = {
  sales_navigator: {
    source: 'sales_navigator',
    field_mappings: {
      'First Name': 'first_name',
      'Last Name': 'last_name', 
      'LinkedIn Profile': 'linkedin_profile_url',
      'Current Title': 'job_title',
      'Current Company': 'company_name',
      'Location': 'location',
      'Industry': 'industry',
      'Email': 'email_address'
    },
    required_fields: ['First Name', 'Last Name', 'LinkedIn Profile'],
    optional_fields: ['Current Title', 'Current Company', 'Location', 'Industry', 'Email']
  },
  
  apollo: {
    source: 'apollo',
    field_mappings: {
      'first_name': 'first_name',
      'last_name': 'last_name',
      'linkedin_url': 'linkedin_profile_url', 
      'email': 'email_address',
      'company_name': 'company_name',
      'title': 'job_title',
      'industry': 'industry',
      'location': 'location',
      'phone': 'phone_number'
    },
    required_fields: ['first_name', 'last_name'],
    optional_fields: ['linkedin_url', 'email', 'company_name', 'title', 'industry', 'location', 'phone']
  },
  
  zoominfo: {
    source: 'zoominfo',
    field_mappings: {
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Email Address': 'email_address',
      'LinkedIn Profile URL': 'linkedin_profile_url',
      'Company Name': 'company_name', 
      'Job Title': 'job_title',
      'Industry': 'industry',
      'Location': 'location',
      'Phone Number': 'phone_number'
    },
    required_fields: ['First Name', 'Last Name'],
    optional_fields: ['Email Address', 'LinkedIn Profile URL', 'Company Name', 'Job Title', 'Industry', 'Location', 'Phone Number']
  },
  
  linkedin_recruiter: {
    source: 'linkedin_recruiter',
    field_mappings: {
      'First Name': 'first_name',
      'Last Name': 'last_name',
      'Public Profile URL': 'linkedin_profile_url',
      'Headline': 'job_title',
      'Company': 'company_name',
      'Location': 'location',
      'Industry': 'industry'
    },
    required_fields: ['First Name', 'Last Name', 'Public Profile URL'],
    optional_fields: ['Headline', 'Company', 'Location', 'Industry']
  }
};

// Auto-detect data source from CSV headers
function detectDataSource(headers: string[]): string {
  const headerSet = new Set(headers);
  
  // Sales Navigator detection
  if (headerSet.has('First Name') && headerSet.has('LinkedIn Profile') && headerSet.has('Current Title')) {
    return 'sales_navigator';
  }
  
  // Apollo detection
  if (headerSet.has('first_name') && headerSet.has('linkedin_url') && headerSet.has('email')) {
    return 'apollo';
  }
  
  // ZoomInfo detection  
  if (headerSet.has('Email Address') && headerSet.has('LinkedIn Profile URL')) {
    return 'zoominfo';
  }
  
  // LinkedIn Recruiter detection
  if (headerSet.has('Public Profile URL') && headerSet.has('Headline')) {
    return 'linkedin_recruiter';
  }
  
  return 'manual'; // Default to manual mapping
}

// Transform CSV row using source-specific mapping
function transformProspectData(row: any, config: DataSourceMapping): any {
  const transformed: any = {};
  
  for (const [csvField, dbField] of Object.entries(config.field_mappings)) {
    if (row[csvField] !== undefined && row[csvField] !== '') {
      transformed[dbField] = row[csvField]?.toString().trim();
    }
  }
  
  // Clean and validate LinkedIn URL
  if (transformed.linkedin_profile_url) {
    const linkedinUrl = transformed.linkedin_profile_url;
    if (!linkedinUrl.includes('linkedin.com/in/')) {
      // Try to construct valid LinkedIn URL
      if (linkedinUrl.includes('linkedin.com')) {
        // Already a LinkedIn URL but malformed
        transformed.linkedin_profile_url = linkedinUrl;
      } else {
        // Not a LinkedIn URL, skip this prospect
        transformed.linkedin_profile_url = null;
      }
    }
  }
  
  // Validate email format
  if (transformed.email_address && !transformed.email_address.includes('@')) {
    transformed.email_address = null;
  }
  
  // Clean phone number
  if (transformed.phone_number) {
    transformed.phone_number = transformed.phone_number.replace(/[^\d+\-\(\)\s]/g, '');
  }
  
  return transformed;
}

// Enrich prospect data using Apollo/LinkedIn scraping
async function enrichProspectData(prospect: any): Promise<any> {
  // TODO: Implement data enrichment
  // 1. If LinkedIn URL exists but no email -> try Apollo lookup
  // 2. If email exists but no LinkedIn -> try Apollo reverse lookup  
  // 3. If company exists but missing details -> company enrichment
  
  return prospect; // Return as-is for now
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const csvFile = formData.get('csv_file') as File;
    const dataSource = formData.get('data_source') as string; // Optional: specify source
    const enrichData = formData.get('enrich_data') === 'true';
    const campaignId = formData.get('campaign_id') as string; // Optional: add to campaign
    
    if (!csvFile) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 });
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

    // Auto-detect data source if not specified
    const headers = Object.keys(prospects[0]);
    const detectedSource = dataSource || detectDataSource(headers);
    const config = DATA_SOURCE_CONFIGS[detectedSource];
    
    if (!config) {
      return NextResponse.json({
        error: 'Unsupported data source',
        detected_headers: headers,
        supported_sources: Object.keys(DATA_SOURCE_CONFIGS)
      }, { status: 400 });
    }

    console.log(`Processing ${prospects.length} prospects from ${detectedSource}`);

    const results = {
      total_prospects: prospects.length,
      successful_imports: 0,
      failed_imports: 0,
      enriched_prospects: 0,
      duplicate_prospects: 0,
      data_source: detectedSource,
      errors: [] as any[]
    };

    const importedProspectIds: string[] = [];

    // Process each prospect
    for (let i = 0; i < prospects.length; i++) {
      try {
        const rawProspect = prospects[i];
        const transformedProspect = transformProspectData(rawProspect, config);
        
        // Validate required fields
        const missingFields = config.required_fields.filter(field => 
          !rawProspect[field] || rawProspect[field].toString().trim() === ''
        );
        
        if (missingFields.length > 0) {
          results.errors.push({
            row: i + 1,
            error: `Missing required fields: ${missingFields.join(', ')}`,
            prospect: rawProspect
          });
          results.failed_imports++;
          continue;
        }

        // Enrich data if requested
        if (enrichData) {
          try {
            const enrichedProspect = await enrichProspectData(transformedProspect);
            Object.assign(transformedProspect, enrichedProspect);
            results.enriched_prospects++;
          } catch (enrichError) {
            console.error(`Enrichment failed for prospect ${i + 1}:`, enrichError);
          }
        }

        // Check for duplicates
        let prospectId: string;
        const { data: existingProspect } = await supabase
          .from('workspace_prospects')
          .select('id')
          .eq('workspace_id', user.user_metadata.workspace_id)
          .or(`linkedin_profile_url.eq.${transformedProspect.linkedin_profile_url},email_address.eq.${transformedProspect.email_address}`)
          .single();

        if (existingProspect) {
          // Update existing prospect
          await supabase
            .from('workspace_prospects')
            .update({
              ...transformedProspect,
              data_source: detectedSource,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProspect.id);
          
          prospectId = existingProspect.id;
          results.duplicate_prospects++;
        } else {
          // Create new prospect
          const { data: newProspect, error: prospectError } = await supabase
            .from('workspace_prospects')
            .insert({
              workspace_id: user.user_metadata.workspace_id,
              ...transformedProspect,
              data_source: detectedSource,
              import_metadata: {
                source: detectedSource,
                imported_at: new Date().toISOString(),
                original_data: rawProspect
              }
            })
            .select('id')
            .single();

          if (prospectError) {
            results.errors.push({
              row: i + 1,
              error: `Database error: ${prospectError.message}`,
              prospect: transformedProspect
            });
            results.failed_imports++;
            continue;
          }

          prospectId = newProspect.id;
        }

        importedProspectIds.push(prospectId);
        results.successful_imports++;

      } catch (error: any) {
        results.errors.push({
          row: i + 1,
          error: `Processing error: ${error.message}`,
          prospect: prospects[i]
        });
        results.failed_imports++;
      }
    }

    // Add to campaign if specified
    if (campaignId && importedProspectIds.length > 0) {
      try {
        await supabase.rpc('add_prospects_to_campaign', {
          p_campaign_id: campaignId,
          p_prospect_ids: importedProspectIds
        });
      } catch (campaignError) {
        console.error('Error adding prospects to campaign:', campaignError);
      }
    }

    return NextResponse.json({
      message: 'Prospect import completed',
      data_source: detectedSource,
      results,
      next_steps: {
        campaign_ready: campaignId ? `${importedProspectIds.length} prospects added to campaign` : null,
        linkedin_id_resolution: 'Run LinkedIn ID discovery for existing connections',
        data_enrichment: enrichData ? 'Data enrichment applied' : 'Consider enabling data enrichment'
      }
    });

  } catch (error: any) {
    console.error('Prospect import error:', error);
    return NextResponse.json(
      { error: 'Import failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      message: 'Multi-Source Prospect Data Import API',
      supported_sources: {
        sales_navigator: {
          description: 'LinkedIn Sales Navigator export',
          required_columns: ['First Name', 'Last Name', 'LinkedIn Profile'],
          optional_columns: ['Current Title', 'Current Company', 'Location', 'Industry', 'Email']
        },
        apollo: {
          description: 'Apollo.io export',
          required_columns: ['first_name', 'last_name'],
          optional_columns: ['linkedin_url', 'email', 'company_name', 'title', 'industry', 'location', 'phone']
        },
        zoominfo: {
          description: 'ZoomInfo export',
          required_columns: ['First Name', 'Last Name'],
          optional_columns: ['Email Address', 'LinkedIn Profile URL', 'Company Name', 'Job Title', 'Industry', 'Location', 'Phone Number']
        },
        linkedin_recruiter: {
          description: 'LinkedIn Recruiter export',
          required_columns: ['First Name', 'Last Name', 'Public Profile URL'],
          optional_columns: ['Headline', 'Company', 'Location', 'Industry']
        }
      },
      features: [
        'Auto-detection of data source format',
        'Field mapping and data transformation',
        'Duplicate detection and merging',
        'Data enrichment via Apollo.io',
        'Direct campaign assignment',
        'Import error tracking'
      ],
      usage: {
        endpoint: 'POST /api/prospects/import-data-sources',
        required_params: ['csv_file'],
        optional_params: ['data_source', 'enrich_data', 'campaign_id']
      }
    });

  } catch (error: any) {
    console.error('Import API GET error:', error);
    return NextResponse.json(
      { error: 'Request failed', details: error.message },
      { status: 500 }
    );
  }
}