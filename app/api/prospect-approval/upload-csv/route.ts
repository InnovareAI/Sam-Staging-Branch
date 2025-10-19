import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Get user's current workspace
    const { data: userData } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData?.current_workspace_id) {
      return NextResponse.json({ success: false, error: 'No workspace found' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const campaignName = formData.get('campaign_name') as string || 'CSV Upload';
    const source = formData.get('source') as string || 'csv-upload';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Parse CSV file
    const text = await file.text();
    const lines = text.trim().split('\n');

    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV file is empty or invalid' }, { status: 400 });
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

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
      'phone': 'phone',
      'location': 'location',
      'city': 'location',
      'industry': 'industry'
    };

    // Parse prospects
    const prospects: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue; // Skip incomplete rows

      const prospect: any = {};
      headers.forEach((header, index) => {
        const mappedKey = headerMap[header] || header;
        prospect[mappedKey] = values[index] || '';
      });

      // Build prospect object
      const fullName = prospect.name || `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim();
      if (!fullName) continue; // Skip if no name

      prospects.push({
        name: fullName,
        title: prospect.title || '',
        company: { name: prospect.company || '', industry: prospect.industry || '' },
        location: prospect.location || '',
        contact: {
          email: prospect.email || '',
          linkedin_url: prospect.linkedinUrl || '',
          phone: prospect.phone || ''
        },
        source: source,
        enrichment_score: 70,
        approval_status: 'pending'
      });
    }

    if (prospects.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid prospects found in CSV' }, { status: 400 });
    }

    // Create approval session
    const { data: session, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .insert({
        workspace_id: userData.current_workspace_id,
        user_id: user.id,
        campaign_name: campaignName,
        campaign_tag: 'csv-import',
        prospect_source: source,
        total_prospects: prospects.length,
        pending_count: prospects.length,
        session_status: 'active'
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
      workspace_id: userData.current_workspace_id,
      name: p.name,
      title: p.title,
      company: p.company,
      location: p.location,
      contact: p.contact,
      source: p.source,
      enrichment_score: p.enrichment_score,
      approval_status: p.approval_status
    }));

    const { error: dataError } = await supabase
      .from('prospect_approval_data')
      .insert(approvalData);

    if (dataError) {
      console.error('Error saving prospects:', dataError);
      // Rollback session
      await supabase.from('prospect_approval_sessions').delete().eq('id', session.id);
      return NextResponse.json({ success: false, error: dataError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session_id: session.id,
      count: prospects.length,
      campaign_name: campaignName
    });

  } catch (error) {
    console.error('CSV upload error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
