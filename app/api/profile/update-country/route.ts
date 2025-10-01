import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }
    
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
    console.log(`🔄 Attempting to update profile country for user ${user.id} to: ${normalizedCountry}`);
    
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({ 
        profile_country: normalizedCountry,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select();
    
    if (updateError) {
      console.error('❌ Failed to update profile country:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      });
      return NextResponse.json({
        success: false,
        error: 'Failed to update profile country',
        details: updateError.message
      }, { status: 500 });
    }
    
    if (!updateData || updateData.length === 0) {
      console.error('❌ No rows updated - possible RLS policy issue');
      return NextResponse.json({
        success: false,
        error: 'Update failed - check permissions'
      }, { status: 403 });
    }
    
    console.log(`✅ Updated profile country for user ${user.email} to: ${normalizedCountry}`);
    
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
