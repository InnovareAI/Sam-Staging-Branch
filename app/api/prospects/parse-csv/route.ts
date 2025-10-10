import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * POST /api/prospects/parse-csv
 * Parse CSV file and return prospect data
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 });
    }

    // Read CSV file
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empty CSV file'
      }, { status: 400 });
    }

    // Parse CSV headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    // Map common header variations to standard fields
    const fieldMap: Record<string, string[]> = {
      name: ['name', 'full name', 'fullname', 'full_name'],
      firstName: ['first name', 'firstname', 'first_name', 'fname'],
      lastName: ['last name', 'lastname', 'last_name', 'lname'],
      email: ['email', 'email address', 'email_address'],
      title: ['title', 'job title', 'job_title', 'position'],
      company: ['company', 'company name', 'company_name', 'organization'],
      linkedin_url: ['linkedin', 'linkedin url', 'linkedin_url', 'linkedin profile', 'profile url'],
      location: ['location', 'city', 'region', 'country']
    };

    // Find column indices for each field
    const getColumnIndex = (field: string): number => {
      const variations = fieldMap[field] || [field];
      for (const variation of variations) {
        const index = headers.findIndex(h => h.includes(variation));
        if (index !== -1) return index;
      }
      return -1;
    };

    const nameIdx = getColumnIndex('name');
    const firstNameIdx = getColumnIndex('firstName');
    const lastNameIdx = getColumnIndex('lastName');
    const emailIdx = getColumnIndex('email');
    const titleIdx = getColumnIndex('title');
    const companyIdx = getColumnIndex('company');
    const linkedinIdx = getColumnIndex('linkedin_url');
    const locationIdx = getColumnIndex('location');

    // Parse prospect data
    const prospects: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle quoted values)
      const values: string[] = [];
      let currentValue = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Add last value

      // Extract fields
      let name = '';
      let firstName = '';
      let lastName = '';

      if (nameIdx !== -1 && values[nameIdx]) {
        name = values[nameIdx];
        const nameParts = name.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      } else {
        firstName = firstNameIdx !== -1 ? values[firstNameIdx] : '';
        lastName = lastNameIdx !== -1 ? values[lastNameIdx] : '';
        name = `${firstName} ${lastName}`.trim();
      }

      if (!name) continue; // Skip rows without names

      prospects.push({
        name,
        firstName,
        lastName,
        email: emailIdx !== -1 ? values[emailIdx] : '',
        title: titleIdx !== -1 ? values[titleIdx] : '',
        job_title: titleIdx !== -1 ? values[titleIdx] : '',
        company: companyIdx !== -1 ? values[companyIdx] : '',
        company_name: companyIdx !== -1 ? values[companyIdx] : '',
        linkedin_url: linkedinIdx !== -1 ? values[linkedinIdx] : '',
        linkedinUrl: linkedinIdx !== -1 ? values[linkedinIdx] : '',
        location: locationIdx !== -1 ? values[locationIdx] : ''
      });
    }

    console.log(`✅ Parsed ${prospects.length} prospects from CSV`);

    return NextResponse.json({
      success: true,
      prospects,
      count: prospects.length
    });

  } catch (error) {
    console.error('CSV parsing error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse CSV'
    }, { status: 500 });
  }
}
