
import { NextRequest, NextResponse } from 'next/server';
import { activeCampaignService } from '@/lib/activecampaign';
import { requireAdmin } from '@/lib/security/route-auth';

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function GET(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    // Get auth header for admin verification
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // For now, we'll test the connection and get lists
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'test';

    switch (action) {
      case 'test':
        const testResult = await activeCampaignService.testConnection();
        return NextResponse.json({
          message: 'ActiveCampaign connection test',
          ...testResult
        });

      case 'lists':
        const lists = await activeCampaignService.getLists();
        return NextResponse.json({
          message: 'ActiveCampaign lists retrieved',
          lists
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('ActiveCampaign API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    // Get auth header for admin verification
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const { email, firstName, lastName, listId, additionalData } = await request.json();

    if (!email || !firstName || !lastName || !listId) {
      return NextResponse.json(
        { error: 'Email, firstName, lastName, and listId are required' },
        { status: 400 }
      );
    }

    console.log(`Adding ${email} to ActiveCampaign list ${listId}...`);

    const result = await activeCampaignService.addNewMemberToList(
      email,
      firstName,
      lastName,
      listId,
      additionalData
    );

    if (result.success) {
      return NextResponse.json({
        message: 'Contact added to ActiveCampaign list successfully',
        contactId: result.contactId
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to add contact to ActiveCampaign', details: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('ActiveCampaign API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
