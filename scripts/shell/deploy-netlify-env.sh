#!/bin/bash

# Deploy Environment Variables to Netlify for Sam AI Platform
# This script sets up all required environment variables for MCP integrations

echo "🚀 Deploying Sam AI environment variables to Netlify..."

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI not found. Please install it first:"
    echo "npm install -g netlify-cli"
    exit 1
fi

# Use the known site ID for sam-new-sep-7 project
SITE_ID="1ccdcd44-18e5-4248-aaed-ed1f653fbac5"

echo "✅ Found site ID: $SITE_ID"

# Core Supabase Configuration
echo "📊 Setting Supabase environment variables..."
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://latxadqrvrrrcvkktrog.supabase.co" --site $SITE_ID
netlify env:set SUPABASE_URL "https://latxadqrvrrrcvkktrog.supabase.co" --site $SITE_ID
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE" --site $SITE_ID
netlify env:set SUPABASE_SERVICE_ROLE_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ" --site $SITE_ID

# Environment Configuration
echo "🌍 Setting environment configuration..."
netlify env:set NEXT_PUBLIC_ENVIRONMENT "production" --site $SITE_ID
netlify env:set NEXT_PUBLIC_SITE_URL "https://app.meet-sam.com" --site $SITE_ID

# Email Configuration (Postmark)
echo "📧 Setting email configuration..."
netlify env:set POSTMARK_INNOVAREAI_API_KEY "bf9e070d-eec7-4c41-8fb5-1d37fe384723" --site $SITE_ID
netlify env:set POSTMARK_3CUBEDAI_API_KEY "77cdd228-d19f-4e18-9373-a1bc8f4a4a22" --site $SITE_ID
netlify env:set POSTMARK_SERVER_TOKEN "bf9e070d-eec7-4c41-8fb5-1d37fe384723" --site $SITE_ID
netlify env:set POSTMARK_FROM_EMAIL "sp@innovareai.com" --site $SITE_ID
netlify env:set POSTMARK_FROM_NAME "Sarah Powell - SAM AI" --site $SITE_ID

# AI Configuration (OpenRouter)
echo "🤖 Setting AI configuration..."
netlify env:set OPENROUTER_API_KEY "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" --site $SITE_ID

# ActiveCampaign Integration
echo "📊 Setting ActiveCampaign configuration..."
netlify env:set ACTIVECAMPAIGN_BASE_URL "https://innovareai.api-us1.com" --site $SITE_ID
netlify env:set ACTIVECAMPAIGN_API_KEY "453675737b6accc1d499c5c7da2c86baedf1af829c2f29b605b16d2dbb8940a98a2d5e0d" --site $SITE_ID

# Google Search API
echo "🔍 Setting Google Search API configuration..."
netlify env:set GOOGLE_API_KEY "AIzaSyDwI-Wt95javxXSHO5hBSkSKwrIaRi7oTw" --site $SITE_ID
netlify env:set GOOGLE_CSE_ID "4705cf9dd4f714b82" --site $SITE_ID

# MCP Server Configuration
echo "🔧 Setting MCP server configuration..."
netlify env:set ORGANIZATION_ID "innovareai" --site $SITE_ID
netlify env:set USER_ID "sam-ai-platform" --site $SITE_ID

# Unipile Configuration
echo "🔗 Setting Unipile configuration..."
netlify env:set UNIPILE_DSN "api6.unipile.com:13670" --site $SITE_ID
netlify env:set UNIPILE_API_KEY "aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=" --site $SITE_ID

# N8N Configuration
echo "⚙️ Setting N8N configuration..."
netlify env:set N8N_INSTANCE_URL "https://workflows.innovareai.com" --site $SITE_ID
netlify env:set N8N_API_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzQwOTUxfQ.7S2xKhsPYDuv7vFXfquwabQwT90SqteFVNzJ7jk1IaA" --site $SITE_ID

# Bright Data Configuration
echo "🌐 Setting Bright Data configuration..."
netlify env:set BRIGHT_DATA_USERNAME "brd-customer-hl_e41b2aa8-zone-zone_ai_intelligence" --site $SITE_ID
netlify env:set BRIGHT_DATA_PASSWORD "pdmnxl6m2mkn" --site $SITE_ID
netlify env:set BRIGHT_DATA_ENDPOINT "brd.superproxy.io" --site $SITE_ID
netlify env:set BRIGHT_DATA_PORT "22225" --site $SITE_ID

# Apify Configuration
echo "🕷️ Setting Apify configuration..."
netlify env:set APIFY_API_TOKEN "apify_api_nZxgqjgkPjKZE7w9s1XrNf3CvLq8Dk3B7Hg2" --site $SITE_ID

# Optional: SerpAPI (for enhanced search)
echo "🔍 Setting optional SerpAPI configuration..."
# netlify env:set SERP_API_KEY "your-serpapi-key-here" --site $SITE_ID

echo ""
echo "✅ Environment variables deployed successfully!"
echo ""
echo "🔍 Verify deployment:"
echo "netlify env:list --site $SITE_ID"
echo ""
echo "🚀 Trigger new deployment:"
echo "netlify deploy --prod --site $SITE_ID"
echo ""
echo "📊 Check site status:"
echo "netlify open:site --site $SITE_ID"