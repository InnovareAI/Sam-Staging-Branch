import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { normalizeFullName } from '@/lib/enrich-prospect-name'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Create service role client for database operations that bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const datasetName = formData.get('dataset_name') as string || 'CSV Import'
    const action = formData.get('action') as string || 'upload'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    switch (action) {
      case 'upload':
        return await processCSVUpload(supabase, session.user.id, file, datasetName)
      
      case 'validate':
        return await validateCSV(file)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('CSV upload error:', error)
    return NextResponse.json({ 
      error: 'Failed to process CSV upload' 
    }, { status: 500 })
  }
}

async function processCSVUpload(supabase: any, userId: string, file: File, datasetName: string) {
  try {
    // Create service role client for database operations that bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user's workspace via workspace_members
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1);

    if (membershipError || !memberships || memberships.length === 0) {
      console.error('Workspace membership lookup failed:', membershipError);
      return NextResponse.json({
        error: 'Workspace not found',
        details: 'User is not a member of any workspace. Please create or join a workspace first.'
      }, { status: 404 });
    }

    const workspaceId = memberships[0].workspace_id;
    console.log('📤 CSV Upload - Processing for workspace:', workspaceId);

    // Parse CSV
    const csvText = await file.text()
    const csvData = parseCSV(csvText)

    if (!csvData.success) {
      return NextResponse.json({
        error: csvData.error,
        details: csvData.details
      }, { status: 400 })
    }

    const prospects = csvData.data
    console.log('📊 CSV Upload - Parsed prospects:', prospects.length);

    // Check quota (skip for now if function doesn't exist)
    let quotaCheck = { has_quota: true };
    try {
      const { data } = await supabase.rpc('check_approval_quota', {
        p_user_id: userId,
        p_workspace_id: workspaceId,
        p_quota_type: 'campaign_data',
        p_requested_amount: prospects.length
      });
      if (data) quotaCheck = data;
    } catch (quotaError) {
      console.warn('Quota check skipped:', quotaError);
    }

    if (!quotaCheck?.has_quota) {
      return NextResponse.json({
        error: 'Quota exceeded',
        quota_info: quotaCheck,
        prospect_count: prospects.length
      }, { status: 429 })
    }

    // Validate and enrich data
    const validatedData = await validateAndEnrichProspects(prospects)

    // Generate batch_id for grouping this import
    const batchId = `csv_${Date.now()}_${userId.slice(0, 8)}`;
    console.log('📦 CSV Upload - Batch ID:', batchId);

    // =========================================================================
    // CRITICAL FIX: Insert into workspace_prospects (master table)
    // This ensures data is PERSISTED in the database, not just returned to UI
    // =========================================================================

    // Prepare prospects for workspace_prospects table
    const workspaceProspectsData = validatedData.valid.map((p: any) => {
      const nameParts = p.name?.split(' ') || ['Unknown'];
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || '';
      const linkedinUrl = p.linkedinUrl || null;

      // Normalize LinkedIn URL to hash for deduplication
      let linkedinUrlHash = null;
      if (linkedinUrl) {
        linkedinUrlHash = linkedinUrl
          .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
          .split('/')[0]
          .split('?')[0]
          .toLowerCase()
          .trim();
      }

      const email = p.email || null;
      const emailHash = email ? email.toLowerCase().trim() : null;

      return {
        workspace_id: workspaceId,
        linkedin_url: linkedinUrl,
        linkedin_url_hash: linkedinUrlHash,
        email: email,
        email_hash: emailHash,
        first_name: firstName,
        last_name: lastName,
        company: p.company || null,
        title: p.title || null,
        location: p.location || null,
        phone: p.phone || null,
        source: 'csv_upload',
        batch_id: batchId,
        approval_status: 'pending',  // REQUIRES APPROVAL
        enrichment_data: {
          original_name: p.name,
          confidence: p.confidence || 0.7
        }
      };
    });

    // Insert with upsert to handle duplicates gracefully
    let insertedCount = 0;
    const insertErrors: string[] = [];
    const BATCH_SIZE = 100;

    console.log('💾 CSV Upload - Inserting into workspace_prospects:', workspaceProspectsData.length, 'records');

    for (let i = 0; i < workspaceProspectsData.length; i += BATCH_SIZE) {
      const batch = workspaceProspectsData.slice(i, i + BATCH_SIZE);

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('workspace_prospects')
        .upsert(batch, {
          onConflict: 'workspace_id,linkedin_url_hash',
          ignoreDuplicates: false  // Update existing records
        })
        .select('id');

      if (insertError) {
        console.error(`CSV Upload - Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, insertError);
        insertErrors.push(insertError.message);
      } else {
        insertedCount += inserted?.length || 0;
        console.log(`✅ CSV Upload - Batch ${Math.floor(i / BATCH_SIZE) + 1} inserted:`, inserted?.length);
      }
    }

    // Count how many are actually new pending approvals
    const { count: newPendingCount } = await supabaseAdmin
      .from('workspace_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('batch_id', batchId)
      .eq('approval_status', 'pending');

    console.log('📊 CSV Upload - workspace_prospects results:', {
      attempted: workspaceProspectsData.length,
      inserted: insertedCount,
      newPending: newPendingCount,
      batchId
    });

    // =========================================================================
    // Create prospect_approval_sessions record for the approval UI
    // =========================================================================

    // Get next batch number
    const { data: existingSessions } = await supabaseAdmin
      .from('prospect_approval_sessions')
      .select('batch_number')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .order('batch_number', { ascending: false })
      .limit(1);

    const nextBatchNumber = existingSessions && existingSessions.length > 0
      ? (existingSessions[0].batch_number || 0) + 1
      : 1;

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('prospect_approval_sessions')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        campaign_id: null,  // Will be assigned when user selects campaign
        campaign_name: datasetName,
        campaign_tag: 'csv-import',
        prospect_source: 'csv_upload',
        total_prospects: newPendingCount || validatedData.valid.length,
        pending_count: newPendingCount || validatedData.valid.length,
        approved_count: 0,
        rejected_count: 0,
        status: 'active',  // Requires approval
        batch_number: nextBatchNumber,
        metadata: { batch_id: batchId, filename: file.name }
      })
      .select()
      .single();

    if (sessionError) {
      console.error('CSV Upload - Error creating approval session:', sessionError);
      // Don't fail - workspace_prospects is the primary data
    } else {
      console.log('✅ CSV Upload - Created approval session:', session?.id);
    }

    // =========================================================================
    // Also insert into prospect_approval_data for the approval UI to show individual records
    // =========================================================================
    if (session?.id) {
      const approvalData = validatedData.valid.map((p: any) => ({
        session_id: session.id,
        workspace_id: workspaceId,
        prospect_id: p.id,
        name: p.name,
        title: p.title || '',
        company: { name: p.company || '', industry: '' },
        contact: {
          email: p.email || '',
          linkedin_url: p.linkedinUrl || '',
          phone: p.phone || ''
        },
        location: p.location || '',
        connection_degree: null,
        enrichment_score: Math.round((p.confidence || 0.7) * 100),
        source: 'csv-upload',
        approval_status: 'pending'
      }));

      // Insert approval data in batches
      for (let i = 0; i < approvalData.length; i += BATCH_SIZE) {
        const batch = approvalData.slice(i, i + BATCH_SIZE);
        const { error: approvalError } = await supabaseAdmin
          .from('prospect_approval_data')
          .insert(batch);

        if (approvalError) {
          console.warn(`CSV Upload - Approval data batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, approvalError.message);
        }
      }
      console.log('✅ CSV Upload - Created prospect_approval_data records:', approvalData.length);
    }

    return NextResponse.json({
      success: true,
      session_id: session?.id || batchId,
      batch_id: batchId,
      workspace_id: workspaceId,
      session: session,
      validation_results: {
        total_records: prospects.length,
        valid_records: validatedData.valid.length,
        invalid_records: validatedData.invalid.length,
        duplicates: validatedData.duplicates.length,
        quality_score: validatedData.quality_score,
        completeness_score: validatedData.completeness_score,
        missing_linkedin_count: validatedData.missing_linkedin_count
      },
      database_results: {
        workspace_prospects_inserted: insertedCount,
        pending_approval: newPendingCount,
        errors: insertErrors
      },
      quota_info: quotaCheck,
      preview_data: validatedData.processed.slice(0, 5),
      requires_approval: true,
      approval_message: 'Prospects have been saved to database. Please review and approve them in the Approval section.',
      info: {
        linkedin_export_limit: 'LinkedIn limits CSV exports to ~1,000 connections (basic accounts) or ~2,500 connections (Premium/Sales Navigator). Our system supports up to 2,500 prospects per upload.',
        max_upload_size: 2500
      }
    })

  } catch (error) {
    console.error('Process CSV upload error:', error)
    return NextResponse.json({
      error: 'Failed to process CSV upload',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

async function validateCSV(file: File) {
  try {
    const csvText = await file.text()
    const csvData = parseCSV(csvText)
    
    if (!csvData.success) {
      return NextResponse.json({ 
        error: csvData.error,
        details: csvData.details 
      }, { status: 400 })
    }

    const prospects = csvData.data
    const validation = await validateAndEnrichProspects(prospects)

    return NextResponse.json({
      success: true,
      validation_results: {
        total_records: prospects.length,
        valid_records: validation.valid.length,
        invalid_records: validation.invalid.length,
        duplicates: validation.duplicates.length,
        quality_score: validation.quality_score,
        completeness_score: validation.completeness_score,
        field_mapping: csvData.field_mapping,
        detected_fields: csvData.detected_fields
      },
      preview_data: prospects.slice(0, 5),
      issues: validation.issues,
      info: {
        linkedin_export_limit: 'LinkedIn limits CSV exports to ~1,000 connections (basic accounts) or ~2,500 connections (Premium/Sales Navigator). Our system supports up to 2,500 prospects per upload.',
        max_upload_size: 2500
      }
    })

  } catch (error) {
    console.error('Validate CSV error:', error)
    return NextResponse.json({ error: 'Failed to validate CSV' }, { status: 500 })
  }
}

function parseCSV(csvText: string) {
  try {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      return { 
        success: false, 
        error: 'CSV must have at least a header row and one data row' 
      }
    }

    // Detect delimiter (tab or comma)
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    console.log('Detected delimiter:', delimiter === '\t' ? 'TAB' : 'COMMA');

    // Parse header
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''))
    console.log('Detected headers:', headers)
    
    // Detect field mapping
    const fieldMapping = detectFieldMapping(headers)
    
    // Check if we have at least one way to identify prospects
    const hasName = fieldMapping.name || (fieldMapping.first_name && fieldMapping.last_name);
    const hasIdentifier = hasName || fieldMapping.email || fieldMapping.linkedin;
    
    if (!hasIdentifier) {
      return {
        success: false,
        error: 'CSV must contain at least one of: name (or first_name+last_name), email, or LinkedIn URL columns',
        details: {
          detected_headers: headers,
          required_fields: ['name/first_name+last_name', 'email', 'linkedin_url/profile_link']
        }
      }
    }

    // Parse data rows
    const data = []
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ''))
      
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} values but ${headers.length} headers`)
        continue
      }

      const prospect: any = {}
      headers.forEach((header, index) => {
        const value = values[index]
        if (value) {
          prospect[header.toLowerCase().replace(/\s+/g, '_')] = value
        }
      })

      // Map to standard fields
      const standardProspect = mapToStandardFields(prospect, fieldMapping)
      if (standardProspect.name || standardProspect.email || standardProspect.linkedinUrl) {
        data.push(standardProspect)
      }
    }

    return {
      success: true,
      data: data,
      field_mapping: fieldMapping,
      detected_fields: headers
    }

  } catch (error) {
    return { 
      success: false, 
      error: 'Failed to parse CSV file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function detectFieldMapping(headers: string[]) {
  const mapping: any = {}
  
  headers.forEach(header => {
    const lowerHeader = header.toLowerCase().replace(/_/g, '')
    
    // First name detection
    if (lowerHeader.includes('firstname') || lowerHeader === 'first') {
      mapping.first_name = header
    }
    
    // Last name detection
    if (lowerHeader.includes('lastname') || lowerHeader === 'last') {
      mapping.last_name = header
    }
    
    // Name detection (full name)
    if (!mapping.first_name && !mapping.last_name && (lowerHeader.includes('name') || lowerHeader === 'contact')) {
      mapping.name = header
    }
    
    // Email detection
    if (lowerHeader.includes('email') || lowerHeader.includes('mail')) {
      mapping.email = header
    }
    
    // LinkedIn detection (support profile_link, linkedin_url, etc.)
    if (lowerHeader.includes('linkedin') || lowerHeader.includes('profilelink') || lowerHeader.includes('profileurl') || lowerHeader.includes('profile')) {
      mapping.linkedin = header
    }
    
    // Title detection
    if (lowerHeader.includes('title') || lowerHeader.includes('position') || lowerHeader.includes('job')) {
      mapping.title = header
    }
    
    // Company detection
    if (lowerHeader.includes('company') || lowerHeader.includes('organization') || lowerHeader.includes('employer')) {
      mapping.company = header
    }
    
    // Phone detection
    if (lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('tel')) {
      mapping.phone = header
    }
    
    // Location detection
    if (lowerHeader.includes('location') || lowerHeader.includes('city') || lowerHeader.includes('address')) {
      mapping.location = header
    }
  })
  
  console.log('Field mapping:', mapping);
  return mapping
}

function mapToStandardFields(prospect: any, fieldMapping: any) {
  const mapped: any = {
    id: `csv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source: 'csv_upload'
  }

  // Handle first_name + last_name with normalization
  let rawName = '';
  if (fieldMapping.first_name && fieldMapping.last_name) {
    const firstName = prospect[fieldMapping.first_name.toLowerCase().replace(/\s+/g, '_')] || '';
    const lastName = prospect[fieldMapping.last_name.toLowerCase().replace(/\s+/g, '_')] || '';
    rawName = `${firstName} ${lastName}`.trim();
  } else if (fieldMapping.name && prospect[fieldMapping.name.toLowerCase().replace(/\s+/g, '_')]) {
    rawName = prospect[fieldMapping.name.toLowerCase().replace(/\s+/g, '_')]
  }

  // Normalize the name to remove titles, credentials, and descriptions
  if (rawName) {
    const normalized = normalizeFullName(rawName);
    mapped.name = normalized.fullName;
  }
  
  if (fieldMapping.email && prospect[fieldMapping.email.toLowerCase().replace(/\s+/g, '_')]) {
    mapped.email = prospect[fieldMapping.email.toLowerCase().replace(/\s+/g, '_')]
  }
  
  if (fieldMapping.linkedin && prospect[fieldMapping.linkedin.toLowerCase().replace(/\s+/g, '_')]) {
    mapped.linkedinUrl = prospect[fieldMapping.linkedin.toLowerCase().replace(/\s+/g, '_')]
  }
  
  if (fieldMapping.title && prospect[fieldMapping.title.toLowerCase().replace(/\s+/g, '_')]) {
    mapped.title = prospect[fieldMapping.title.toLowerCase().replace(/\s+/g, '_')]
  }
  
  if (fieldMapping.company && prospect[fieldMapping.company.toLowerCase().replace(/\s+/g, '_')]) {
    mapped.company = prospect[fieldMapping.company.toLowerCase().replace(/\s+/g, '_')]
  }
  
  if (fieldMapping.phone && prospect[fieldMapping.phone.toLowerCase().replace(/\s+/g, '_')]) {
    mapped.phone = prospect[fieldMapping.phone.toLowerCase().replace(/\s+/g, '_')]
  }
  
  if (fieldMapping.location && prospect[fieldMapping.location.toLowerCase().replace(/\s+/g, '_')]) {
    mapped.location = prospect[fieldMapping.location.toLowerCase().replace(/\s+/g, '_')]
  }
  
  return mapped
}

async function validateAndEnrichProspects(prospects: any[]) {
  const valid = []
  const invalid = []
  const duplicates = []
  const issues = []
  let missingLinkedInCount = 0
  
  const seenEmails = new Set()
  const seenLinkedIn = new Set()
  
  for (const prospect of prospects) {
    let isValid = true
    let prospectIssues = []
    
    // LinkedIn URL is REQUIRED for LinkedIn campaigns
    if (!prospect.linkedinUrl) {
      isValid = false
      missingLinkedInCount++
      prospectIssues.push('Missing LinkedIn URL (required for LinkedIn campaigns)')
    }
    
    // Check for required fields
    if (!prospect.name && !prospect.email) {
      isValid = false
      prospectIssues.push('Missing both name and email')
    }
    
    // Validate email format
    if (prospect.email && !isValidEmail(prospect.email)) {
      isValid = false
      prospectIssues.push('Invalid email format')
    }
    
    // Check for duplicates
    if (prospect.email && seenEmails.has(prospect.email)) {
      duplicates.push(prospect)
      prospectIssues.push('Duplicate email')
    } else if (prospect.email) {
      seenEmails.add(prospect.email)
    }
    
    if (prospect.linkedinUrl && seenLinkedIn.has(prospect.linkedinUrl)) {
      duplicates.push(prospect)
      prospectIssues.push('Duplicate LinkedIn URL')
    } else if (prospect.linkedinUrl) {
      seenLinkedIn.add(prospect.linkedinUrl)
    }
    
    // Calculate confidence score
    prospect.confidence = calculateConfidenceScore(prospect)
    
    if (isValid) {
      valid.push(prospect)
    } else {
      invalid.push(prospect)
      issues.push({
        prospect: prospect,
        issues: prospectIssues
      })
    }
  }
  
  // Calculate quality scores
  const qualityScore = valid.length / prospects.length
  const completenessScore = calculateCompleteness(valid)
  
  return {
    processed: valid,
    valid: valid,
    invalid: invalid,
    duplicates: duplicates,
    issues: issues,
    quality_score: qualityScore,
    completeness_score: completenessScore,
    missing_linkedin_count: missingLinkedInCount,
    linkedin_url_required: true
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function calculateConfidenceScore(prospect: any): number {
  let score = 0
  if (prospect.name) score += 0.2
  if (prospect.email && isValidEmail(prospect.email)) score += 0.3
  if (prospect.title) score += 0.2
  if (prospect.company) score += 0.2
  if (prospect.linkedinUrl) score += 0.1
  return Math.round(score * 100) / 100
}

function calculateCompleteness(prospects: any[]): number {
  if (!prospects.length) return 0
  
  const requiredFields = ['name', 'title', 'company']
  let totalCompleteness = 0
  
  prospects.forEach(prospect => {
    const filledFields = requiredFields.filter(field => prospect[field]).length
    totalCompleteness += filledFields / requiredFields.length
  })
  
  return Math.round((totalCompleteness / prospects.length) * 100) / 100
}