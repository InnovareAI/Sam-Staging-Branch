import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeFullName, normalizeCompanyName } from '@/lib/enrich-prospect-name';

// Allow up to 60 seconds for CSV uploads (Netlify Pro limit)
// This is needed for large CSV files with 50+ prospects
export const maxDuration = 60;

/**
 * Detect Sales Navigator URLs (which are NOT supported)
 *
 * Sales Navigator URLs use encrypted IDs that cannot be converted to regular LinkedIn profile URLs.
 * Example: https://www.linkedin.com/sales/lead/ACwAAFvDKocBkeHV8FCRfQlmLM8S5b9feZ7Kh4E,NAME,abc
 *
 * Users must provide regular LinkedIn profile URLs instead:
 * Example: https://www.linkedin.com/in/john-smith-12345
 *
 * To get the real LinkedIn URL from Sales Navigator:
 * 1. Click on the prospect in Sales Navigator
 * 2. Click "View profile on LinkedIn" button
 * 3. Copy the actual LinkedIn profile URL
 */
function detectSalesNavUrl(url: string): boolean {
  if (!url || !url.trim()) {
    return false;
  }

  const trimmedUrl = url.trim();

  // Detect Sales Navigator URLs
  return trimmedUrl.includes('/sales/lead/') || trimmedUrl.includes('/sales/account/');
}

/**
 * Detect LinkedIn URLs with Unicode/fancy characters
 *
 * These URLs look valid but won't resolve to real profiles because LinkedIn
 * vanity URLs only support ASCII characters.
 *
 * Examples of invalid URLs:
 * - https://linkedin.com/in/𝗖𝗵𝗮𝗿𝗶𝘀𝘀𝗮-𝗦𝗮𝗻𝗶𝗲𝗹-123 (bold Unicode)
 * - https://linkedin.com/in/%F0%9D%97%96... (URL-encoded Unicode)
 */
function hasUnicodeInLinkedInUrl(url: string): boolean {
  if (!url || !url.trim()) {
    return false;
  }

  const trimmed = url.trim();

  // Check for URL-encoded Unicode characters (fancy fonts like 𝗕𝗼𝗹𝗱 𝗧𝗲𝘅𝘁)
  // These encode as %F0%9D%XX (Mathematical Bold), %E2%80 (general punctuation), etc.
  if (/%F0%9D|%E2%80|%C2%A0|%E2%9C/i.test(trimmed)) {
    return true;
  }

  // Check for actual Unicode characters (non-ASCII) in the vanity
  // Extract the vanity slug from the URL
  const vanityMatch = trimmed.match(/linkedin\.com\/in\/([^\/\?#]+)/);
  if (vanityMatch) {
    try {
      const vanity = decodeURIComponent(vanityMatch[1]);
      // Check for non-ASCII characters
      if (/[^\x00-\x7F]/.test(vanity)) {
        return true;
      }
    } catch {
      // If decodeURIComponent fails, the URL is malformed
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Get user authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Create user client for authentication
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication'
      }, { status: 401 });
    }

    // Create service role client for database operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const campaignName = formData.get('campaign_name') as string || 'CSV Upload';
    let campaignId = formData.get('campaign_id') as string || null;
    const source = formData.get('source') as string || 'csv-upload';
    const workspaceId = formData.get('workspace_id') as string;

    // Validate workspace_id is provided
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'No workspace ID provided' }, { status: 400 });
    }

    // Verify user has access to this workspace
    const { data: memberCheck, error: memberError } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (memberError || !memberCheck) {
      console.error('CSV Upload - User not authorized for workspace:', {
        userId: user.id,
        workspaceId,
        error: memberError?.message
      });
      return NextResponse.json({
        success: false,
        error: 'You do not have access to this workspace'
      }, { status: 403 });
    }

    console.log('CSV Upload - Workspace access verified:', {
      userId: user.id,
      workspaceId,
      role: memberCheck.role
    });

    // AUTO-CREATE CAMPAIGN IF NONE PROVIDED
    // This prevents prospects from being orphaned in prospect_approval_data
    if (!campaignId) {
      console.log('CSV Upload - No campaign_id provided, auto-creating campaign...');

      // Generate a campaign name based on date if not provided
      const today = new Date().toISOString().split('T')[0];
      const autoCampaignName = campaignName || `${today} CSV Upload`;

      const { data: newCampaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          workspace_id: workspaceId,
          created_by: user.id,  // Column is 'created_by', not 'user_id'
          name: autoCampaignName,
          campaign_type: 'email',  // CSV uploads are typically email campaigns
          status: 'draft',
          message_templates: {
            connection_request: '',
            follow_ups: []
          },
          metadata: {
            auto_created: true,
            source: 'csv-upload'
          }
        })
        .select()
        .single();

      if (campaignError) {
        console.error('CSV Upload - Failed to auto-create campaign:', campaignError);
        return NextResponse.json({
          success: false,
          error: 'Failed to create campaign for prospects'
        }, { status: 500 });
      }

      campaignId = newCampaign.id;
      console.log('CSV Upload - Auto-created campaign:', {
        campaignId: newCampaign.id,
        campaignName: autoCampaignName
      });
    }

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Parse CSV file
    const text = await file.text();

    // Helper function to parse CSV line properly (handles quoted fields)
    function parseCSVLine(line: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          // Handle escaped quotes ("")
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      result.push(current.trim());
      return result;
    }

    const lines = text.trim().split('\n');

    console.log('CSV Parsing - File info:', {
      fileName: file.name,
      fileSize: file.size,
      totalLines: lines.length,
      firstLine: lines[0]?.substring(0, 200),
      secondLine: lines[1]?.substring(0, 200)
    });

    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV file is empty or invalid' }, { status: 400 });
    }

    // Parse header using proper CSV parser
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    console.log('CSV Parsing - Detected headers:', headers);

    // Check if degree column exists
    const hasDegreeColumn = headers.some(h =>
      h === 'degree' ||
      h === 'connection degree' ||
      h === 'connection' ||
      h === 'linkedin degree'
    );
    console.log('CSV Parsing - Has degree column:', hasDegreeColumn);

    // Map common header names
    const headerMap: Record<string, string> = {
      'name': 'name',
      'full name': 'name',
      'fullname': 'name',
      'first name': 'firstName',
      'firstname': 'firstName',
      'last name': 'lastName',
      'lastname': 'lastName',
      'title': 'title',
      'job title': 'title',
      'position': 'title',
      'company': 'company',
      'company name': 'company',
      'organization': 'company',
      'email': 'email',
      'e-mail': 'email',
      'linkedin': 'linkedinUrl',
      'linkedin url': 'linkedinUrl',
      'linkedin profile': 'linkedinUrl',
      'profile url': 'linkedinUrl',
      'phone': 'phone',
      'location': 'location',
      'city': 'location',
      'industry': 'industry',
      'degree': 'connectionDegree',           // Connection degree column
      'connection degree': 'connectionDegree',
      'connection': 'connectionDegree',
      'linkedin degree': 'connectionDegree'
    };

    // Parse prospects
    const prospects: any[] = [];
    const skippedRows: any[] = [];
    let salesNavUrlsDetected = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      // Log first row details
      if (i === 1) {
        console.log('CSV Parsing - First data row:', {
          rowIndex: i,
          rawLine: lines[i].substring(0, 200),
          parsedValues: values,
          valueCount: values.length,
          headerCount: headers.length
        });
      }

      if (values.length < headers.length) {
        skippedRows.push({ row: i, reason: 'incomplete', valueCount: values.length, expectedCount: headers.length });
        continue;
      }

      const prospect: any = {};
      headers.forEach((header, index) => {
        const mappedKey = headerMap[header] || header;
        prospect[mappedKey] = values[index] || '';
      });

      // Log mapped prospect for first row
      if (i === 1) {
        console.log('CSV Parsing - Mapped prospect data:', {
          prospect,
          hasName: !!prospect.name,
          hasFirstName: !!prospect.firstName,
          hasLastName: !!prospect.lastName,
          hasLinkedinUrl: !!prospect.linkedinUrl,
          linkedinUrlValue: prospect.linkedinUrl || 'EMPTY/NULL',
          rawConnectionDegree: prospect.connectionDegree,
          connectionDegreeType: typeof prospect.connectionDegree
        });
      }

      // Build prospect object with name normalization
      const rawName = prospect.name || `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim();
      if (!rawName) {
        skippedRows.push({ row: i, reason: 'no name', prospect });
        continue;
      }

      // Normalize the full name to remove titles, credentials, and descriptions
      const normalized = normalizeFullName(rawName);
      const fullName = normalized.fullName;

      // Parse connection degree (1, 2, or 3) - convert "1st", "2nd", "3rd" to numbers
      let connectionDegree = null;
      if (prospect.connectionDegree) {
        const degreeStr = prospect.connectionDegree.toString().toLowerCase();
        if (degreeStr.includes('1') || degreeStr === 'first') connectionDegree = 1;
        else if (degreeStr.includes('2') || degreeStr === 'second') connectionDegree = 2;
        else if (degreeStr.includes('3') || degreeStr === 'third') connectionDegree = 3;
        else if (!isNaN(parseInt(degreeStr))) connectionDegree = parseInt(degreeStr);

        // Log parsing result for first row
        if (i === 1) {
          console.log('CSV Parsing - Connection degree parsing:', {
            raw: prospect.connectionDegree,
            degreeStr,
            parsed: connectionDegree
          });
        }
      }

      // Normalize company name to remove legal suffixes
      const rawCompanyName = prospect.company || '';
      const cleanCompanyName = normalizeCompanyName(rawCompanyName);

      // Detect Sales Navigator URLs and skip them
      const linkedinUrl = prospect.linkedinUrl || '';
      if (detectSalesNavUrl(linkedinUrl)) {
        salesNavUrlsDetected++;
        skippedRows.push({
          row: i,
          reason: 'sales_navigator_url',
          name: rawName,
          linkedin_url: linkedinUrl
        });
        console.warn(`⚠️  Row ${i}: Skipping prospect "${rawName}" - Sales Navigator URL detected. Please provide regular LinkedIn profile URL instead.`);
        continue;  // Skip this prospect
      }

      // Detect URLs with Unicode/fancy characters (won't resolve to real profiles)
      if (linkedinUrl && hasUnicodeInLinkedInUrl(linkedinUrl)) {
        skippedRows.push({
          row: i,
          reason: 'unicode_in_url',
          name: rawName,
          linkedin_url: linkedinUrl
        });
        console.warn(`⚠️  Row ${i}: Skipping prospect "${rawName}" - LinkedIn URL contains fancy/Unicode characters which won't resolve to a real profile.`);
        continue;  // Skip this prospect
      }

      prospects.push({
        name: fullName,
        title: prospect.title || '',
        company: { name: cleanCompanyName, industry: prospect.industry || '' },
        location: prospect.location || '',
        contact: {
          email: prospect.email || '',
          linkedin_url: linkedinUrl,
          phone: prospect.phone || ''
        },
        connectionDegree: connectionDegree,  // Add connection degree
        source: source,
        enrichment_score: 70,
        approval_status: 'pending'
      });
    }

    console.log('CSV Parsing - Results:', {
      totalRows: lines.length - 1,
      prospectsFound: prospects.length,
      rowsSkipped: skippedRows.length,
      salesNavUrlsDetected: salesNavUrlsDetected,
      firstFewSkipped: skippedRows.slice(0, 3)
    });

    // Log Sales Navigator warning
    if (salesNavUrlsDetected > 0) {
      console.warn(`⚠️  Skipped ${salesNavUrlsDetected} prospects with Sales Navigator URLs - these cannot be used for campaigns`);
      console.warn(`   To fix: Open each prospect in Sales Navigator → Click "View on LinkedIn" → Copy the real LinkedIn URL`);
    }

    if (prospects.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid prospects found in CSV',
        debug: {
          headers,
          totalRows: lines.length - 1,
          skippedRows: skippedRows.slice(0, 5)
        }
      }, { status: 400 });
    }

    // Quota limit: Max 2,500 prospects per upload to prevent timeouts
    const MAX_PROSPECTS_PER_UPLOAD = 2500;
    if (prospects.length > MAX_PROSPECTS_PER_UPLOAD) {
      return NextResponse.json({
        success: false,
        error: `Too many prospects (${prospects.length}). Maximum ${MAX_PROSPECTS_PER_UPLOAD} prospects per upload.`,
        suggestion: 'Please split your CSV into smaller files.'
      }, { status: 400 });
    }

    // =========================================================================
    // NEW ARCHITECTURE: Insert into workspace_prospects (master table)
    // CSV uploads now REQUIRE approval before going to campaigns
    // Database-driven deduplication via unique constraint on linkedin_url_hash
    // =========================================================================

    // Generate batch_id for grouping this import
    const batchId = `csv_${Date.now()}_${user.id.slice(0, 8)}`;

    console.log('CSV Upload - NEW ARCHITECTURE: Inserting into workspace_prospects with batch_id:', batchId);

    // Prepare prospects for workspace_prospects table
    const workspaceProspectsData = prospects.map(p => {
      const nameParts = p.name?.split(' ') || ['Unknown'];
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || '';
      const linkedinUrl = p.contact?.linkedin_url || null;

      // Normalize LinkedIn URL to hash (same logic as trigger, for upsert conflict detection)
      let linkedinUrlHash = null;
      if (linkedinUrl) {
        linkedinUrlHash = linkedinUrl
          .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
          .split('/')[0]
          .split('?')[0]
          .toLowerCase()
          .trim();
      }

      const email = p.contact?.email || null;
      const emailHash = email ? email.toLowerCase().trim() : null;

      return {
        workspace_id: workspaceId,
        linkedin_url: linkedinUrl,
        linkedin_url_hash: linkedinUrlHash,
        email: email,
        email_hash: emailHash,
        first_name: firstName,
        last_name: lastName,
        company: p.company?.name || null,
        title: p.title || null,
        location: p.location || null,
        phone: p.contact?.phone || null,
        connection_degree: p.connectionDegree || null,
        source: 'csv_upload',
        batch_id: batchId,
        approval_status: 'pending',  // REQUIRES APPROVAL
        enrichment_data: {
          original_name: p.name,
          industry: p.company?.industry || null,
          enrichment_score: p.enrichment_score || 70
        }
      };
    });

    // Insert with upsert to handle duplicates gracefully
    // ON CONFLICT: Update enrichment data but preserve approval_status
    let insertedCount = 0;
    let duplicateCount = 0;
    const insertErrors: string[] = [];

    // Process in batches to handle large uploads
    const BATCH_SIZE = 100;
    for (let i = 0; i < workspaceProspectsData.length; i += BATCH_SIZE) {
      const batch = workspaceProspectsData.slice(i, i + BATCH_SIZE);

      const { data: inserted, error: insertError } = await supabase
        .from('workspace_prospects')
        .upsert(batch, {
          onConflict: 'workspace_id,linkedin_url_hash',
          ignoreDuplicates: false  // Update existing records
        })
        .select('id, linkedin_url_hash');

      if (insertError) {
        console.error(`CSV Upload - Batch ${i / BATCH_SIZE + 1} error:`, insertError);
        insertErrors.push(insertError.message);
      } else {
        insertedCount += inserted?.length || 0;
      }
    }

    // Count how many are actually new vs updated (approximation)
    const { count: newPendingCount } = await supabase
      .from('workspace_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('batch_id', batchId)
      .eq('approval_status', 'pending');

    console.log('CSV Upload - workspace_prospects results:', {
      attempted: workspaceProspectsData.length,
      inserted: insertedCount,
      newPending: newPendingCount,
      batchId
    });

    // LEGACY SUPPORT: Also create session in prospect_approval_sessions for backwards compatibility
    // This allows existing UI to show the import until we update the frontend
    const { data: existingSessions } = await supabase
      .from('prospect_approval_sessions')
      .select('batch_number')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .order('batch_number', { ascending: false })
      .limit(1);

    const nextBatchNumber = existingSessions && existingSessions.length > 0
      ? (existingSessions[0].batch_number || 0) + 1
      : 1;

    const { data: session, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        campaign_id: campaignId,
        campaign_name: campaignName,
        campaign_tag: 'csv-import',
        prospect_source: source,
        total_prospects: newPendingCount || prospects.length,
        pending_count: newPendingCount || prospects.length,
        approved_count: 0,
        rejected_count: 0,
        status: 'active',  // Requires approval now
        batch_number: nextBatchNumber,
        // Link to new system
        metadata: { batch_id: batchId, new_architecture: true }
      })
      .select()
      .single();

    if (sessionError) {
      console.error('CSV Upload - Error creating legacy session:', sessionError);
      // Don't fail - workspace_prospects is the primary source now
    }

    // NO AUTO-TRANSFER TO campaign_prospects
    // User must approve prospects first via the approval UI

    // Build user-friendly message
    let message = `Successfully uploaded ${newPendingCount || prospects.length} prospects for approval.`;
    let warning = null;

    if (salesNavUrlsDetected > 0) {
      message = `Uploaded ${newPendingCount || prospects.length} prospects for approval. ${salesNavUrlsDetected} prospects were skipped due to Sales Navigator URLs.`;
      warning = {
        type: 'sales_navigator_urls',
        count: salesNavUrlsDetected,
        message: `${salesNavUrlsDetected} prospects with Sales Navigator URLs were skipped. Sales Navigator URLs cannot be used for campaigns. Please use regular LinkedIn profile URLs instead.`,
        help: 'To get real LinkedIn URLs: 1) Open each prospect in Sales Navigator, 2) Click "View on LinkedIn", 3) Copy the real LinkedIn URL from your browser',
        toolRecommendations: [
          'Use Evaboot.com to automatically extract real LinkedIn URLs from Sales Navigator',
          'Use PhantomBuster Sales Navigator scraper',
          'Manually click through each profile to get real URLs'
        ]
      };
    }

    return NextResponse.json({
      success: true,
      session_id: session?.id || null,
      batch_id: batchId,  // NEW: batch_id for the new architecture
      campaign_id: campaignId,
      workspace_id: workspaceId,
      count: newPendingCount || prospects.length,
      skipped_count: salesNavUrlsDetected,
      campaign_name: campaignName,
      message: message,
      warning: warning,
      // NEW: Indicate prospects need approval
      requires_approval: true,
      approval_message: 'Prospects have been added to your workspace. Please review and approve them before adding to a campaign.'
    });

  } catch (error) {
    console.error('CSV upload error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
