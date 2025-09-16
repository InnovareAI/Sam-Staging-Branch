import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, prospects, filename, dataSource = 'bulk_upload' } = body;

    if (!workspaceId || !prospects || !Array.isArray(prospects)) {
      return NextResponse.json({ 
        error: 'Missing required fields: workspaceId, prospects (array)' 
      }, { status: 400 });
    }

    const supabase = createClient();

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', (await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', userId)
        .single()).data?.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    // First validate all prospects
    console.log('📝 Validating', prospects.length, 'prospects for bulk upload');
    
    const validationResults: any[] = [];
    const validProspects: any[] = [];
    let invalidCount = 0;
    
    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];
      const messages: string[] = [];
      let status = 'valid';
      
      // Check if at least one identifier is provided
      const hasIdentifier = (
        prospect.email_address || 
        prospect.linkedin_profile_url || 
        prospect.phone_number
      );
      
      if (!hasIdentifier) {
        status = 'invalid';
        messages.push('At least one identifier (email, LinkedIn, or phone) is required');
        invalidCount++;
      }
      
      // Validate email format if provided
      if (prospect.email_address) {
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(prospect.email_address)) {
          status = 'invalid';
          messages.push('Invalid email format');
          invalidCount++;
        }
      }
      
      // Validate LinkedIn URL format if provided
      if (prospect.linkedin_profile_url) {
        if (!prospect.linkedin_profile_url.includes('linkedin.com/')) {
          status = 'warning';
          messages.push('LinkedIn URL should contain linkedin.com');
        }
      }
      
      // Check for recommended fields
      if (!prospect.full_name && !prospect.first_name && !prospect.last_name) {
        status = status === 'invalid' ? 'invalid' : 'warning';
        messages.push('No name provided - consider adding full_name or first/last name');
      }
      
      if (!prospect.company_name) {
        status = status === 'invalid' ? 'invalid' : 'warning';
        messages.push('Company name not provided');
      }
      
      validationResults.push({
        row_number: i + 1,
        validation_status: status,
        validation_messages: messages,
        prospect_data: prospect
      });
      
      if (status === 'valid' || status === 'warning') {
        validProspects.push(prospect);
      }
    }

    console.log('✅ Validation complete:', validProspects.length, 'valid,', invalidCount, 'invalid');

    if (validProspects.length === 0) {
      return NextResponse.json({
        error: 'No valid prospects to upload',
        validation_results: validationResults
      }, { status: 400 });
    }

    // Create upload session for tracking
    const uploadSession = {
      workspace_id: workspaceId,
      filename: filename || 'bulk_upload.csv',
      total_rows: prospects.length,
      processed_rows: 0,
      successful_rows: 0,
      failed_rows: 0,
      skipped_rows: 0,
      upload_status: 'processing',
      new_prospects: 0,
      updated_prospects: 0,
      duplicate_prospects: 0,
      validation_errors: validationResults.filter(r => r.validation_status === 'invalid')
    };

    // Process each valid prospect with automatic deduplication
    const results: any[] = [];
    let newProspects = 0;
    let updatedProspects = 0;
    let duplicateProspects = 0;

    console.log('🔄 Processing', validProspects.length, 'prospects with automatic deduplication');

    for (const prospect of validProspects) {
      try {
        // Use the existing add_or_get_workspace_prospect function for automatic deduplication
        const { data: result, error } = await supabase.rpc('add_or_get_workspace_prospect', {
          p_workspace_id: workspaceId,
          p_email_address: prospect.email_address || null,
          p_linkedin_profile_url: prospect.linkedin_profile_url || null,
          p_phone_number: prospect.phone_number || null,
          p_company_domain: prospect.company_domain || null,
          p_full_name: prospect.full_name || null,
          p_first_name: prospect.first_name || null,
          p_last_name: prospect.last_name || null,
          p_job_title: prospect.job_title || null,
          p_company_name: prospect.company_name || null,
          p_location: prospect.location || null,
          p_data_source: dataSource
        });

        if (error) {
          console.error('Error processing prospect:', error);
          results.push({
            prospect_data: prospect,
            action_taken: 'failed',
            error: error.message,
            prospect_id: null
          });
        } else {
          // Check if this was a new prospect or existing one
          const { data: prospectInfo } = await supabase
            .from('workspace_prospects')
            .select('contact_count, prospect_status, created_at')
            .eq('id', result)
            .single();

          let action = 'created';
          let duplicateReason = null;

          if (prospectInfo) {
            const isNewlyCreated = new Date(prospectInfo.created_at).getTime() > Date.now() - 5000; // Created in last 5 seconds
            
            if (!isNewlyCreated) {
              if (prospectInfo.contact_count > 0) {
                action = 'skipped';
                duplicateReason = `Already contacted (${prospectInfo.contact_count} times)`;
                duplicateProspects++;
              } else {
                action = 'updated';
                duplicateReason = 'Prospect enriched with new data';
                updatedProspects++;
              }
            } else {
              newProspects++;
            }
          }

          results.push({
            prospect_data: prospect,
            action_taken: action,
            duplicate_reason: duplicateReason,
            prospect_id: result
          });
        }
      } catch (error) {
        console.error('Exception processing prospect:', error);
        results.push({
          prospect_data: prospect,
          action_taken: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          prospect_id: null
        });
      }
    }

    const summary = {
      total_uploaded: prospects.length,
      validation_errors: invalidCount,
      valid_prospects: validProspects.length,
      new_prospects: newProspects,
      updated_prospects: updatedProspects,
      duplicate_prospects: duplicateProspects,
      failed_prospects: results.filter(r => r.action_taken === 'failed').length
    };

    console.log('📊 Bulk upload complete:', summary);

    return NextResponse.json({
      success: true,
      summary,
      results,
      validation_results: validationResults,
      message: `Successfully processed ${validProspects.length} prospects. ${newProspects} new, ${updatedProspects} updated, ${duplicateProspects} duplicates automatically handled.`
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}