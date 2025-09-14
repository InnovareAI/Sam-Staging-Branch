# Website Change Detection System
Version: v1.0 | Created: 2025-09-14

## Purpose
This document defines the comprehensive website change detection system using N8N workflows to automatically track competitor product launches, feature updates, pricing changes, and strategic announcements across multiple website sections.

---

## Website Change Detection Framework

### User-Provided Website Configuration

```typescript
interface UserWebsiteConfiguration {
  // User-Provided Competitor Websites
  competitor_websites: {
    user_provided_urls: CompetitorWebsite[]
    auto_discovered_pages: AutoDiscoveredPage[]
    monitoring_preferences: MonitoringPreferences
  }
  
  // Individual Competitor Website Setup
  competitor_website: {
    company_name: string
    primary_domain: string  // e.g., "salesforce.com"
    user_provided_urls: string[]  // Specific URLs user wants monitored
    auto_detection_enabled: boolean  // Auto-discover related pages
    monitoring_priority: 'high' | 'medium' | 'low'
    custom_selectors: CustomSelector[]  // Specific elements to watch
  }
}

interface CompetitorWebsite {
  company_name: string
  primary_domain: string
  user_provided_urls: string[]
  monitoring_settings: {
    frequency: 'real_time' | 'hourly' | 'daily' | 'weekly'
    change_sensitivity: 'high' | 'medium' | 'low'
    alert_threshold: number  // minimum change percentage to alert
    page_sections_to_watch: PageSection[]
  }
}

interface PageSection {
  section_name: string
  css_selector?: string
  xpath_selector?: string
  content_area?: 'full_page' | 'main_content' | 'specific_element'
  ignore_elements?: string[]  // CSS selectors to ignore (dates, counters, etc.)
}
```

### Multi-Page Monitoring Strategy

```typescript
interface WebsiteChangeDetectionFramework {
  // Competitor Website Sections to Monitor
  monitored_sections: {
    product_pages: {
      pages: ['/products/', '/features/', '/solutions/', '/platform/']
      detection_targets: ['new_products', 'feature_updates', 'capability_changes']
      change_sensitivity: 'medium' // detect meaningful changes, ignore minor updates
      monitoring_frequency: 'daily'
    }
    
    pricing_pages: {
      pages: ['/pricing/', '/plans/', '/packages/', '/cost/']
      detection_targets: ['price_changes', 'plan_modifications', 'new_tiers']
      change_sensitivity: 'high' // detect any pricing modifications
      monitoring_frequency: 'daily'
    }
    
    news_announcements: {
      pages: ['/news/', '/blog/', '/press/', '/announcements/', '/releases/']
      detection_targets: ['product_launches', 'partnerships', 'funding_news', 'executive_changes']
      change_sensitivity: 'high'
      monitoring_frequency: 'twice_daily'
    }
    
    about_company: {
      pages: ['/about/', '/company/', '/leadership/', '/investors/']
      detection_targets: ['leadership_changes', 'funding_updates', 'strategic_shifts']
      change_sensitivity: 'medium'
      monitoring_frequency: 'weekly'
    }
    
    careers_hiring: {
      pages: ['/careers/', '/jobs/', '/hiring/', '/team/']
      detection_targets: ['hiring_patterns', 'new_roles', 'team_expansion']
      change_sensitivity: 'low'
      monitoring_frequency: 'weekly'
    }
  }
  
  // Change Detection Methods
  detection_methods: {
    content_hashing: 'MD5 hash comparison for exact change detection'
    semantic_analysis: 'NLP comparison for meaningful content changes'
    visual_diff: 'Screenshot comparison for layout changes'
    structured_data_extraction: 'Extract specific data points (prices, features, dates)'
  }
  
  // Alert Prioritization
  alert_priorities: {
    critical: ['pricing_changes', 'new_product_launches', 'major_feature_updates']
    high: ['partnership_announcements', 'funding_news', 'executive_changes']
    medium: ['blog_posts', 'case_studies', 'minor_feature_updates']
    low: ['job_postings', 'event_announcements', 'company_updates']
  }
}
```

---

## N8N Website Change Detection Workflows

### Comprehensive Competitor Monitoring Workflow

```json
{
  "name": "Comprehensive Website Change Detection",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 12
            }
          ]
        }
      },
      "name": "Twice Daily Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [240, 300]
    },
    {
      "parameters": {
        "values": {
          "string": [
            {
              "name": "competitors",
              "value": "salesforce,hubspot,apollo,pipedrive,monday,notion"
            }
          ]
        },
        "options": {}
      },
      "name": "Competitor List",
      "type": "n8n-nodes-base.set",
      "typeVersion": 1,
      "position": [420, 300]
    },
    {
      "parameters": {
        "jsCode": "// Generate URL combinations for each competitor\nconst competitors = $json.competitors.split(',');\nconst pagesToMonitor = [\n  '/products/',\n  '/pricing/', \n  '/features/',\n  '/news/',\n  '/blog/',\n  '/about/',\n  '/careers/'\n];\n\nconst urlsToCheck = [];\n\ncompetitors.forEach(competitor => {\n  const baseUrl = getCompetitorBaseUrl(competitor);\n  \n  pagesToMonitor.forEach(page => {\n    urlsToCheck.push({\n      competitor: competitor,\n      page_type: getPageType(page),\n      url: baseUrl + page,\n      priority: getPagePriority(page)\n    });\n  });\n});\n\nfunction getCompetitorBaseUrl(competitor) {\n  const urlMap = {\n    'salesforce': 'https://www.salesforce.com',\n    'hubspot': 'https://www.hubspot.com',\n    'apollo': 'https://www.apollo.io',\n    'pipedrive': 'https://www.pipedrive.com',\n    'monday': 'https://monday.com',\n    'notion': 'https://www.notion.so'\n  };\n  return urlMap[competitor] || `https://www.${competitor}.com`;\n}\n\nfunction getPageType(page) {\n  const typeMap = {\n    '/products/': 'product_page',\n    '/pricing/': 'pricing_page',\n    '/features/': 'feature_page', \n    '/news/': 'news_page',\n    '/blog/': 'blog_page',\n    '/about/': 'about_page',\n    '/careers/': 'careers_page'\n  };\n  return typeMap[page] || 'unknown';\n}\n\nfunction getPagePriority(page) {\n  const priorityMap = {\n    '/pricing/': 'critical',\n    '/products/': 'critical',\n    '/features/': 'high',\n    '/news/': 'high',\n    '/blog/': 'medium',\n    '/about/': 'medium',\n    '/careers/': 'low'\n  };\n  return priorityMap[page] || 'low';\n}\n\nreturn urlsToCheck.map(url => ({ json: url }));"
      },
      "name": "Generate Monitoring URLs",
      "type": "n8n-nodes-base.code",
      "typeVersion": 1,
      "position": [600, 300]
    },
    {
      "parameters": {
        "requestMethod": "GET",
        "url": "={{$json.url}}",
        "options": {
          "headers": {
            "User-Agent": "Mozilla/5.0 (compatible; SAM-AI-Monitor/1.0)"
          },
          "timeout": 30000
        }
      },
      "name": "Fetch Website Content",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [800, 300]
    },
    {
      "parameters": {
        "jsCode": "// Extract and process website content\nconst crypto = require('crypto');\nconst cheerio = require('cheerio');\n\nfor (const item of $input.all()) {\n  try {\n    const $ = cheerio.load(item.json.data);\n    \n    // Remove dynamic elements that change frequently\n    $('script, style, .timestamp, .date, .time').remove();\n    $('[id*=\"timestamp\"], [class*=\"timestamp\"]').remove();\n    \n    // Extract structured data based on page type\n    let extractedData = {};\n    \n    switch(item.json.page_type) {\n      case 'pricing_page':\n        extractedData = extractPricingData($);\n        break;\n      case 'product_page':\n        extractedData = extractProductData($);\n        break;\n      case 'news_page':\n        extractedData = extractNewsData($);\n        break;\n      case 'feature_page':\n        extractedData = extractFeatureData($);\n        break;\n      default:\n        extractedData = extractGeneralData($);\n    }\n    \n    // Create content hash\n    const cleanContent = $.root().text().replace(/\\s+/g, ' ').trim();\n    const contentHash = crypto.createHash('md5').update(cleanContent).digest('hex');\n    \n    item.json.extracted_data = extractedData;\n    item.json.content_hash = contentHash;\n    item.json.content_length = cleanContent.length;\n    item.json.page_title = $('title').text().trim();\n    item.json.meta_description = $('meta[name=\"description\"]').attr('content') || '';\n    item.json.last_checked = new Date().toISOString();\n    \n  } catch (error) {\n    item.json.error = error.message;\n  }\n}\n\nfunction extractPricingData($) {\n  const prices = [];\n  const plans = [];\n  \n  // Common pricing selectors\n  $('.price, .pricing, .cost, [data-price]').each((i, elem) => {\n    prices.push($(elem).text().trim());\n  });\n  \n  $('.plan, .tier, .package').each((i, elem) => {\n    plans.push({\n      name: $(elem).find('.plan-name, .tier-name').text().trim(),\n      price: $(elem).find('.price').text().trim(),\n      features: $(elem).find('ul li').map((j, li) => $(li).text().trim()).get()\n    });\n  });\n  \n  return { prices, plans };\n}\n\nfunction extractProductData($) {\n  const products = [];\n  const features = [];\n  \n  $('.product, .solution').each((i, elem) => {\n    products.push({\n      name: $(elem).find('h1, h2, h3').first().text().trim(),\n      description: $(elem).find('p').first().text().trim()\n    });\n  });\n  \n  $('.feature').each((i, elem) => {\n    features.push($(elem).text().trim());\n  });\n  \n  return { products, features };\n}\n\nfunction extractNewsData($) {\n  const articles = [];\n  \n  $('.article, .news-item, .post').each((i, elem) => {\n    articles.push({\n      title: $(elem).find('h1, h2, h3').first().text().trim(),\n      date: $(elem).find('.date, .published, time').first().text().trim(),\n      summary: $(elem).find('p').first().text().trim().substring(0, 200)\n    });\n  });\n  \n  return { articles };\n}\n\nfunction extractFeatureData($) {\n  const features = [];\n  \n  $('.feature, .capability').each((i, elem) => {\n    features.push({\n      name: $(elem).find('h3, h4').first().text().trim(),\n      description: $(elem).find('p').first().text().trim()\n    });\n  });\n  \n  return { features };\n}\n\nfunction extractGeneralData($) {\n  return {\n    headings: $('h1, h2, h3').map((i, elem) => $(elem).text().trim()).get(),\n    images: $('img').map((i, elem) => $(elem).attr('alt')).get().filter(alt => alt)\n  };\n}\n\nreturn $input.all();"
      },
      "name": "Process & Extract Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 1,
      "position": [1000, 300]
    },
    {
      "parameters": {
        "operation": "select",
        "table": "website_monitoring_history",
        "where": {\n          "competitor": "={{$json.competitor}}",\n          "page_type": "={{$json.page_type}}"\n        },\n        "sort": {\n          "created_at": "DESC"\n        },\n        "limit": 1\n      },\n      "name": "Get Previous Version",\n      "type": "n8n-nodes-base.supabase",\n      "typeVersion": 1,\n      "position": [1200, 300]\n    },\n    {\n      "parameters": {\n        "conditions": {\n          "string": [\n            {\n              "value1": "={{$json.content_hash}}",\n              "operation": "notEqual",\n              "value2": "={{$('Get Previous Version').all()[0]?.json?.content_hash || 'no-previous-hash'}}"\n            }\n          ]\n        }\n      },\n      "name": "Detect Changes",\n      "type": "n8n-nodes-base.if",\n      "typeVersion": 1,\n      "position": [1400, 300]\n    },\n    {\n      "parameters": {\n        "jsCode": "// Analyze the type and significance of changes\nfor (const item of $input.all()) {\n  const current = item.json;\n  const previous = $('Get Previous Version').all()[0]?.json;\n  \n  if (!previous) {\n    current.change_type = 'initial_capture';\n    current.change_significance = 'info';\n    continue;\n  }\n  \n  const changes = {\n    pricing_changes: [],\n    product_changes: [],\n    content_changes: [],\n    structural_changes: []\n  };\n  \n  // Analyze pricing changes\n  if (current.page_type === 'pricing_page' && previous.extracted_data) {\n    const currentPrices = JSON.stringify(current.extracted_data.prices || []);\n    const previousPrices = JSON.stringify(previous.extracted_data.prices || []);\n    \n    if (currentPrices !== previousPrices) {\n      changes.pricing_changes.push({\n        type: 'price_modification',\n        previous: previous.extracted_data.prices,\n        current: current.extracted_data.prices\n      });\n    }\n  }\n  \n  // Analyze product changes\n  if (current.page_type === 'product_page' && previous.extracted_data) {\n    const currentProducts = JSON.stringify(current.extracted_data.products || []);\n    const previousProducts = JSON.stringify(previous.extracted_data.products || []);\n    \n    if (currentProducts !== previousProducts) {\n      changes.product_changes.push({\n        type: 'product_modification',\n        previous: previous.extracted_data.products,\n        current: current.extracted_data.products\n      });\n    }\n  }\n  \n  // Determine overall change significance\n  let significance = 'low';\n  \n  if (changes.pricing_changes.length > 0) {\n    significance = 'critical';\n  } else if (changes.product_changes.length > 0) {\n    significance = 'high';\n  } else if (Math.abs(current.content_length - (previous.content_length || 0)) > 500) {\n    significance = 'medium';\n  }\n  \n  current.changes_detected = changes;\n  current.change_significance = significance;\n  current.change_type = 'content_update';\n}\n\nreturn $input.all();"
      },\n      "name": "Analyze Changes",\n      "type": "n8n-nodes-base.code",\n      "typeVersion": 1,\n      "position": [1600, 200]\n    },\n    {\n      "parameters": {\n        "operation": "insert",\n        "table": "website_monitoring_history",\n        "columns": "competitor, page_type, url, content_hash, extracted_data, page_title, change_type, change_significance, changes_detected, created_at"\n      },\n      "name": "Store Change Record",\n      "type": "n8n-nodes-base.supabase",\n      "typeVersion": 1,\n      "position": [1800, 200]\n    },\n    {\n      "parameters": {\n        "conditions": {\n          "string": [\n            {\n              "value1": "={{$json.change_significance}}",\n              "operation": "equal",\n              "value2": "critical"\n            }\n          ]\n        }\n      },\n      "name": "Critical Change Alert",\n      "type": "n8n-nodes-base.if",\n      "typeVersion": 1,\n      "position": [1600, 400]\n    },\n    {\n      "parameters": {\n        "channel": "#competitive-intelligence",\n        "text": "🚨 CRITICAL: {{$json.competitor}} website change detected!\\n\\n**Page:** {{$json.page_type}}\\n**URL:** {{$json.url}}\\n**Change Type:** {{$json.change_type}}\\n**Details:** {{JSON.stringify($json.changes_detected)}}\\n**Time:** {{$json.last_checked}}"\n      },\n      "name": "Slack Critical Alert",\n      "type": "n8n-nodes-base.slack",\n      "typeVersion": 1,\n      "position": [1800, 400]\n    }\n  ]\n}\n```\n\n---\n\n## Website Change Intelligence Features\n\n### Intelligent Change Detection\n\n```typescript\ninterface IntelligentChangeDetection {\n  // Content Processing\n  content_processing: {\n    noise_filtering: {\n      remove_elements: ['timestamps', 'dynamic_dates', 'session_ids', 'csrf_tokens']\n      normalize_whitespace: true\n      ignore_minor_formatting: true\n    }\n    \n    semantic_analysis: {\n      detect_new_products: 'Identify new product announcements'\n      detect_feature_updates: 'Track feature additions/removals'\n      detect_pricing_changes: 'Monitor price modifications'\n      detect_partnership_news: 'Catch partnership announcements'\n    }\n    \n    structured_extraction: {\n      pricing_data: 'Extract pricing tables, plans, costs'\n      product_features: 'List product capabilities and features'\n      company_news: 'Extract press releases and announcements'\n      team_updates: 'Track leadership and hiring changes'\n    }\n  }\n  \n  // Change Classification\n  change_classification: {\n    critical_changes: [\n      'pricing_modifications',\n      'new_product_launches', \n      'major_feature_releases',\n      'acquisition_announcements'\n    ]\n    \n    high_priority_changes: [\n      'partnership_announcements',\n      'funding_news',\n      'executive_changes',\n      'strategic_pivots'\n    ]\n    \n    medium_priority_changes: [\n      'blog_post_additions',\n      'case_study_updates',\n      'minor_feature_updates',\n      'event_announcements'\n    ]\n    \n    low_priority_changes: [\n      'job_postings',\n      'footer_updates',\n      'contact_information_changes',\n      'social_media_links'\n    ]\n  }\n}\n```\n\n### Product Launch Detection\n\n```typescript\ninterface ProductLaunchDetection {\n  // Launch Indicators\n  launch_indicators: {\n    new_product_pages: {\n      detection_method: 'Monitor /products/ URL structure changes'\n      confidence_threshold: 0.8\n      validation_checks: ['new_URLs', 'navigation_changes', 'sitemap_updates']\n    }\n    \n    feature_announcements: {\n      detection_method: 'Scan for \"new\", \"introducing\", \"now available\" keywords'\n      content_analysis: 'NLP processing of product descriptions'\n      timeline_tracking: 'Track announcement dates and rollout phases'\n    }\n    \n    pricing_page_additions: {\n      detection_method: 'Monitor pricing table changes'\n      new_tier_detection: 'Identify new subscription tiers or plans'\n      feature_comparison_updates: 'Track feature matrix changes'\n    }\n  }\n  \n  // Launch Intelligence\n  launch_intelligence: {\n    competitive_impact_analysis: {\n      feature_overlap: 'Compare new features to user\'s product'\n      market_positioning: 'Analyze competitive positioning changes'\n      pricing_implications: 'Assess pricing strategy impact'\n    }\n    \n    market_opportunity_assessment: {\n      market_gap_identification: 'Identify gaps in competitor offerings'\n      differentiation_opportunities: 'Find unique positioning angles'\n      timing_advantages: 'Assess market entry timing'\n    }\n  }\n}\n```\n\n---\n\n## SAM AI Integration for Website Changes\n\n### Enhanced Monitoring Offer\n\n```\n\"I can also track your competitors' websites to catch:\n\n🚀 **Product Launches** - New features, services, or entire products\n💰 **Pricing Changes** - Price increases, new plans, promotional offers  \n📢 **Strategic Announcements** - Partnerships, funding, acquisitions\n🎯 **Feature Updates** - New capabilities that might affect your positioning\n👥 **Team Changes** - New hires, leadership changes, expansion signals\n\nThis gives you early warning on competitive moves, often days or weeks before they announce it publicly.\"\n```\n\n### Website Change Alerts in Email Digest\n\n```html\n<!-- Website Changes Section -->\n<div style=\"margin: 20px 0;\">\n    <h2 style=\"color: #1e40af;\">🔍 Website Intelligence</h2>\n    \n    {{#if critical_website_changes}}\n    <div style=\"background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0;\">\n        <h3 style=\"color: #dc2626; margin-top: 0;\">Critical Changes Detected</h3>\n        {{#each critical_website_changes}}\n        <div style=\"margin: 10px 0;\">\n            <strong>{{competitor_name}}</strong> - {{page_type}}\n            <p>{{change_description}}</p>\n            <a href=\"{{url}}\" style=\"color: #2563eb;\">View Changes →</a>\n        </div>\n        {{/each}}\n    </div>\n    {{/if}}\n    \n    {{#if product_launches}}\n    <div style=\"background: #f0f9ff; padding: 15px; margin: 15px 0; border-radius: 5px;\">\n        <h3 style=\"color: #1e40af; margin-top: 0;\">🚀 Product Launches Detected</h3>\n        {{#each product_launches}}\n        <div style=\"margin: 10px 0;\">\n            <strong>{{competitor_name}}</strong> launched: {{product_name}}\n            <p>{{launch_summary}}</p>\n            <p><strong>Competitive Impact:</strong> {{competitive_impact}}</p>\n        </div>\n        {{/each}}\n    </div>\n    {{/if}}\n    \n    {{#if pricing_changes}}\n    <div style=\"background: #fff7ed; padding: 15px; margin: 15px 0; border-radius: 5px;\">\n        <h3 style=\"color: #ea580c; margin-top: 0;\">💰 Pricing Updates</h3>\n        {{#each pricing_changes}}\n        <div style=\"margin: 10px 0;\">\n            <strong>{{competitor_name}}</strong>: {{change_type}}\n            <p>Previous: {{previous_pricing}}</p>\n            <p>New: {{current_pricing}}</p>\n        </div>\n        {{/each}}\n    </div>\n    {{/if}}\n</div>\n```\n\nThis comprehensive website change detection system ensures users never miss critical competitive moves like product launches, pricing changes, or strategic announcements, giving them a significant advantage in market positioning and strategic planning.