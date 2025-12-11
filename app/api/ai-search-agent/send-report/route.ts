/**
 * AI Search Agent - Email Report API
 *
 * POST: Send SEO/GEO analysis report via email
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiSuccess, apiError } from '@/lib/api-error-handler';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AnalysisResult {
  id: string;
  website_url: string;
  domain: string;
  seo_score: number;
  geo_score: number;
  overall_score: number;
  analyzed_at: string;
  executive_summary: string;
  seo_results: {
    score: number;
    meta_tags: { title: string; description: string; issues: string[]; score: number };
    structured_data: { types_found: string[]; issues: string[]; score: number };
    robots_txt: { exists: boolean; issues: string[]; score: number };
    sitemap: { exists: boolean; url: string | null; issues: string[]; score: number };
    technical_issues: string[];
  };
  geo_results: {
    score: number;
    readiness_level: string;
    llm_readability: { score: number; issues: string[]; suggestions: string[] };
    entity_clarity: { score: number; entities_found: string[]; issues: string[]; suggestions: string[] };
    fact_density: { score: number; facts_found: number; issues: string[]; suggestions: string[] };
    citation_readiness: { score: number; is_authoritative: boolean; issues: string[]; suggestions: string[] };
    ai_summary: string;
  };
  recommendations: Array<{
    priority: string;
    category: string;
    title: string;
    description: string;
    implementation_steps: string[];
  }>;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#eab308'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
}

function getScoreEmoji(score: number): string {
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  if (score >= 40) return '🟠';
  return '🔴';
}

function generateEmailHtml(analysis: AnalysisResult, workspaceName: string): string {
  // Safely parse JSONB fields
  const seoResults = typeof analysis.seo_results === 'string'
    ? JSON.parse(analysis.seo_results)
    : (analysis.seo_results || {});
  const geoResults = typeof analysis.geo_results === 'string'
    ? JSON.parse(analysis.geo_results)
    : (analysis.geo_results || {});
  const recommendations = Array.isArray(analysis.recommendations)
    ? analysis.recommendations
    : (typeof analysis.recommendations === 'string'
        ? JSON.parse(analysis.recommendations)
        : []);

  const highPriorityRecs = recommendations.filter((r: { priority: string }) => r.priority === 'high');
  const mediumPriorityRecs = recommendations.filter((r: { priority: string }) => r.priority === 'medium');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO & GEO Analysis Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                📊 SEO & GEO Analysis Report
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                ${workspaceName}
              </p>
            </td>
          </tr>

          <!-- Website Info -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Website Analyzed</p>
              <p style="margin: 4px 0 0 0; color: #111827; font-size: 18px; font-weight: 600;">
                ${analysis.website_url}
              </p>
              <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
                Analyzed on ${new Date(analysis.analyzed_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </td>
          </tr>

          <!-- Score Cards -->
          <tr>
            <td style="padding: 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="text-align: center; padding: 16px;">
                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px;">
                      <p style="margin: 0; font-size: 42px; font-weight: 700; color: ${getScoreColor(analysis.overall_score)};">
                        ${analysis.overall_score}
                      </p>
                      <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px; font-weight: 500;">
                        Overall Score
                      </p>
                    </div>
                  </td>
                  <td width="33%" style="text-align: center; padding: 16px;">
                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px;">
                      <p style="margin: 0; font-size: 42px; font-weight: 700; color: ${getScoreColor(analysis.seo_score)};">
                        ${analysis.seo_score}
                      </p>
                      <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px; font-weight: 500;">
                        SEO Score
                      </p>
                    </div>
                  </td>
                  <td width="33%" style="text-align: center; padding: 16px;">
                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px;">
                      <p style="margin: 0; font-size: 42px; font-weight: 700; color: ${getScoreColor(analysis.geo_score)};">
                        ${analysis.geo_score}
                      </p>
                      <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px; font-weight: 500;">
                        GEO Score
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Executive Summary -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">Executive Summary</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 14px; line-height: 1.6;">
                  ${analysis.executive_summary}
                </p>
              </div>
            </td>
          </tr>

          <!-- SEO Analysis -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                🔍 SEO Analysis
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%">
                      <tr>
                        <td style="color: #374151; font-size: 14px;">Meta Tags</td>
                        <td align="right" style="color: ${getScoreColor(seoResults.meta_tags?.score || 0)}; font-weight: 600;">
                          ${getScoreEmoji(seoResults.meta_tags?.score || 0)} ${seoResults.meta_tags?.score || 0}/100
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%">
                      <tr>
                        <td style="color: #374151; font-size: 14px;">Structured Data</td>
                        <td align="right" style="color: ${getScoreColor(seoResults.structured_data?.score || 0)}; font-weight: 600;">
                          ${getScoreEmoji(seoResults.structured_data?.score || 0)} ${seoResults.structured_data?.score || 0}/100
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%">
                      <tr>
                        <td style="color: #374151; font-size: 14px;">robots.txt</td>
                        <td align="right" style="color: ${getScoreColor(seoResults.robots_txt?.score || 0)}; font-weight: 600;">
                          ${getScoreEmoji(seoResults.robots_txt?.score || 0)} ${seoResults.robots_txt?.score || 0}/100
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%">
                      <tr>
                        <td style="color: #374151; font-size: 14px;">Sitemap</td>
                        <td align="right" style="color: ${getScoreColor(seoResults.sitemap?.score || 0)}; font-weight: 600;">
                          ${getScoreEmoji(seoResults.sitemap?.score || 0)} ${seoResults.sitemap?.score || 0}/100
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- GEO Analysis -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                🤖 GEO Analysis (AI Search Optimization)
              </h2>
              <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 13px;">
                GEO Readiness: <strong style="color: #ea580c;">${geoResults.readiness_level?.toUpperCase() || 'UNKNOWN'}</strong>
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%">
                      <tr>
                        <td style="color: #374151; font-size: 14px;">LLM Readability</td>
                        <td align="right" style="color: ${getScoreColor(geoResults.llm_readability?.score || 0)}; font-weight: 600;">
                          ${getScoreEmoji(geoResults.llm_readability?.score || 0)} ${geoResults.llm_readability?.score || 0}/100
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%">
                      <tr>
                        <td style="color: #374151; font-size: 14px;">Entity Clarity</td>
                        <td align="right" style="color: ${getScoreColor(geoResults.entity_clarity?.score || 0)}; font-weight: 600;">
                          ${getScoreEmoji(geoResults.entity_clarity?.score || 0)} ${geoResults.entity_clarity?.score || 0}/100
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%">
                      <tr>
                        <td style="color: #374151; font-size: 14px;">Fact Density</td>
                        <td align="right" style="color: ${getScoreColor(geoResults.fact_density?.score || 0)}; font-weight: 600;">
                          ${getScoreEmoji(geoResults.fact_density?.score || 0)} ${geoResults.fact_density?.score || 0}/100
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px;">
                    <table width="100%">
                      <tr>
                        <td style="color: #374151; font-size: 14px;">Citation Readiness</td>
                        <td align="right" style="color: ${getScoreColor(geoResults.citation_readiness?.score || 0)}; font-weight: 600;">
                          ${getScoreEmoji(geoResults.citation_readiness?.score || 0)} ${geoResults.citation_readiness?.score || 0}/100
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${geoResults.ai_summary ? `
              <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 13px; font-style: italic; line-height: 1.5;">
                "${geoResults.ai_summary}"
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- High Priority Recommendations -->
          ${highPriorityRecs.length > 0 ? `
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                🚨 High Priority Recommendations
              </h2>
              ${highPriorityRecs.slice(0, 5).map(rec => `
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 600;">${rec.title}</p>
                <p style="margin: 6px 0 0 0; color: #7f1d1d; font-size: 13px;">${rec.description}</p>
              </div>
              `).join('')}
            </td>
          </tr>
          ` : ''}

          <!-- Medium Priority Recommendations -->
          ${mediumPriorityRecs.length > 0 ? `
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px; font-weight: 600;">
                ⚠️ Additional Recommendations
              </h2>
              ${mediumPriorityRecs.slice(0, 5).map(rec => `
              <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 12px 16px; margin-bottom: 12px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #854d0e; font-size: 14px; font-weight: 600;">${rec.title}</p>
                <p style="margin: 6px 0 0 0; color: #713f12; font-size: 13px;">${rec.description}</p>
              </div>
              `).join('')}
            </td>
          </tr>
          ` : ''}

          <!-- What is GEO -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px;">
                <h3 style="margin: 0 0 12px 0; color: #c2410c; font-size: 16px; font-weight: 600;">
                  💡 What is GEO?
                </h3>
                <p style="margin: 0; color: #9a3412; font-size: 13px; line-height: 1.6;">
                  <strong>GEO (Generative Engine Optimization)</strong> is the practice of optimizing your content
                  for AI search engines like ChatGPT, Perplexity, Claude, and Google AI Overviews. Unlike traditional
                  SEO which focuses on keywords and backlinks, GEO focuses on making your content understandable
                  and citable by AI systems.
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 32px 32px 32px; text-align: center;">
              <a href="https://app.meet-sam.com" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Full Report in SAM
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                This report was generated by SAM AI Search Agent
              </p>
              <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} SAM AI. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, email, analysis_id } = body;

    if (!workspace_id) {
      return apiError('workspace_id is required', 400);
    }

    if (!email) {
      return apiError('email is required', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiError('Invalid email format', 400);
    }

    const supabase = getSupabase();

    // Get workspace name
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .single();

    const workspaceName = workspace?.name || 'Your Workspace';

    // Get analysis - either specific ID or latest
    let analysisQuery = supabase
      .from('website_analysis_results')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('status', 'completed');

    if (analysis_id) {
      analysisQuery = analysisQuery.eq('id', analysis_id);
    } else {
      analysisQuery = analysisQuery.order('analyzed_at', { ascending: false }).limit(1);
    }

    const { data: analysisData, error: analysisError } = await analysisQuery.single();

    if (analysisError || !analysisData) {
      return apiError('No completed analysis found', 404);
    }

    const analysis = analysisData as AnalysisResult;

    // Generate email HTML
    const htmlContent = generateEmailHtml(analysis, workspaceName);

    // Send via Postmark
    const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
    if (!postmarkToken) {
      return apiError('Email service not configured', 500);
    }

    const emailResponse = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': postmarkToken
      },
      body: JSON.stringify({
        From: 'sam@meet-sam.com',
        To: email,
        Subject: `SEO & GEO Analysis Report - ${analysis.domain} (Score: ${analysis.overall_score}/100)`,
        HtmlBody: htmlContent,
        TextBody: `SEO & GEO Analysis Report for ${analysis.website_url}\n\nOverall Score: ${analysis.overall_score}/100\nSEO Score: ${analysis.seo_score}/100\nGEO Score: ${analysis.geo_score}/100\n\n${analysis.executive_summary}\n\nView the full report at https://app.meet-sam.com`,
        MessageStream: 'outbound'
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Postmark error:', errorData);
      return apiError('Failed to send email', 500);
    }

    console.log(`📧 SEO/GEO report sent to ${email} for ${analysis.domain}`);

    return apiSuccess({
      message: 'Report sent successfully',
      sent_to: email,
      analysis_id: analysis.id
    });

  } catch (error) {
    console.error('Send report error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to send report',
      500
    );
  }
}
