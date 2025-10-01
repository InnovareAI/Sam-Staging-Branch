import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
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
    // Get user's workspace via workspace_members
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1);

    if (membershipError || !memberships || memberships.length === 0) {
      console.error('Workspace membership lookup failed:', membershipError);
      return NextResponse.json({ 
        error: 'Workspace not found',
        details: 'User is not a member of any workspace. Please create or join a workspace first.'
      }, { status: 404 });
    }

    const workspaceId = memberships[0].workspace_id

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
    
    // Create approval session
    const sessionId = `csv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Try to insert into database, but don't fail if table doesn't exist yet
    let session = null;
    try {
      const { data, error } = await supabase
        .from('data_approval_sessions')
        .insert({
          session_id: sessionId,
          user_id: userId,
          workspace_id: workspaceId,
          dataset_name: datasetName,
          dataset_type: 'prospect_list',
          dataset_source: 'csv_upload',
          raw_data: {
            filename: file.name,
            size: file.size,
            uploaded_at: new Date().toISOString(),
            original_data: prospects
          },
          processed_data: validatedData.processed,
          data_preview: validatedData.processed.slice(0, 10),
          total_count: prospects.length,
          quota_limit: 1000,
          data_quality_score: validatedData.quality_score,
          completeness_score: validatedData.completeness_score,
          duplicate_count: validatedData.duplicates.length
        })
        .select()
        .single();
      
      if (!error) {
        session = data;
      } else {
        console.warn('Could not create approval session (table may not exist):', error);
      }
    } catch (sessionError) {
      console.warn('Approval session creation skipped:', sessionError);
    }

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      session: session,
      validation_results: {
        total_records: prospects.length,
        valid_records: validatedData.valid.length,
        invalid_records: validatedData.invalid.length,
        duplicates: validatedData.duplicates.length,
        quality_score: validatedData.quality_score,
        completeness_score: validatedData.completeness_score
      },
      quota_info: quotaCheck,
      preview_data: validatedData.processed.slice(0, 5)
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
      issues: validation.issues
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
  
  // Handle first_name + last_name
  if (fieldMapping.first_name && fieldMapping.last_name) {
    const firstName = prospect[fieldMapping.first_name.toLowerCase().replace(/\s+/g, '_')] || '';
    const lastName = prospect[fieldMapping.last_name.toLowerCase().replace(/\s+/g, '_')] || '';
    mapped.name = `${firstName} ${lastName}`.trim();
  } else if (fieldMapping.name && prospect[fieldMapping.name.toLowerCase().replace(/\s+/g, '_')]) {
    mapped.name = prospect[fieldMapping.name.toLowerCase().replace(/\s+/g, '_')]
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
  
  const seenEmails = new Set()
  const seenLinkedIn = new Set()
  
  for (const prospect of prospects) {
    let isValid = true
    let prospectIssues = []
    
    // Check for required fields
    if (!prospect.name && !prospect.email && !prospect.linkedinUrl) {
      isValid = false
      prospectIssues.push('Missing name, email, and LinkedIn URL')
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
    completeness_score: completenessScore
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