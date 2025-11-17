import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeFullName, normalizeCompanyName } from '@/lib/enrich-prospect-name';

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

      prospects.push({
        name: fullName,
        title: prospect.title || '',
        company: { name: cleanCompanyName, industry: prospect.industry || '' },
        location: prospect.location || '',
        contact: {
          email: prospect.email || '',
          linkedin_url: prospect.linkedinUrl || '',
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
      firstFewSkipped: skippedRows.slice(0, 3)
    });

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

    // Find the next available batch number for this user/workspace
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

    console.log('CSV Upload - Creating session with batch_number:', nextBatchNumber);

    // Create approval session
    const { data: session, error: sessionError} = await supabase
      .from('prospect_approval_sessions')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        campaign_name: campaignName,
        campaign_tag: 'csv-import',
        prospect_source: source,
        total_prospects: prospects.length,
        pending_count: prospects.length,
        approved_count: 0,
        rejected_count: 0,
        status: 'active',
        batch_number: nextBatchNumber
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json({ success: false, error: sessionError.message }, { status: 500 });
    }

    // Save prospects to approval data table
    const approvalData = prospects.map(p => ({
      session_id: session.id,
      prospect_id: `csv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspace_id: workspaceId,
      name: p.name,
      title: p.title,
      company: p.company,
      location: p.location,
      contact: p.contact,
      connection_degree: p.connectionDegree,  // Add connection degree to DB
      source: p.source,
      enrichment_score: p.enrichment_score,
      approval_status: p.approval_status
    }));

    const { error: dataError } = await supabase
      .from('prospect_approval_data')
      .insert(approvalData);

    if (dataError) {
      console.error('CSV Upload - Error saving prospects:', dataError);
      console.error('   Message:', dataError.message);
      console.error('   Code:', dataError.code);
      console.error('   Details:', dataError.details);

      // Rollback session
      await supabase.from('prospect_approval_sessions').delete().eq('id', session.id);
      return NextResponse.json({ success: false, error: dataError.message }, { status: 500 });
    }

    // Verify prospects were inserted by checking count in database
    const { count: verifyCount } = await supabase
      .from('prospect_approval_data')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);

    const expectedCount = prospects.length;

    console.log('CSV Upload - Insert verification:', {
      expected: expectedCount,
      verified: verifyCount,
      match: verifyCount === expectedCount,
      session_id: session.id
    });

    if (verifyCount !== expectedCount) {
      console.error(`❌ CSV Upload - Insert count mismatch!`);
      console.error(`   Expected: ${expectedCount}`);
      console.error(`   Verified: ${verifyCount}`);
      console.error(`   Session ID: ${session.id}`);
      console.error(`   ROLLING BACK - This will delete all data!`);

      // Rollback session and any partial data
      await supabase.from('prospect_approval_data').delete().eq('session_id', session.id);
      await supabase.from('prospect_approval_sessions').delete().eq('id', session.id);

      return NextResponse.json({
        success: false,
        error: `Failed to insert all prospects: ${verifyCount}/${expectedCount} inserted`,
        details: 'Database insert verification failed. Check server logs for details.'
      }, { status: 500 });
    }

    console.log(`✅ CSV Upload - Successfully inserted ${verifyCount} prospects`);

    return NextResponse.json({
      success: true,
      session_id: session.id,
      workspace_id: workspaceId,
      count: prospects.length,
      campaign_name: campaignName,
      message: `Successfully uploaded ${prospects.length} prospects. Go to Prospect Approval to review.`
    });

  } catch (error) {
    console.error('CSV upload error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
