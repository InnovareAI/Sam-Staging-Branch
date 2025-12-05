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

    // IMPORTANT: Do NOT auto-create campaign here
    // Prospects stay in prospect_approval_data until user completes the modal flow
    // Campaign is created only when user proceeds from CampaignTypeModal → PreflightModal → handleProceedToCampaignHub
    // This prevents prospects from being prematurely assigned to campaigns
    if (!campaignId) {
      console.log('CSV Upload - No campaign_id, prospects will remain in approval flow until user creates campaign');
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
      'linkedin degree': 'connectionDegree',
      'website': 'companyWebsite',             // Company website (optional)
      'company website': 'companyWebsite',
      'company_website': 'companyWebsite',
      'company url': 'companyWebsite',
      'url': 'companyWebsite'
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
        companyWebsite: prospect.companyWebsite || null,  // Optional company website
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
    // LEGACY ARCHITECTURE: Insert into prospect_approval_data (working table)
    // NOTE: workspace_prospects has a broken trigger (uuid=text error)
    // Using legacy table until database trigger is fixed
    // =========================================================================

    console.log('CSV Upload - LEGACY: Inserting into prospect_approval_data');

    // Will be set after session is created
    let insertedCount = 0;
    const newPendingCount = prospects.length;

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
        status: 'active',
        batch_number: nextBatchNumber
        // NO metadata - using legacy prospect_approval_data table
      })
      .select()
      .single();

    if (sessionError) {
      console.error('CSV Upload - Error creating session:', sessionError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create approval session'
      }, { status: 500 });
    }

    // Insert prospects into LEGACY prospect_approval_data table
    const prospectRecords = prospects.map((p, idx) => ({
      session_id: session.id,
      prospect_id: `csv_${Date.now()}_${idx}`,
      name: p.name || 'Unknown',
      title: p.title || '',
      company: p.company || { name: '' },
      contact: {
        ...p.contact,
        website: p.companyWebsite || null  // Include company website in contact JSON
      },
      location: p.location || '',
      profile_image: null,
      recent_activity: null,
      connection_degree: p.connectionDegree || null,
      enrichment_score: p.enrichment_score || 70,
      source: 'csv_upload',
      enriched_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('prospect_approval_data')
      .insert(prospectRecords);

    if (insertError) {
      console.error('CSV Upload - Error inserting prospects:', insertError);
      // Session created but prospects failed - still report partial success
    } else {
      insertedCount = prospectRecords.length;
      console.log(`CSV Upload - Inserted ${insertedCount} prospects into prospect_approval_data`);
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
