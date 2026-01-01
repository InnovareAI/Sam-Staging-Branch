import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/**
 * Research Prospect API
 * Fetches LinkedIn profile and company info for a prospect
 * Used by the Reply Agent edit modal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, token, prospectId, linkedinUrl } = body;

    if (!draftId || !token) {
      return NextResponse.json({ error: 'Missing draftId or token' }, { status: 400 });
    }

    const supabase = pool;

    // Verify the draft exists and token matches
    const { data: draft, error: draftError } = await supabase
      .from('reply_agent_drafts')
      .select('*, campaign_prospects(linkedin_user_id, linkedin_url, company_name)')
      .eq('id', draftId)
      .eq('approval_token', token)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Draft not found or invalid token' }, { status: 404 });
    }

    const research: any = {
      linkedin: null,
      company: null,
      insights: null,
    };

    // Get LinkedIn profile if we have the URL
    const prospectLinkedInUrl = linkedinUrl || draft.prospect_linkedin_url || draft.campaign_prospects?.linkedin_url;

    if (prospectLinkedInUrl && UNIPILE_API_KEY) {
      try {
        // Extract LinkedIn public identifier from URL
        const linkedinMatch = prospectLinkedInUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
        const publicIdentifier = linkedinMatch ? linkedinMatch[1] : null;

        if (publicIdentifier) {
          // Fetch profile from Unipile
          const profileRes = await fetch(
            `https://${UNIPILE_DSN}/api/v1/users/${encodeURIComponent(publicIdentifier)}`,
            {
              method: 'GET',
              headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'Accept': 'application/json',
              },
            }
          );

          if (profileRes.ok) {
            const profile = await profileRes.json();
            research.linkedin = {
              headline: profile.headline || profile.title,
              location: profile.location,
              summary: profile.summary || profile.about,
              connectionDegree: profile.connection_degree,
              followers: profile.followers_count,
              connections: profile.connections_count,
            };

            // Try to get recent posts/activity
            try {
              const postsRes = await fetch(
                `https://${UNIPILE_DSN}/api/v1/users/${encodeURIComponent(publicIdentifier)}/posts?limit=5`,
                {
                  method: 'GET',
                  headers: {
                    'X-API-KEY': UNIPILE_API_KEY,
                    'Accept': 'application/json',
                  },
                }
              );

              if (postsRes.ok) {
                const postsData = await postsRes.json();
                const posts = postsData.items || postsData.posts || [];
                research.linkedin.recentPosts = posts.map((p: any) => p.text || p.content || '').filter(Boolean);
              }
            } catch (postsErr) {
              console.log('Could not fetch posts:', postsErr);
            }
          }
        }
      } catch (linkedinErr) {
        console.error('LinkedIn research error:', linkedinErr);
      }
    }

    // Get company info from existing data or try to fetch
    const companyName = draft.prospect_company || draft.campaign_prospects?.company_name;
    if (companyName) {
      research.company = {
        name: companyName,
        // We could add Apollo or other company lookup here
      };
    }

    // Generate AI insights if we have research data
    if ((research.linkedin || research.company) && OPENROUTER_API_KEY) {
      try {
        const contextParts = [];
        if (research.linkedin?.headline) contextParts.push(`Headline: ${research.linkedin.headline}`);
        if (research.linkedin?.summary) contextParts.push(`About: ${research.linkedin.summary.slice(0, 500)}`);
        if (research.linkedin?.location) contextParts.push(`Location: ${research.linkedin.location}`);
        if (research.company?.name) contextParts.push(`Company: ${research.company.name}`);
        if (draft.prospect_title) contextParts.push(`Title: ${draft.prospect_title}`);

        if (contextParts.length > 0) {
          const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'anthropic/claude-3-haiku',
              messages: [
                {
                  role: 'system',
                  content: 'You are a sales intelligence assistant. Generate 2-3 brief, actionable insights about this prospect that would help personalize an email reply. Focus on conversation hooks, shared interests, or professional talking points. Keep it under 100 words.',
                },
                {
                  role: 'user',
                  content: `Prospect: ${draft.prospect_name}\n${contextParts.join('\n')}\n\nTheir message to us: "${draft.inbound_message_text?.slice(0, 300) || 'N/A'}"`,
                },
              ],
              max_tokens: 200,
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            research.insights = aiData.choices?.[0]?.message?.content;
          }
        }
      } catch (aiErr) {
        console.error('AI insights error:', aiErr);
      }
    }

    // Update the draft with research data
    await supabase
      .from('reply_agent_drafts')
      .update({
        research_linkedin_profile: research.linkedin,
        research_company_profile: research.company,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    return NextResponse.json({
      success: true,
      research,
    });

  } catch (error) {
    console.error('Research prospect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
