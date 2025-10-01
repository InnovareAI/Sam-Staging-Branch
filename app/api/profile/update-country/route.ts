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
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        profile_country: normalizedCountry,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('Failed to update profile country:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to update profile country'
      }, { status: 500 });
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
