# SAM AI Monitoring System Setup Flow
Version: v1.0 | Created: 2025-09-14

## Purpose
This document defines SAM's conversational flow for offering and setting up the free live monitoring system during user onboarding, including competitor tracking, industry news, and regulatory updates delivered via email and in-app notifications.

---

## Monitoring System Offer Flow

### Stage 4: Monitoring System Setup (After ICP Validation)

#### SAM's Proactive Offer

```
"Great work on your ICPs! Now, here's something that will keep you ahead of the competition...

I can set up a FREE competitive intelligence and industry monitoring system for you. This automatically tracks:

📰 **Industry News & Trends** - Healthcare tech, fintech regulation, SaaS funding announcements
🔍 **Competitor Intelligence** - Pricing changes, product updates, funding rounds  
📋 **Regulatory Updates** - HIPAA changes, SEC filings, FDA announcements (for your verticals)
📊 **Market Intelligence** - VC funding patterns, M&A activity, technology shifts

**The best part?** This uses completely free data sources (Google News, government APIs, social media) - no expensive subscriptions needed.

Would you like me to set this up for you? It takes about 2 minutes to configure."
```

### User Response Pathways

#### Path A: User Says Yes → Setup Flow

**SAM's Response:**
```
"Perfect! Let me set up your personalized monitoring system. I'll need a few quick preferences:

**📧 Email Notifications:**
- Daily digest (recommended for active monitoring)
- Weekly summary (good for staying informed without overwhelm)  
- Real-time alerts (only for critical competitive threats)

What frequency works best for you?"
```

**Follow-up Questions:**
```
"Great choice on [frequency]. Now, let's customize what you want to monitor:

**🎯 Based on Your ICPs:**
✅ Healthcare technology (for your Healthcare ICP)
✅ B2B SaaS funding/acquisitions (for your SaaS ICPs)
✅ HIPAA/compliance updates (regulatory monitoring)

**🏢 Specific Competitors:**
I can track up to 5 direct competitors. Who should I monitor?
- [Suggest 2-3 based on their industry/ICPs]
- Any others you want me to add?

**🌐 Website Monitoring Setup:**
For each competitor, I need their website information:

**Competitor 1: [Company Name]**
- Primary website URL: (e.g., www.salesforce.com)
- Key pages to monitor: 
  ✅ /pricing/ (recommended - catches price changes)
  ✅ /products/ (recommended - catches new launches)
  ✅ /news/ or /blog/ (recommended - catches announcements)
  □ Other specific pages? (you can add any)

**Competitor 2: [Company Name]**
[Same format]

**Advanced Options:**
- High-priority monitoring (check hourly for critical changes)
- Standard monitoring (check daily)
- Low-priority monitoring (check weekly)

**📈 Market Intelligence:**
✅ VC funding announcements in your space
✅ Technology trend analysis
✅ Industry conference/event announcements

Does this coverage look good?"
```

#### Path B: User Hesitates → Value Clarification

**SAM's Response:**
```
"No worries! Let me explain what this gives you:

**🚨 Recent Example:**
Last month, a healthcare SaaS company's competitor suddenly dropped their prices by 30%. Companies with monitoring caught this on day 1 and adjusted their strategy. Those without monitoring found out 3 weeks later when they started losing deals.

**💰 What This Usually Costs:**
- Bloomberg Terminal: $24,000/year
- Industry research subscriptions: $5,000-15,000/year  
- Our system: FREE (uses public data sources)

**⏱️ Time Savings:**
Instead of spending 2 hours/week manually checking competitor websites and news, you get everything delivered to your inbox.

**🎯 Relevance:**
Only alerts relevant to YOUR ICPs and competitors - no information overload.

Still want to think about it? I can always set this up later when you're ready."
```

#### Path C: User Says No → Soft Follow-up

**SAM's Response:**
```
"No problem at all! You can always enable monitoring later from your dashboard settings.

For now, let's move forward with your campaign creation. You have solid ICPs and great prospect lists - that's the foundation for success.

*Quick tip: Most users who initially skip monitoring end up enabling it within their first month when they realize how much competitive intelligence they're missing.*

Ready to build your first campaign?"
```

---

## Technical Setup Configuration

### In-App Setup Interface

```typescript
interface MonitoringSetupInterface {
  // Email Notification Preferences
  email_preferences: {
    frequency: 'real_time' | 'daily' | 'weekly' | 'monthly'
    email_address: string // defaults to account email
    time_zone: string
    preferred_time: string // "8:00 AM" for daily digest
  }
}

interface WebsiteMonitoringConfig {
  company_name: string
  primary_website: string
  specific_pages_to_monitor: string[]
  monitoring_priority: 'high' | 'medium' | 'low'
  change_sensitivity: 'high' | 'medium' | 'low'
  monitoring_frequency: 'real_time' | 'hourly' | 'daily' | 'weekly'
  custom_selectors?: CustomSelector[]
  ignore_elements?: string[]  // CSS selectors to ignore
}

interface CustomSelector {
  name: string
  css_selector?: string
  xpath_selector?: string
  description: string
}

interface MonitoringSetupInterface {
  
  // Monitoring Categories
  monitoring_categories: {
    competitor_intelligence: {
      enabled: boolean
      competitors_to_track: CompetitorSelection[]
      website_monitoring: WebsiteMonitoringConfig[]
      alert_on_pricing_changes: boolean
      alert_on_product_updates: boolean
      alert_on_funding_news: boolean
      alert_on_website_changes: boolean
    }
    
    industry_intelligence: {
      enabled: boolean
      industries: IndustrySelection[] // based on user ICPs
      include_funding_news: boolean
      include_regulatory_updates: boolean
      include_technology_trends: boolean
    }
    
    regulatory_monitoring: {
      enabled: boolean
      regulatory_frameworks: RegulatoryFramework[] // HIPAA, GDPR, etc.
      compliance_deadline_alerts: boolean
      policy_change_notifications: boolean
    }
    
    market_intelligence: {
      enabled: boolean
      vc_funding_alerts: boolean
      ma_activity_tracking: boolean
      ipo_announcements: boolean
      market_research_updates: boolean
    }
  }
  
  // Alert Thresholds
  alert_thresholds: {
    critical_alert_triggers: CriticalAlertTrigger[]
    high_priority_keywords: string[]
    competitor_mention_alerts: boolean
    funding_amount_threshold: number // alert for funding > $X million
  }
}
```

### SAM's Configuration Questions

```typescript
interface SAMConfigurationFlow {
  // Step 1: Email Preferences
  email_setup: {
    sam_question: "What email should I send your monitoring updates to?"
    default_value: "user.account_email"
    validation: "email_format_validation"
    
    follow_up: "How often would you like updates?"
    options: [
      {
        value: 'daily',
        description: 'Daily digest at 8 AM (recommended for active monitoring)',
        recommended: true
      },
      {
        value: 'weekly', 
        description: 'Weekly summary every Monday (good for staying informed)',
        recommended: false
      },
      {
        value: 'real_time',
        description: 'Immediate alerts for critical events only',
        recommended: false
      }
    ]
  }
  
  // Step 2: Competitor Selection & Website URLs
  competitor_setup: {
    sam_question: "Which competitors should I track? I can monitor up to 5 companies."
    
    auto_suggestions: "based_on_user_icps_and_industry"
    
    suggested_competitors: [
      // Healthcare SaaS example
      "Salesforce Health Cloud",
      "Epic Systems", 
      "Cerner (Oracle Health)",
      // General SaaS example  
      "HubSpot",
      "Pipedrive",
      "Monday.com"
    ]
    
    custom_input: "Any other specific competitors you want me to track?"
    
    website_url_collection: {
      sam_follow_up: "Great! Now I need the website URLs for each competitor so I can track changes:"
      
      url_input_format: {
        company_name: "string"
        primary_website: "string"  // e.g., "www.salesforce.com"
        specific_pages_to_monitor: "string[]"  // e.g., ["/pricing/", "/products/", "/news/"]
        monitoring_priority: "high | medium | low"
      }
      
      example_input: {
        company_name: "HubSpot"
        primary_website: "www.hubspot.com"
        specific_pages_to_monitor: ["/pricing/", "/products/marketing/", "/blog/"]
        monitoring_priority: "high"
      }
      
      sam_guidance: "I'll automatically discover common pages like /pricing, /products, /news, but you can specify exact URLs you're most interested in monitoring."
    }
  }
  
  // Step 3: Industry Focus
  industry_setup: {
    sam_question: "Based on your ICPs, I'll automatically track these industries:"
    
    auto_enabled: "derive_from_user_icps"
    
    confirmation: "Should I also include adjacent markets that might affect your space?"
    
    examples: [
      "If healthcare ICP → also track healthtech venture funding",
      "If SaaS ICP → also track API economy developments", 
      "If fintech ICP → also track banking regulation changes"
    ]
  }
}
```

---

## Email Digest Templates

### Daily Digest Template

```html
<!DOCTYPE html>
<html>
<head>
    <title>SAM AI Daily Intelligence Digest</title>
</head>
<body>
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        
        <!-- Header -->
        <div style="background: #2563eb; color: white; padding: 20px; text-align: center;">
            <h1>🎯 Your Daily Intelligence Digest</h1>
            <p>{{date}} | Personalized for {{user_name}}</p>
        </div>
        
        <!-- Critical Alerts Section -->
        {{#if critical_alerts}}
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
            <h2 style="color: #dc2626; margin-top: 0;">🚨 Critical Alerts</h2>
            {{#each critical_alerts}}
            <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px;">
                <h3 style="color: #dc2626; margin: 0;">{{title}}</h3>
                <p>{{description}}</p>
                <p style="font-size: 12px; color: #666;">Source: {{source}} | {{timestamp}}</p>
            </div>
            {{/each}}
        </div>
        {{/if}}
        
        <!-- Competitor Intelligence -->
        {{#if competitor_updates}}
        <div style="margin: 20px 0;">
            <h2 style="color: #1e40af;">🔍 Competitor Intelligence</h2>
            {{#each competitor_updates}}
            <div style="margin: 15px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 5px;">
                <h3 style="margin-top: 0;">{{competitor_name}}</h3>
                <p><strong>{{update_type}}:</strong> {{description}}</p>
                <a href="{{source_url}}" style="color: #2563eb;">Read More →</a>
                <p style="font-size: 12px; color: #666;">{{timestamp}}</p>
            </div>
            {{/each}}
        </div>
        {{/if}}
        
        <!-- Industry News -->
        {{#if industry_news}}
        <div style="margin: 20px 0;">
            <h2 style="color: #1e40af;">📰 Industry News</h2>
            {{#each industry_news}}
            <div style="margin: 15px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 5px;">
                <h3 style="margin-top: 0;"><a href="{{url}}" style="color: #1e40af; text-decoration: none;">{{title}}</a></h3>
                <p>{{summary}}</p>
                <p style="font-size: 12px; color: #666;">{{source}} | {{timestamp}}</p>
            </div>
            {{/each}}
        </div>
        {{/if}}
        
        <!-- Market Intelligence -->
        {{#if market_intelligence}}
        <div style="margin: 20px 0;">
            <h2 style="color: #1e40af;">📊 Market Intelligence</h2>
            {{#each market_intelligence}}
            <div style="margin: 15px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 5px;">
                <h3 style="margin-top: 0;">{{title}}</h3>
                <p>{{description}}</p>
                <p style="font-size: 12px; color: #666;">{{source}} | {{timestamp}}</p>
            </div>
            {{/each}}
        </div>
        {{/if}}
        
        <!-- AI Insights -->
        {{#if ai_insights}}
        <div style="background: #f0f9ff; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h2 style="color: #1e40af; margin-top: 0;">🤖 SAM's AI Insights</h2>
            {{#each ai_insights}}
            <div style="margin: 10px 0;">
                <p><strong>{{insight_type}}:</strong> {{description}}</p>
                {{#if recommended_actions}}
                <ul>
                    {{#each recommended_actions}}
                    <li>{{this}}</li>
                    {{/each}}
                </ul>
                {{/if}}
            </div>
            {{/each}}
        </div>
        {{/if}}
        
        <!-- Footer -->
        <div style="background: #f9fafb; padding: 20px; text-align: center; margin-top: 30px;">
            <p style="margin: 0; color: #666;">
                <a href="{{dashboard_url}}" style="color: #2563eb;">View Full Dashboard</a> | 
                <a href="{{settings_url}}" style="color: #2563eb;">Update Preferences</a> | 
                <a href="{{unsubscribe_url}}" style="color: #666;">Unsubscribe</a>
            </p>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">
                This digest was generated by SAM AI based on your ICPs and monitoring preferences.
            </p>
        </div>
        
    </div>
</body>
</html>
```

### Weekly Summary Template

```html
<!-- Similar structure but with weekly aggregation -->
<div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
    <h1>📈 Your Weekly Intelligence Summary</h1>
    <p>Week of {{week_start_date}} - {{week_end_date}} | {{user_name}}</p>
</div>

<!-- Week's Top Stories -->
<div style="margin: 20px 0;">
    <h2 style="color: #1e40af;">🏆 Week's Top Stories</h2>
    <div style="background: #f0f9ff; padding: 15px; border-radius: 5px;">
        <p><strong>Most Important Development:</strong> {{top_story_title}}</p>
        <p>{{top_story_description}}</p>
        <p><strong>Impact on Your ICPs:</strong> {{icp_impact_analysis}}</p>
    </div>
</div>

<!-- Trend Analysis -->
<div style="margin: 20px 0;">
    <h2 style="color: #1e40af;">📊 Trend Analysis</h2>
    {{#each weekly_trends}}
    <div style="margin: 15px 0; padding: 15px; border: 1px solid #e5e7eb; border-radius: 5px;">
        <h3>{{trend_title}}</h3>
        <p>{{trend_description}}</p>
        <p><strong>Frequency this week:</strong> {{mention_count}} mentions</p>
        <p><strong>Sentiment:</strong> {{sentiment_analysis}}</p>
    </div>
    {{/each}}
</div>
```

---

## In-App Monitoring Dashboard

### Dashboard Integration

```typescript
interface MonitoringDashboardIntegration {
  // Dashboard Components
  dashboard_components: {
    monitoring_status_widget: {
      active_monitors: number
      last_update: timestamp
      alert_count_today: number
      system_health: 'healthy' | 'warning' | 'error'
    }
    
    recent_alerts_feed: {
      critical_alerts: RecentAlert[]
      competitor_updates: CompetitorUpdate[]
      industry_news: IndustryNews[]
      display_limit: 10
    }
    
    monitoring_configuration_panel: {
      email_preferences: EmailPreferences
      competitor_list: CompetitorList
      industry_categories: IndustryCategory[]
      alert_thresholds: AlertThreshold[]
    }
    
    intelligence_insights: {
      ai_generated_insights: AIInsight[]
      trend_analysis: TrendAnalysis[]
      competitive_recommendations: CompetitiveRecommendation[]
      market_opportunities: MarketOpportunity[]
    }
  }
  
  // Quick Actions
  quick_actions: {
    add_competitor: "Add new competitor to track"
    adjust_frequency: "Change email notification frequency"
    mute_category: "Temporarily mute category (1 day, 1 week, permanently)"
    mark_as_read: "Mark alerts as read"
    export_digest: "Export this week's intelligence as PDF"
  }
}
```

This comprehensive monitoring setup flow ensures users understand the value proposition and can easily configure their personalized intelligence system, keeping them ahead of market changes and competitive threats.