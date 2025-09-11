import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase Admin client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log(`Generating magic link for: ${email}`);

    // Generate magic link using Admin API (bypasses rate limiting)
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${Deno.env.get('SITE_URL') || 'https://app.meet-sam.com'}/auth/callback`
      }
    });

    if (linkError) {
      console.error('Magic link generation error:', linkError);
      return new Response(
        JSON.stringify({ error: linkError.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!linkData?.properties?.action_link) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate magic link' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user info for personalization
    const { data: userData } = await supabaseClient
      .from('users')
      .select('first_name, last_name')
      .eq('email', email)
      .single();

    const firstName = userData?.first_name || 'there';

    // Send email via Postmark
    const postmarkResponse = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': Deno.env.get('POSTMARK_SERVER_TOKEN') ?? ''
      },
      body: JSON.stringify({
        From: 'SAM AI <tl@innovareai.com>',
        To: email,
        Subject: 'Your SAM AI Magic Link 🎯',
        HtmlBody: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(102, 126, 234, 0.3);">
            
            <!-- Header -->
            <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 40px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
              <h1 style="color: white; font-size: 32px; margin: 0; font-weight: 700; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                🎯 SAM AI
              </h1>
              <p style="color: rgba(255, 255, 255, 0.9); font-size: 18px; margin: 10px 0 0 0; font-weight: 300;">
                Your AI Sales Assistant Platform
              </p>
            </div>

            <!-- Content -->
            <div style="background: white; padding: 50px 40px; text-align: center;">
              <h2 style="color: #2d3748; font-size: 28px; margin: 0 0 20px 0; font-weight: 600;">
                Welcome back, ${firstName}! 👋
              </h2>
              
              <p style="color: #4a5568; font-size: 18px; line-height: 1.6; margin-bottom: 35px;">
                Click the magic button below to instantly access your SAM AI dashboard. No password needed!
              </p>

              <!-- Magic Link Button -->
              <div style="margin: 40px 0;">
                <a href="${linkData.properties.action_link}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-weight: 600; font-size: 18px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4); transform: translateY(0); transition: all 0.3s ease;">
                  ✨ Access SAM AI Dashboard
                </a>
              </div>

              <p style="color: #718096; font-size: 16px; margin-top: 35px; line-height: 1.5;">
                This magic link will expire in <strong>30 minutes</strong> for your security.
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f7fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #a0aec0; font-size: 14px; margin: 0; line-height: 1.5;">
                🔒 This is a secure, one-time login link sent to ${email}<br>
                If you didn't request this, you can safely ignore this email.
              </p>
              
              <div style="margin-top: 20px;">
                <p style="color: #cbd5e0; font-size: 12px; margin: 0;">
                  SAM AI - AI-Powered Sales Assistant Platform<br>
                  Built with ❤️ by InnovareAI
                </p>
              </div>
            </div>
          </div>
        `,
        TextBody: `Hi ${firstName}! Click this link to access SAM AI: ${linkData.properties.action_link}

This magic link expires in 30 minutes for your security.

If you didn't request this, you can safely ignore this email.

SAM AI - Your AI-Powered Sales Assistant Platform
Built by InnovareAI`,
        MessageStream: 'outbound'
      })
    });

    if (!postmarkResponse.ok) {
      const errorText = await postmarkResponse.text();
      console.error('Postmark API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const postmarkData = await postmarkResponse.json();
    console.log('Email sent successfully:', postmarkData.MessageID);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Magic link sent to your email - check your inbox!',
        messageId: postmarkData.MessageID
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});