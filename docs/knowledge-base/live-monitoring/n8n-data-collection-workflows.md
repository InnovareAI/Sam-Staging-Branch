# N8N Data Collection Workflows for Live Monitoring
Version: v1.0 | Created: 2025-09-14

## Purpose
This document defines N8N workflow specifications for automated data collection from free sources, replacing custom scraping infrastructure with visual workflow automation for competitive intelligence and industry monitoring.

---

## N8N Workflow Architecture

### Core Data Collection Workflows

```typescript
interface N8NDataCollectionWorkflows {
  // Google News RSS Monitoring
  google_news_workflow: {
    trigger: 'Schedule: Every 2 hours'
    nodes: [
      'RSS Feed Read (Google News)',
      'Data Filter (Remove duplicates)',
      'Text Processing (Extract entities)',
      'PostgreSQL Insert (Store articles)',
      'Slack Alert (For high-priority news)'
    ]
    cost: 'FREE execution'
  }
  
  // Competitor Website Monitoring
  competitor_monitoring_workflow: {
    trigger: 'Schedule: Daily at 6 AM'
    nodes: [
      'HTTP Request (Competitor pages)',
      'HTML Extract (Price, features, news)',
      'Compare (Detect changes)',
      'Conditional (If changes detected)',
      'Supabase Insert (Log changes)',
      'Email Alert (Notify team)'
    ]
    cost: 'FREE execution'
  }
  
  // Social Media Intelligence
  social_monitoring_workflow: {
    trigger: 'Schedule: Every 4 hours'
    nodes: [
      'HTTP Request (LinkedIn company pages)',
      'HTTP Request (Twitter/X API)',
      'Reddit API (Industry subreddits)',
      'Merge Data',
      'Sentiment Analysis',
      'Database Store (Supabase)',
      'Dashboard Update'
    ]
    cost: 'FREE execution'
  }
  
  // Government/SEC Filing Monitor
  regulatory_monitoring_workflow: {
    trigger: 'Schedule: Daily at 8 AM'
    nodes: [
      'HTTP Request (SEC EDGAR API)',
      'HTTP Request (FDA RSS)',
      'HTTP Request (CMS Updates)',
      'JSON Parse',
      'Filter New Items',
      'Supabase Insert',
      'Alert Generation'
    ]
    cost: 'FREE execution'
  }
}
```

---

## Specific N8N Workflow Implementations

### Google News RSS Monitoring Workflow

```json
{
  "name": "Google News Competitive Intelligence",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 2
            }
          ]
        }
      },
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [240, 300]
    },
    {
      "parameters": {
        "url": "https://news.google.com/rss/search?q=healthcare+technology+funding",
        "options": {}
      },
      "name": "Healthcare Tech News",
      "type": "n8n-nodes-base.rssFeedRead",
      "typeVersion": 1,
      "position": [460, 200]
    },
    {
      "parameters": {
        "url": "https://news.google.com/rss/search?q=fintech+regulation",
        "options": {}
      },
      "name": "Fintech Regulation News",
      "type": "n8n-nodes-base.rssFeedRead",
      "typeVersion": 1,
      "position": [460, 320]
    },
    {
      "parameters": {
        "url": "https://news.google.com/rss/search?q=SaaS+startup+funding",
        "options": {}
      },
      "name": "SaaS Startup News",
      "type": "n8n-nodes-base.rssFeedRead",
      "typeVersion": 1,
      "position": [460, 440]
    },
    {
      "parameters": {
        "mode": "combine",
        "combineBy": "combineAll"
      },
      "name": "Merge News Sources",
      "type": "n8n-nodes-base.merge",
      "typeVersion": 2,
      "position": [680, 320]
    },
    {
      "parameters": {
        "conditions": {
          "dateTime": [
            {
              "value1": "={{new Date($json.pubDate).getTime()}}",
              "operation": "after",
              "value2": "={{new Date(Date.now() - 2*60*60*1000).getTime()}}"
            }
          ]
        }
      },
      "name": "Filter Recent Articles",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [900, 320]
    },
    {
      "parameters": {
        "operation": "insert",
        "table": "news_articles",
        "columns": "title, link, published_date, summary, source, category, created_at",
        "additionalFields": {
          "returnFields": "*"
        }
      },
      "name": "Store in Supabase",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [1120, 320]
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [
        [
          {
            "node": "Healthcare Tech News",
            "type": "main",
            "index": 0
          },
          {
            "node": "Fintech Regulation News", 
            "type": "main",
            "index": 0
          },
          {
            "node": "SaaS Startup News",
            "type": "main", 
            "index": 0
          }
        ]
      ]
    },
    "Healthcare Tech News": {
      "main": [
        [
          {
            "node": "Merge News Sources",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

### Competitor Website Monitoring Workflow

```json
{
  "name": "Competitor Website Monitor",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "days",
              "daysInterval": 1
            }
          ]
        },
        "triggerAt": "06:00"
      },
      "name": "Daily Schedule",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [240, 300]
    },
    {
      "parameters": {
        "requestMethod": "GET",
        "url": "https://www.salesforce.com/products/sales-cloud/pricing/",
        "options": {
          "headers": {
            "User-Agent": "Mozilla/5.0 (compatible; SAM-AI-Monitor)"
          }
        }
      },
      "name": "Salesforce Pricing Check",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [460, 200]
    },
    {
      "parameters": {
        "requestMethod": "GET",
        "url": "https://www.salesforce.com/products/",
        "options": {
          "headers": {
            "User-Agent": "Mozilla/5.0 (compatible; SAM-AI-Monitor)"
          }
        }
      },
      "name": "Salesforce Products Page",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [460, 140]
    },
    {
      "parameters": {
        "requestMethod": "GET", 
        "url": "https://www.salesforce.com/news/",
        "options": {
          "headers": {
            "User-Agent": "Mozilla/5.0 (compatible; SAM-AI-Monitor)"
          }
        }
      },
      "name": "Salesforce News Page",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [460, 80]
    },
    {
      "parameters": {
        "requestMethod": "GET", 
        "url": "https://www.hubspot.com/pricing/sales",
        "options": {
          "headers": {
            "User-Agent": "Mozilla/5.0 (compatible; SAM-AI-Monitor)"
          }
        }
      },
      "name": "HubSpot Pricing Check",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [460, 320]
    },
    {
      "parameters": {
        "requestMethod": "GET",
        "url": "https://www.apollo.io/pricing",
        "options": {
          "headers": {
            "User-Agent": "Mozilla/5.0 (compatible; SAM-AI-Monitor)"
          }
        }
      },
      "name": "Apollo Pricing Check", 
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [460, 440]
    },
    {
      "parameters": {
        "jsCode": "// Extract pricing information from HTML\nconst cheerio = require('cheerio');\n\nfor (const item of $input.all()) {\n  const $ = cheerio.load(item.json.data);\n  \n  // Extract pricing elements (customize selectors per competitor)\n  const prices = [];\n  $('.pricing-card, .price, .cost').each((i, elem) => {\n    prices.push($(elem).text().trim());\n  });\n  \n  item.json.extracted_prices = prices;\n  item.json.page_title = $('title').text();\n  item.json.last_modified = $('meta[name=\"last-modified\"]').attr('content') || new Date().toISOString();\n}\n\nreturn $input.all();"
      },
      "name": "Extract Pricing Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 1,
      "position": [680, 320]
    },
    {
      "parameters": {
        "operation": "select",
        "table": "competitor_pricing_history",
        "where": {
          "competitor": "={{$json.competitor_name}}",
          "created_at": ">={{new Date(Date.now() - 24*60*60*1000).toISOString()}}"
        }
      },
      "name": "Get Previous Pricing",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [900, 320]
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{JSON.stringify($json.extracted_prices)}}",
              "operation": "notEqual",
              "value2": "={{JSON.stringify($('Get Previous Pricing').all()[0]?.json.pricing_data || [])}}"
            }
          ]
        }
      },
      "name": "Check for Changes",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [1120, 320]
    },
    {
      "parameters": {
        "operation": "insert",
        "table": "competitor_pricing_history",
        "columns": "competitor, pricing_data, page_title, detected_at, change_type",
        "additionalFields": {}
      },
      "name": "Log Price Change",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [1340, 240]
    },
    {
      "parameters": {
        "channel": "#competitive-intelligence",
        "text": "🚨 Competitor pricing change detected!\n\nCompetitor: {{$json.competitor_name}}\nPrevious: {{$('Get Previous Pricing').all()[0]?.json.pricing_data}}\nNew: {{$json.extracted_prices}}\nDetected: {{new Date().toISOString()}}"
      },
      "name": "Alert Team",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 1,
      "position": [1340, 400]
    }
  ]
}
```

### Social Media Intelligence Workflow

```json
{
  "name": "Social Media Intelligence Collection",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "hours",
              "hoursInterval": 6
            }
          ]
        }
      },
      "name": "Every 6 Hours",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [240, 300]
    },
    {
      "parameters": {
        "requestMethod": "GET",
        "url": "https://www.reddit.com/r/healthcare/new.json?limit=25",
        "options": {
          "headers": {
            "User-Agent": "SAM-AI-Research-Bot"
          }
        }
      },
      "name": "Reddit Healthcare",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [460, 200]
    },
    {
      "parameters": {
        "requestMethod": "GET",
        "url": "https://www.reddit.com/r/fintech/new.json?limit=25",
        "options": {
          "headers": {
            "User-Agent": "SAM-AI-Research-Bot"
          }
        }
      },
      "name": "Reddit Fintech",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [460, 320]
    },
    {
      "parameters": {
        "requestMethod": "GET",
        "url": "https://www.reddit.com/r/SaaS/new.json?limit=25",
        "options": {
          "headers": {
            "User-Agent": "SAM-AI-Research-Bot"
          }
        }
      },
      "name": "Reddit SaaS",
      "type": "n8n-nodes-base.httpRequest", 
      "typeVersion": 3,
      "position": [460, 440]
    },
    {
      "parameters": {
        "jsCode": "// Process Reddit JSON data\nfor (const item of $input.all()) {\n  const posts = item.json.data.children;\n  const processedPosts = [];\n  \n  posts.forEach(post => {\n    const postData = post.data;\n    processedPosts.push({\n      title: postData.title,\n      content: postData.selftext,\n      author: postData.author,\n      score: postData.score,\n      comments: postData.num_comments,\n      created: new Date(postData.created_utc * 1000).toISOString(),\n      subreddit: postData.subreddit,\n      url: 'https://reddit.com' + postData.permalink,\n      source: 'reddit',\n      platform: 'reddit'\n    });\n  });\n  \n  item.json = { posts: processedPosts };\n}\n\nreturn $input.all();"
      },
      "name": "Process Reddit Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 1,
      "position": [680, 320]
    },
    {
      "parameters": {
        "jsCode": "// Simple sentiment analysis\nconst positiveWords = ['great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'fantastic'];\nconst negativeWords = ['terrible', 'awful', 'hate', 'worst', 'bad', 'horrible', 'disappointed'];\n\nfor (const item of $input.all()) {\n  item.json.posts.forEach(post => {\n    const text = (post.title + ' ' + post.content).toLowerCase();\n    \n    const positiveCount = positiveWords.reduce((count, word) => {\n      return count + (text.split(word).length - 1);\n    }, 0);\n    \n    const negativeCount = negativeWords.reduce((count, word) => {\n      return count + (text.split(word).length - 1);\n    }, 0);\n    \n    post.sentiment_score = positiveCount - negativeCount;\n    post.sentiment = post.sentiment_score > 0 ? 'positive' : \n                    post.sentiment_score < 0 ? 'negative' : 'neutral';\n  });\n}\n\nreturn $input.all();"
      },
      "name": "Sentiment Analysis",
      "type": "n8n-nodes-base.code",
      "typeVersion": 1,
      "position": [900, 320]
    },
    {
      "parameters": {
        "operation": "insert",
        "table": "social_media_intelligence",
        "columns": "platform, source, title, content, author, sentiment, score, created_at, url"
      },
      "name": "Store Social Intelligence",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [1120, 320]
    }
  ]
}
```

---

## N8N Integration with SAM AI Knowledge Base

### Data Flow Architecture

```typescript
interface N8NKnowledgeBaseIntegration {
  // N8N → Supabase → SAM AI
  data_pipeline: {
    collection: 'N8N workflows gather data from free sources'
    storage: 'Direct insertion into Supabase knowledge base tables'
    processing: 'N8N handles deduplication, sentiment, categorization'
    consumption: 'SAM AI queries processed data via Supabase'
  }
  
  // Real-time Alert Integration
  alert_integration: {
    critical_alerts: 'N8N → Slack → Immediate team notification'
    high_priority: 'N8N → Email → 1-hour digest'
    medium_priority: 'N8N → Dashboard update → Daily summary'
    low_priority: 'N8N → Weekly report generation'
  }
  
  // Knowledge Base Updates
  kb_updates: {
    competitor_intelligence: 'Auto-update competitive profiles'
    market_trends: 'Auto-categorize and tag trend data'
    regulatory_changes: 'Auto-flag compliance requirement updates'
    icp_relevance: 'Auto-score news relevance to user ICPs'
  }
}
```

### N8N Workflow Management

```typescript
interface N8NWorkflowManagement {
  // Workflow Categories
  workflow_categories: {
    news_monitoring: {
      frequency: 'Every 2 hours'
      cost: 'FREE'
      execution_time: '~5 minutes'
      data_volume: '50-200 articles per run'
    }
    
    competitor_tracking: {
      frequency: 'Daily'
      cost: 'FREE'
      execution_time: '~10 minutes'
      data_volume: '5-20 competitor updates per run'
    }
    
    social_intelligence: {
      frequency: 'Every 6 hours'
      cost: 'FREE'
      execution_time: '~8 minutes'
      data_volume: '100-500 social posts per run'
    }
    
    regulatory_monitoring: {
      frequency: 'Daily'
      cost: 'FREE'
      execution_time: '~3 minutes'
      data_volume: '10-50 regulatory updates per run'
    }
  }
  
  // Error Handling & Reliability
  reliability_features: {
    retry_logic: 'Built-in N8N retry on HTTP failures'
    error_notifications: 'Slack alerts on workflow failures'
    data_validation: 'Schema validation before Supabase insert'
    rate_limit_handling: 'Automatic delays and backoff'
  }
}
```

---

## Cost Analysis with N8N

### Execution Cost Comparison

```typescript
interface N8NCostAnalysis {
  // N8N Self-Hosted (Recommended)
  n8n_self_hosted: {
    license_cost: '$0/month (Community Edition)'
    server_resources: '$20-50/month (existing server capacity)'
    maintenance: '2 hours/month setup and monitoring'
    total_monthly_cost: '$20-50/month'
  }
  
  // N8N Cloud (Alternative)
  n8n_cloud: {
    starter_plan: '$20/month (5K executions)'
    pro_plan: '$50/month (25K executions)' 
    estimated_executions: '15K/month for all workflows'
    recommended_plan: 'Pro ($50/month)'
  }
  
  // Custom Development Alternative
  custom_development: {
    development_time: '80-120 hours'
    developer_cost: '$8,000-12,000 one-time'
    maintenance: '$2,000/month ongoing'
    total_first_year: '$32,000-36,000'
  }
  
  // Cost Savings with N8N
  savings_analysis: {
    vs_custom_development: '$31,400-35,400/year saved'
    vs_premium_tools: '$29,000-35,000/year saved'
    roi_timeframe: 'Immediate positive ROI'
  }
}
```

### Implementation Roadmap

```typescript
interface N8NImplementationRoadmap {
  // Phase 1: Core Workflows (Week 1)
  phase_1: {
    workflows: ['Google News RSS', 'Competitor Website Monitor']
    effort: '8-16 hours setup'
    value: 'Immediate competitive intelligence'
  }
  
  // Phase 2: Social Intelligence (Week 2) 
  phase_2: {
    workflows: ['Reddit Monitoring', 'LinkedIn Public Data', 'Twitter Free API']
    effort: '12-20 hours setup'
    value: 'Market sentiment and trend detection'
  }
  
  // Phase 3: Regulatory Monitoring (Week 3)
  phase_3: {
    workflows: ['SEC Filings', 'FDA Updates', 'Regulatory RSS Feeds']
    effort: '8-12 hours setup'
    value: 'Compliance and regulatory intelligence'
  }
  
  // Phase 4: Advanced Intelligence (Week 4)
  phase_4: {
    workflows: ['Patent Monitoring', 'Financial Data', 'Industry Reports']
    effort: '16-24 hours setup'
    value: 'Deep market and technology intelligence'
  }
}
```

Using N8N provides a visual, maintainable, and cost-effective way to implement comprehensive data collection while keeping costs under $50/month and avoiding expensive subscription services.