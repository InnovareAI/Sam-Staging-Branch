import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Authenticate with Firebase
    const { userId, userEmail } = await verifyAuth(request);

    const { country } = await request.json();

    // Validate country code (2-letter)
    if (!country || typeof country !== 'string' || country.length !== 2) {
      return NextResponse.json({
        success: false,
        error: 'Invalid country code. Must be a 2-letter code (e.g., us, de, gb)'
      }, { status: 400 });
    }

    const normalizedCountry = country.toLowerCase();

    // Update user profile country
    console.log(`🔄 Attempting to update profile country for user ${userId} to: ${normalizedCountry}`);

    const result = await pool.query(
      'UPDATE users SET profile_country = $1, updated_at = $2 WHERE id = $3',
      [normalizedCountry, new Date().toISOString(), userId]
    );

    if (result.rowCount === 0) {
      console.error('❌ Failed to update profile country: user not found');
      return NextResponse.json({
        success: false,
        error: 'Failed to update profile country',
        details: 'User not found'
      }, { status: 500 });
    }

    console.log(`✅ Updated profile country for user ${userEmail} to: ${normalizedCountry}`);

    return NextResponse.json({
      success: true,
      country: normalizedCountry,
      message: 'Profile country updated successfully'
    });

  } catch (error) {
    console.error('Update country error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
