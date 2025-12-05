import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { getClaudeClient } from '@/lib/llm/claude-client';
import { sendReplyAgentHITLNotification } from '@/lib/notifications/google-chat';
import { normalizeCompanyName } from '@/lib/prospect-normalization';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || '792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0';
const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const POSTMARK_API_KEY = process.env.POSTMARK_SERVER_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

interface UnipileMessage {
  id: string;
  text: string;
  timestamp: string;
  sender_id: string;
  sender_name?: string;
  is_inbound: boolean;
}

/**
 * Generate contextual greeting based on current date/time
 * Makes replies feel human without over-personalizing
 */
function getContextualGreeting(): string | null {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 5 = Friday
  const month = now.getMonth(); // 0 = Jan, 11 = Dec
  const date = now.getDate();
  const hour = now.getHours();

  // Check for holidays (US-centric)
  // Thanksgiving: 4th Thursday of November
  if (month === 10) { // November
    const firstThursday = new Date(now.getFullYear(), 10, 1);
    while (firstThursday.getDay() !== 4) firstThursday.setDate(firstThursday.getDate() + 1);
    const thanksgiving = firstThursday.getDate() + 21; // 4th Thursday

    if (date >= thanksgiving && date <= thanksgiving + 4) {
      return "Hope you had a great Thanksgiving!";
    }
    if (date >= thanksgiving - 7 && date < thanksgiving) {
      return "Hope you have a great Thanksgiving week!";
    }
  }

  // Christmas/New Year period
  if (month === 11 && date >= 20) {
    if (date >= 26) return "Hope you're enjoying the holiday week!";
    return "Hope you have a great holiday season!";
  }
  if (month === 0 && date <= 5) {
    return "Happy New Year!";
  }

  // Day of week greetings
  if (day === 1) return "Hope your Monday is off to a good start!";
  if (day === 5) return "Happy Friday!";

  // Time-based for other days
  if (hour < 12) return "Hope your morning is going well!";
  if (hour >= 12 && hour < 17) return "Hope your afternoon is going well!";

  // Default - no greeting (some messages don't need one)
  return null;
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('x-cron-secret');
  if (authHeader !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const results: any[] = [];

  try {
    // PHASE 1: Process existing pending_generation drafts (created by poll-message-replies)
    // These drafts already have the inbound message - we just need to generate AI reply
    const pendingGenerationResults = await processPendingGenerationDrafts(supabase);
    results.push(...pendingGenerationResults);

    // PHASE 2: Get all workspaces with Reply Agent enabled
    const { data: enabledConfigs, error: configError } = await supabase
      .from('workspace_reply_agent_config')
      .select('*, workspaces(id, name)')
      .eq('enabled', true);

    if (configError || !enabledConfigs?.length) {
      return NextResponse.json({
        message: 'No workspaces with Reply Agent enabled',
        processed: 0
      });
    }

    for (const config of enabledConfigs) {
      const workspaceId = config.workspace_id;

      // 2. Get active campaigns for this workspace
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, campaign_name')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

      if (!campaigns?.length) continue;

      // 3. Get prospects who have been contacted (might reply)
      const campaignIds = campaigns.map(c => c.id);
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('*, campaigns(campaign_name)')
        .in('campaign_id', campaignIds)
        .in('status', ['connection_request_sent', 'connected', 'message_sent', 'followed_up']);

      if (!prospects?.length) continue;

      // 4. Get LinkedIn account for this workspace
      const { data: linkedinAccount } = await supabase
        .from('campaign_linkedin_accounts')
        .select('unipile_account_id')
        .in('campaign_id', campaignIds)
        .limit(1)
        .single();

      if (!linkedinAccount?.unipile_account_id) continue;

      // 5. Check for new messages from Unipile
      for (const prospect of prospects) {
        if (!prospect.linkedin_user_id) continue;

        try {
          // Check if we already processed this prospect recently
          const { data: existingDraft } = await supabase
            .from('reply_agent_drafts')
            .select('id')
            .eq('prospect_id', prospect.id)
            .eq('status', 'pending_approval')
            .single();

          if (existingDraft) continue; // Already have pending draft

          // Fetch recent messages from Unipile
          const messagesResponse = await fetch(
            `https://${UNIPILE_DSN}/api/v1/messages?account_id=${linkedinAccount.unipile_account_id}&attendee_id=${prospect.linkedin_user_id}&limit=5`,
            {
              headers: {
                'X-API-KEY': UNIPILE_API_KEY!,
                'Accept': 'application/json'
              }
            }
          );

          if (!messagesResponse.ok) continue;

          const messagesData = await messagesResponse.json();
          const messages: UnipileMessage[] = messagesData.items || [];

          // Find unprocessed inbound messages
          const inboundMessages = messages.filter(m => m.is_inbound);
          if (!inboundMessages.length) continue;

          const latestInbound = inboundMessages[0];

          // Check if we already processed this message
          const { data: processedMessage } = await supabase
            .from('reply_agent_drafts')
            .select('id')
            .eq('inbound_message_id', latestInbound.id)
            .single();

          if (processedMessage) continue; // Already processed

          // 6. Generate AI reply
          const draft = await generateAIReply(
            latestInbound,
            prospect,
            config,
            supabase
          );

          if (!draft) continue;

          // 7. Save draft to database
          const { data: savedDraft, error: saveError } = await supabase
            .from('reply_agent_drafts')
            .insert({
              workspace_id: workspaceId,
              campaign_id: prospect.campaign_id,
              prospect_id: prospect.id,
              inbound_message_id: latestInbound.id,
              inbound_message_text: latestInbound.text,
              inbound_message_at: latestInbound.timestamp,
              channel: 'linkedin',
              prospect_name: prospect.first_name ? `${prospect.first_name} ${prospect.last_name || ''}`.trim() : latestInbound.sender_name,
              prospect_linkedin_url: prospect.linkedin_url,
              prospect_company: prospect.company,
              prospect_title: prospect.title,
              draft_text: draft.text,
              intent_detected: draft.intent,
              ai_model: config.ai_model || 'claude-opus-4-5-20251101',
              research_linkedin_profile: draft.research?.linkedin,
              research_company_profile: draft.research?.company,
            })
            .select()
            .single();

          if (saveError) {
            console.error('Error saving draft:', saveError);
            continue;
          }

          // 8. Send HITL email via Postmark (if manual approval mode)
          if (config.approval_mode === 'manual') {
            await sendHITLEmail(savedDraft, config, prospect, latestInbound.text, supabase);
          } else {
            // Auto-approve mode - send immediately
            await autoSendReply(savedDraft, linkedinAccount.unipile_account_id, supabase);
          }

          results.push({
            workspace_id: workspaceId,
            prospect: prospect.first_name,
            draft_id: savedDraft.id,
            mode: config.approval_mode
          });

        } catch (prospectError) {
          console.error(`Error processing prospect ${prospect.id}:`, prospectError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      drafts: results
    });

  } catch (error) {
    console.error('Reply Agent cron error:', error);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}

async function generateAIReply(
  inboundMessage: UnipileMessage,
  prospect: any,
  config: any,
  supabase: any
): Promise<{ text: string; intent: string; research?: any } | null> {
  try {
    const claude = getClaudeClient();

    // Detect intent first
    const intentPrompt = `Classify this prospect reply into one of these intents:
- INTERESTED: They want to learn more, book a call, or try the product
- QUESTION: They're asking about features, pricing, integrations, how it works
- OBJECTION: They have concerns, pushback, or price objections
- TIMING: Not now, maybe later, bad timing
- WRONG_PERSON: They're not the right person, suggesting someone else
- NOT_INTERESTED: Clear rejection, don't contact again
- VAGUE_POSITIVE: Thumbs up, thanks, looks cool, emoji only
- UNCLEAR: Can't determine intent

Prospect reply: "${inboundMessage.text}"

Respond with just the intent category (e.g., "INTERESTED").`;

    const intentResponse = await claude.complete(intentPrompt, {
      maxTokens: 50,
      temperature: 0
    });
    const intent = intentResponse.trim().toUpperCase().replace(/[^A-Z_]/g, '');

    // Build context for reply generation
    const prospectName = `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim();
    const prospectCompany = prospect.company_name || prospect.company || 'Unknown';
    const companyDisplayName = normalizeCompanyName(prospectCompany); // Short, human-friendly version
    const prospectTitle = prospect.title || 'Unknown';

    // COMPREHENSIVE RESEARCH: LinkedIn personal + company + website
    let research: { linkedin?: any; company?: any; website?: any } | null = null;

    // Get Unipile account ID for this workspace (needed for all LinkedIn lookups)
    const { data: workspaceAccounts } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', config.workspace_id)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .limit(1);
    const unipileAccountId = workspaceAccounts?.[0]?.unipile_account_id;

    // 1. PERSONAL LINKEDIN PROFILE - ONLY for location, connection degree, and company URL
    // NOTE: Do NOT use headline or job title - they are marketing fluff, not facts
    let companyLinkedInUrl: string | null = null;
    let companyWebsiteFromLinkedIn: string | null = null;

    if (prospect.linkedin_url && UNIPILE_API_KEY && unipileAccountId) {
      try {
        const vanityMatch = prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
        if (vanityMatch) {
          const vanityId = vanityMatch[1];
          const profileResponse = await fetch(
            `https://${UNIPILE_DSN}/api/v1/users/${vanityId}?account_id=${unipileAccountId}`,
            {
              method: 'GET',
              headers: { 'X-API-KEY': UNIPILE_API_KEY, 'Accept': 'application/json' }
            }
          );

          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            // Extract company LinkedIn URL from current position for direct lookup
            companyLinkedInUrl = profile.positions?.[0]?.company_linkedin_url || null;

            research = {
              linkedin: {
                // ONLY factual data - NOT headline/title (marketing fluff)
                location: profile.location,
                connectionDegree: profile.network_distance,
                // Keep education as factual
                education: profile.education?.slice(0, 2).map((e: any) =>
                  `${e.degree || ''} ${e.field || ''} at ${e.school_name || ''}`
                ),
              }
            };
            console.log(`   📊 Personal LinkedIn: ${profile.location || 'Unknown location'}`);
            if (companyLinkedInUrl) {
              console.log(`   🔗 Company URL from profile: ${companyLinkedInUrl}`);
            }
          }
        }
      } catch (err) {
        console.log(`   ⚠️ Personal LinkedIn lookup failed:`, err);
      }
    }

    // 2. COMPANY LINKEDIN PAGE - Get DIRECTLY from URL (not search by name)
    // This is accurate company info: about section, description, industry, website
    if (UNIPILE_API_KEY && unipileAccountId) {
      try {
        let companyData: any = null;

        // Priority 1: Use company URL from their profile (most accurate)
        if (companyLinkedInUrl) {
          const companyVanityMatch = companyLinkedInUrl.match(/linkedin\.com\/company\/([^\/\?#]+)/);
          if (companyVanityMatch) {
            const companyVanity = companyVanityMatch[1];
            const companyResponse = await fetch(
              `https://${UNIPILE_DSN}/api/v1/linkedin/company/${companyVanity}?account_id=${unipileAccountId}`,
              {
                method: 'GET',
                headers: { 'X-API-KEY': UNIPILE_API_KEY, 'Accept': 'application/json' }
              }
            );
            if (companyResponse.ok) {
              companyData = await companyResponse.json();
            }
          }
        }

        // Fallback: Search by company name (less accurate)
        if (!companyData && prospectCompany && prospectCompany !== 'Unknown') {
          const searchUrl = `https://${UNIPILE_DSN}/api/v1/linkedin/search/companies?account_id=${unipileAccountId}&keywords=${encodeURIComponent(prospectCompany)}&limit=1`;
          const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: { 'X-API-KEY': UNIPILE_API_KEY, 'Accept': 'application/json' }
          });
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            companyData = searchData.items?.[0];
          }
        }

        if (companyData) {
          research = research || {};
          research.company = {
            name: companyData.name,
            industry: companyData.industry,
            size: companyData.staff_count_range || companyData.company_size,
            // IMPORTANT: Company description is factual (not marketing like personal headline)
            description: companyData.description?.slice(0, 500),
            about: companyData.about?.slice(0, 500),
            specialties: companyData.specialties?.slice(0, 5),
            headquarters: companyData.headquarters,
            founded: companyData.founded_year,
            // Get website URL from company page for scraping
            website: companyData.website
          };
          companyWebsiteFromLinkedIn = companyData.website || null;
          console.log(`   📊 Company LinkedIn: ${companyData.name} - ${companyData.industry || 'N/A'}`);
          if (companyData.website) {
            console.log(`   🌐 Website from company: ${companyData.website}`);
          }
        }
      } catch (err) {
        console.log(`   ⚠️ Company LinkedIn lookup failed:`, err);
      }
    }

    // 3. COMPANY WEBSITE - COMPREHENSIVE SCRAPING (SOURCE OF TRUTH)
    // Extract: SEO keywords, products/services, FAQ, blog posts
    // Priority: stored company_website > website from LinkedIn company page
    const companyWebsite = prospect.company_website || companyWebsiteFromLinkedIn;
    if (companyWebsite) {
      console.log(`   🌐 Scraping website: ${companyWebsite}`);
      try {
        const baseUrl = new URL(companyWebsite).origin;
        const fetchPage = async (url: string) => {
          try {
            const resp = await fetch(url, {
              method: 'GET',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SAM-AI/1.0)' },
              signal: AbortSignal.timeout(5000)
            });
            return resp.ok ? await resp.text() : null;
          } catch { return null; }
        };

        // Fetch homepage
        const html = await fetchPage(companyWebsite);
        if (html) {
          // Extract SEO metadata
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i) ||
                           html.match(/<meta[^>]*content="([^"]+)"[^>]*name="description"/i);
          const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);

          // Extract SEO keywords
          const keywordsMatch = html.match(/<meta[^>]*name="keywords"[^>]*content="([^"]+)"/i) ||
                               html.match(/<meta[^>]*content="([^"]+)"[^>]*name="keywords"/i);

          // Extract h1/h2 taglines
          const h1Match = html.match(/<h1[^>]*>([^<]{10,150})<\/h1>/i);
          const h2Matches = html.match(/<h2[^>]*>([^<]{10,100})<\/h2>/gi)?.slice(0, 5)
            ?.map(h => h.replace(/<[^>]+>/g, '').trim());

          // Find internal links for products, services, FAQ, blog
          const linkMatches = html.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi) || [];
          const productLinks: string[] = [];
          const faqLink: string | null = null;
          const blogLink: string | null = null;

          for (const link of linkMatches.slice(0, 50)) {
            const hrefMatch = link.match(/href="([^"]+)"/i);
            const textMatch = link.match(/>([^<]+)</);
            if (hrefMatch && textMatch) {
              const href = hrefMatch[1];
              const text = textMatch[1].toLowerCase();
              if (text.includes('product') || text.includes('service') || text.includes('solution') || text.includes('feature')) {
                if (href.startsWith('/') || href.startsWith(baseUrl)) {
                  productLinks.push(href.startsWith('/') ? baseUrl + href : href);
                }
              }
            }
          }

          // Extract products/services from homepage sections
          const productsFromPage: string[] = [];
          const servicePatterns = [
            /<li[^>]*>([^<]{10,80})<\/li>/gi,
            /<h3[^>]*>([^<]{10,60})<\/h3>/gi,
            /<strong[^>]*>([^<]{10,60})<\/strong>/gi
          ];
          for (const pattern of servicePatterns) {
            const matches = html.match(pattern)?.slice(0, 8) || [];
            for (const m of matches) {
              const clean = m.replace(/<[^>]+>/g, '').trim();
              if (clean.length > 10 && clean.length < 80 && !clean.includes('©')) {
                productsFromPage.push(clean);
              }
            }
          }

          // Look for FAQ schema or FAQ section
          let faqItems: string[] = [];
          const faqSchemaMatch = html.match(/"@type"\s*:\s*"FAQPage"[^}]*"mainEntity"\s*:\s*\[([\s\S]*?)\]/i);
          if (faqSchemaMatch) {
            const questionMatches = faqSchemaMatch[1].match(/"name"\s*:\s*"([^"]+)"/gi) || [];
            faqItems = questionMatches.slice(0, 5).map(q => q.replace(/"name"\s*:\s*"/i, '').replace(/"$/, ''));
          }

          // Look for FAQ section by heading
          const faqSectionMatch = html.match(/(?:FAQ|Frequently Asked|Questions)[^<]*<[\s\S]{0,2000}?(?:<\/(?:section|div)>)/i);
          if (faqSectionMatch && faqItems.length === 0) {
            const questionMatches = faqSectionMatch[0].match(/<(?:h[2-4]|summary|strong)[^>]*>([^<]{15,100})\?<\//gi) || [];
            faqItems = questionMatches.slice(0, 5).map(q => q.replace(/<[^>]+>/g, '').trim());
          }

          // Look for blog posts (recent article titles)
          let blogPosts: string[] = [];
          const blogPatterns = [
            /class="[^"]*(?:blog|article|post)[^"]*"[^>]*>[\s\S]{0,500}?<(?:h[2-4]|a)[^>]*>([^<]{15,80})<\//gi,
            /<article[^>]*>[\s\S]{0,500}?<(?:h[2-4]|a)[^>]*>([^<]{15,80})<\//gi
          ];
          for (const pattern of blogPatterns) {
            const matches = html.match(pattern)?.slice(0, 5) || [];
            for (const m of matches) {
              const titleMatch = m.match(/<(?:h[2-4]|a)[^>]*>([^<]{15,80})<\//i);
              if (titleMatch) blogPosts.push(titleMatch[1].trim());
            }
          }

          research = research || {};
          research.website = {
            url: companyWebsite,
            title: titleMatch?.[1]?.trim(),
            description: descMatch?.[1]?.trim() || ogDescMatch?.[1]?.trim(),
            keywords: keywordsMatch?.[1]?.trim(),
            tagline: h1Match?.[1]?.trim(),
            subheadings: h2Matches,
            productsServices: productsFromPage.slice(0, 8),
            faq: faqItems.slice(0, 5),
            blogPosts: blogPosts.slice(0, 5)
          };
          console.log(`   📊 Website: ${research.website.title?.slice(0, 50) || companyWebsite}`);
          if (research.website.productsServices?.length) {
            console.log(`   📦 Products/Services: ${research.website.productsServices.length} found`);
          }
          if (research.website.faq?.length) {
            console.log(`   ❓ FAQ: ${research.website.faq.length} questions found`);
          }
          if (research.website.blogPosts?.length) {
            console.log(`   📝 Blog: ${research.website.blogPosts.length} posts found`);
          }
        }
      } catch (err) {
        console.log(`   ⚠️ Website fetch failed for ${companyWebsite}`);
      }
    }

    // Sender name (the person using SAM - workspace owner)
    const senderName = config.sender_name || 'Pete'; // Default fallback

    // Get original outreach message from campaign if available
    let originalOutreachMessage = '';
    if (prospect.campaign_id) {
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('connection_message, message_templates')
        .eq('id', prospect.campaign_id)
        .single();

      originalOutreachMessage = campaignData?.connection_message ||
        campaignData?.message_templates?.connectionRequest ||
        'I noticed your background and thought you might be interested in SAM, an AI-powered LinkedIn outreach tool.';
    }

    // Build comprehensive research context FIRST (before using in prompt)
    // IMPORTANT: Do NOT include LinkedIn headline/title - they are marketing fluff, not facts
    let researchContext = '';

    // Personal LinkedIn - ONLY FACTUAL DATA (location, education, connection degree)
    if (research?.linkedin) {
      const education = research.linkedin.education?.join('\n  - ') || '';
      researchContext += `
## THEIR LINKEDIN (factual data only):
**Location:** ${research.linkedin.location || 'N/A'}
**Connection:** ${research.linkedin.connectionDegree || 'N/A'}`;
      if (education && education !== 'N/A') {
        researchContext += `
**Education:**
  - ${education}`;
      }
    }

    // Company LinkedIn
    if (research?.company) {
      const specialties = research?.company.specialties?.join(', ') || 'N/A';
      researchContext += `

## THEIR COMPANY (LinkedIn):
**Name:** ${research.company.name || prospectCompany}
**Industry:** ${research.company.industry || 'N/A'}
**Size:** ${research.company.size || 'N/A'}
**Founded:** ${research.company.founded || 'N/A'}
**HQ:** ${research.company.headquarters || 'N/A'}
**What they do:** ${research.company.description || 'N/A'}
**Specialties:** ${specialties}`;
    }

    // Company Website - COMPREHENSIVE
    if (research?.website) {
      const subheadings = research.website.subheadings?.join('\n  - ') || '';
      const products = research.website.productsServices?.join('\n  - ') || '';
      const faq = research.website.faq?.join('\n  - ') || '';
      const blogs = research.website.blogPosts?.join('\n  - ') || '';

      researchContext += `

## THEIR WEBSITE (${research.website.url}):
**Title:** ${research.website.title || 'N/A'}
**Tagline:** ${research.website.tagline || 'N/A'}
**Description:** ${research.website.description || 'N/A'}
**SEO Keywords:** ${research.website.keywords || 'N/A'}`;

      if (subheadings) {
        researchContext += `
**Key Messages:**
  - ${subheadings}`;
      }

      if (products) {
        researchContext += `
**Products/Services:**
  - ${products}`;
      }

      if (faq) {
        researchContext += `
**FAQ Questions (what their customers ask):**
  - ${faq}`;
      }

      if (blogs) {
        researchContext += `
**Recent Blog Posts:**
  - ${blogs}`;
      }
    }

    // ===========================================
    // REPLY AGENT PROMPT V2 (December 5, 2025)
    // Research-driven, industry-aware responses
    // ===========================================

    const UNIFIED_PROMPT = `You are ${senderName}, replying to a prospect on LinkedIn about SAM, an AI-powered sales automation platform.

You are not a sales bot. You are a founder who built something useful and is talking to someone who might benefit from it.

---

## THEIR MESSAGE

"${inboundMessage.text}"

---

## PROSPECT RESEARCH

### Personal Profile
- Name: ${prospectName}
- Location: ${research?.linkedin?.location || 'Unknown'}

### Company Profile
- Company: ${companyDisplayName}
- Full Name: ${prospectCompany}
- Industry: ${research?.company?.industry || 'Unknown'}
- Size: ${research?.company?.size || 'Unknown'}
- About: ${research?.company?.description || 'Unknown'}
${research?.website?.productsServices ? `- Products/Services: ${research.website.productsServices.join(', ')}` : ''}

---

## CONTEXT

- Intent: ${intent}
- Original outreach: "${originalOutreachMessage}"

---

## YOUR TASK

1. **Understand their business** — What do they sell? Who do they sell to? What are their likely challenges?
2. **Connect SAM to their situation** — How would SAM specifically help THIS company? Be concrete.
3. **Answer their question / address their intent** — Don't ignore what they said.
4. **Keep it short** — 2-5 sentences max.

---

## INTENT GOALS

${intent === 'QUESTION' ? `**QUESTION**
- Answer directly in 1-2 sentences
- Don't over-explain or dump features
- Bridge to next step (trial or call)` : ''}

${intent === 'INTERESTED' ? `**INTERESTED**
- Don't oversell — they're already interested
- Make the next step easy
- Offer trial or call` : ''}

${intent === 'OBJECTION' ? `**OBJECTION**
- Acknowledge first — don't argue
- Reframe with a different angle or proof point
- Soft re-engage or offer alternative` : ''}

${intent === 'TIMING' ? `**TIMING**
- Respect their timeline completely
- Don't push or guilt
- Offer to follow up later
- 2 sentences max` : ''}

${intent === 'WRONG_PERSON' ? `**WRONG_PERSON**
- Thank them
- Ask who the right person is
- Keep it short` : ''}

${intent === 'NOT_INTERESTED' ? `**NOT_INTERESTED**
- One sentence: "Understood. Appreciate the reply."
- Do not try to save it` : ''}

${intent === 'VAGUE_POSITIVE' ? `**VAGUE_POSITIVE** (e.g., "👍", "Thanks", "Sounds good")
- Mirror their energy
- Soft clarify or gently advance
- One simple question or CTA` : ''}

${intent === 'UNCLEAR' ? `**UNCLEAR**
- Ask one clarifying question
- Don't guess` : ''}

---

## HOW SAM HELPS DIFFERENT BUSINESSES

Connect SAM to their specific situation:

| Business Type | Their Challenge | SAM Solution |
|---------------|-----------------|--------------|
| IT Consulting / MSP | Finding clients while delivering | Outreach runs in background |
| Software Agency | Long sales cycles | Multi-channel at scale |
| Marketing Agency | Feast/famine, BD competes with billable | Automated prospecting |
| Consultants | Referral-dependent, no time for outbound | 10-15 hrs/week back |
| Coaches / Trainers | Need visibility, hate "selling" | Commenting builds presence |
| SaaS / Startups | No SDR budget | Full sales engine for $199/mo |
| Recruiting | High-volume outreach | Scale without headcount |
| Financial Services | Compliance, need trust first | Human approval on every reply |
| Professional Services | Can't "sell" aggressively | Thought leadership via commenting |

---

## ABOUT SAM (use sparingly, only when relevant)

- Commenting Agent: Comments on relevant posts (20/day)
- Multi-Channel Outreach: Personalized LinkedIn + email
- Follow-up Sequences: Automated, stops when they engage
- Reply Agent: Drafts responses for your approval
- $199/month, $99/month early adopter pricing
- 14-day free trial, no credit card

---

## COMPANY NAME RULES

Always use "${companyDisplayName}" — NOT "${prospectCompany}"

---

## RESPONSE RULES

**Structure:**
- 2-5 sentences (shorter is usually better)
- Reference something specific about THEIR business
- Connect SAM to THEIR situation
- One clear CTA (or none if exiting)

**Tone:**
- Sound like you actually looked at their company
- Match their energy — don't be more enthusiastic than they are
- Confident but not pushy
- Direct but not abrupt

**NEVER SAY:**
- "Thanks so much for reaching out!"
- "Thanks for getting back to me!"
- "I appreciate you taking the time"
- "Great question!"
- "Absolutely!"
- "I'd love to..."
- "Would you be open to..."
- "Just checking in"
- "Let me know!"
- "Happy to help!"
- "Feel free to..."
- "I think SAM could be a great fit..."

**NEVER DO:**
- Start with "I"
- Use exclamation points (unless they did)
- Give a generic response that could apply to anyone
- Pitch features they didn't ask about
- Sound like a template
- Ignore what they actually said

---

## CTA OPTIONS (use ONE or none)

- "Want me to send the trial link?"
- "Worth a quick call?"
- "Happy to send a case study if useful."
- "Want me to follow up in [X weeks]?"
- (For not interested: no CTA)

---

## OUTPUT

Write the reply only. No preamble. No "Here's a draft:". No greeting like "Hi ${prospectName}" or "Happy Friday". Just the message to send.`;

    // Generate full reply using unified prompt with Claude Opus
    console.log(`   🤖 Generating reply with unified prompt (intent: ${intent})`);

    const fullReply = await claude.complete(UNIFIED_PROMPT, {
      maxTokens: 500,
      temperature: 0.7
    });

    // Clean up any accidental prefixes like "Here's my reply:" etc.
    let cleanedReply = fullReply.trim();
    cleanedReply = cleanedReply.replace(/^(?:Here['']s my reply:?\s*|Reply:?\s*)/i, '').trim();

    // For NOT_INTERESTED, we still generate but it should be brief
    // The prompt handles keeping it respectful and short

    return {
      text: cleanedReply,
      intent,
      research
    };

  } catch (error) {
    console.error('Error generating AI reply:', error);
    return null;
  }
}

async function sendHITLEmail(
  draft: any,
  config: any,
  prospect: any,
  inboundText: string,
  supabase: any
): Promise<void> {
  if (!POSTMARK_API_KEY) {
    console.error('POSTMARK_API_KEY not configured');
    return;
  }

  try {
    // Get workspace owner's email
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, users(email)')
      .eq('workspace_id', draft.workspace_id)
      .eq('role', 'owner')
      .limit(1);

    const ownerEmail = members?.[0]?.users?.email;
    if (!ownerEmail) {
      console.error('No owner email found for workspace');
      return;
    }

    const approveUrl = `${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=approve`;
    const rejectUrl = `${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=reject`;
    const editUrl = `${APP_URL}/reply-agent/edit?id=${draft.id}&token=${draft.approval_token}`;
    const instructionsUrl = `${APP_URL}/reply-agent/instructions?id=${draft.id}&token=${draft.approval_token}`;

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .message-box { background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #667eea; }
    .draft-box { background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #10b981; }
    .button { display: inline-block; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 8px 8px 8px 0; }
    .approve { background: #10b981; color: white; }
    .reject { background: #ef4444; color: white; }
    .edit { background: #6b7280; color: white; }
    .instructions { background: #7c3aed; color: white; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .intent { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">📬 New Reply Needs Approval</h2>
      <p style="margin:8px 0 0 0; opacity:0.9;">${prospect.first_name || 'A prospect'} replied to your campaign</p>
    </div>
    <div class="content">
      <p><strong>From:</strong> ${draft.prospect_name || 'Unknown'}</p>
      <p><strong>Company:</strong> ${draft.prospect_company || 'Unknown'}</p>
      <p><strong>Intent:</strong> <span class="intent">${draft.intent_detected || 'UNCLEAR'}</span></p>

      <h3>Their Message:</h3>
      <div class="message-box">
        ${inboundText}
      </div>

      <h3>SAM's Draft Reply:</h3>
      <div class="draft-box">
        ${draft.draft_text}
      </div>

      <div style="margin-top: 24px;">
        <a href="${approveUrl}" class="button approve">✓ Approve & Send</a>
        <a href="${rejectUrl}" class="button reject">✗ Reject</a>
      </div>
      <div style="margin-top: 12px;">
        <a href="${editUrl}" class="button edit">✏️ Edit Reply</a>
        <a href="${instructionsUrl}" class="button instructions">💬 Add Instructions</a>
      </div>

      <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
        This draft will expire in 48 hours if not actioned.
      </p>
    </div>
    <div class="footer">
      <p>Sent by SAM AI • <a href="${APP_URL}">app.meet-sam.com</a></p>
    </div>
  </div>
</body>
</html>
`;

    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_API_KEY
      },
      body: JSON.stringify({
        From: 'sam@innovareai.com',
        To: ownerEmail,
        Subject: `📬 ${draft.prospect_name || 'Prospect'} replied - Review SAM's draft`,
        HtmlBody: emailBody,
        TextBody: `New reply from ${draft.prospect_name}:\n\n"${inboundText}"\n\nSAM's draft reply:\n\n"${draft.draft_text}"\n\nApprove: ${approveUrl}\nReject: ${rejectUrl}\n\nEdit Reply: ${editUrl}\nAdd Instructions: ${instructionsUrl}`,
        MessageStream: 'outbound'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Postmark error:', error);
    }

    // Only send to Google Chat if workspace has chat channel enabled (enterprise feature)
    const notificationChannels = config.notification_channels || ['email'];
    if (notificationChannels.includes('chat')) {
      await sendReplyAgentHITLNotification({
        draftId: draft.id,
        approvalToken: draft.approval_token,
        prospectName: draft.prospect_name || 'Unknown',
        prospectTitle: prospect.title,
        prospectCompany: draft.prospect_company,
        inboundMessage: inboundText,
        draftReply: draft.draft_text,
        intent: draft.intent_detected || 'UNCLEAR',
        appUrl: APP_URL,
      });
    }

  } catch (error) {
    console.error('Error sending HITL email:', error);
  }
}

async function autoSendReply(
  draft: any,
  accountId: string,
  supabase: any
): Promise<void> {
  // TODO: Implement auto-send via Unipile
  // For now, just mark as approved
  await supabase
    .from('reply_agent_drafts')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString()
    })
    .eq('id', draft.id);
}

/**
 * Process drafts created by poll-message-replies with status 'pending_generation'
 * These drafts already have the inbound message but need AI reply generation
 */
async function processPendingGenerationDrafts(supabase: any): Promise<any[]> {
  const results: any[] = [];

  try {
    // Get all drafts awaiting AI generation
    const { data: pendingDrafts, error: draftsError } = await supabase
      .from('reply_agent_drafts')
      .select('*, campaigns(campaign_name)')
      .eq('status', 'pending_generation')
      .limit(20); // Process max 20 per run

    if (draftsError || !pendingDrafts?.length) {
      return results;
    }

    console.log(`📝 Processing ${pendingDrafts.length} pending_generation drafts...`);

    for (const draft of pendingDrafts) {
      try {
        // Get workspace config
        const { data: config } = await supabase
          .from('workspace_reply_agent_config')
          .select('*')
          .eq('workspace_id', draft.workspace_id)
          .eq('enabled', true)
          .single();

        if (!config) {
          // Reply Agent disabled - mark draft as skipped
          await supabase
            .from('reply_agent_drafts')
            .update({ status: 'skipped', updated_at: new Date().toISOString() })
            .eq('id', draft.id);
          continue;
        }

        // Get prospect details
        const { data: prospect } = await supabase
          .from('campaign_prospects')
          .select('*')
          .eq('id', draft.prospect_id)
          .single();

        if (!prospect) {
          await supabase
            .from('reply_agent_drafts')
            .update({ status: 'error', error_message: 'Prospect not found', updated_at: new Date().toISOString() })
            .eq('id', draft.id);
          continue;
        }

        // Generate AI reply using the inbound message stored in draft
        const inboundMessage: UnipileMessage = {
          id: draft.inbound_message_id,
          text: draft.inbound_message_text,
          timestamp: draft.inbound_message_at,
          sender_id: prospect.linkedin_user_id || '',
          sender_name: draft.prospect_name,
          is_inbound: true
        };

        const aiReply = await generateAIReply(inboundMessage, prospect, config, supabase);

        if (!aiReply) {
          await supabase
            .from('reply_agent_drafts')
            .update({ status: 'error', error_message: 'AI generation failed', updated_at: new Date().toISOString() })
            .eq('id', draft.id);
          continue;
        }

        // Update draft with AI reply and all research (personal LinkedIn + company LinkedIn + website)
        const { error: updateError } = await supabase
          .from('reply_agent_drafts')
          .update({
            draft_text: aiReply.text,
            intent_detected: aiReply.intent,
            ai_model: config.ai_model || 'claude-opus-4-5-20251101',
            research_linkedin_profile: aiReply.research?.linkedin || null,
            research_company_profile: aiReply.research?.company || null,
            research_website: aiReply.research?.website || null,
            status: 'pending_approval',
            updated_at: new Date().toISOString()
          })
          .eq('id', draft.id);

        if (updateError) {
          console.error(`Error updating draft ${draft.id}:`, updateError);
          continue;
        }

        // Get updated draft with all fields
        const { data: updatedDraft } = await supabase
          .from('reply_agent_drafts')
          .select('*')
          .eq('id', draft.id)
          .single();

        // Send HITL notification
        if (config.approval_mode === 'manual') {
          await sendHITLEmail(updatedDraft, config, prospect, draft.inbound_message_text, supabase);
          console.log(`✅ Draft ${draft.id} processed - HITL notification sent`);
        } else {
          // Get LinkedIn account for auto-send
          const { data: linkedinAccount } = await supabase
            .from('campaign_linkedin_accounts')
            .select('unipile_account_id')
            .eq('campaign_id', draft.campaign_id)
            .single();

          if (linkedinAccount?.unipile_account_id) {
            await autoSendReply(updatedDraft, linkedinAccount.unipile_account_id, supabase);
            console.log(`✅ Draft ${draft.id} auto-approved`);
          }
        }

        results.push({
          source: 'pending_generation',
          draft_id: draft.id,
          prospect: draft.prospect_name,
          intent: aiReply.intent,
          mode: config.approval_mode
        });

      } catch (draftError) {
        console.error(`Error processing draft ${draft.id}:`, draftError);
        await supabase
          .from('reply_agent_drafts')
          .update({ status: 'error', error_message: String(draftError), updated_at: new Date().toISOString() })
          .eq('id', draft.id);
      }
    }

  } catch (error) {
    console.error('Error in processPendingGenerationDrafts:', error);
  }

  return results;
}
