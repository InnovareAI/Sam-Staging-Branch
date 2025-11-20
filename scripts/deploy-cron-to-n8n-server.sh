#!/bin/bash

###############################################################################
# Deploy Prospect Sending Cron to N8N Server
#
# This script should be run ON THE N8N SERVER (workflows.innovareai.com)
#
# Prerequisites:
# 1. Node.js installed on server
# 2. Environment variables configured
# 3. SSH access to server
###############################################################################

set -e  # Exit on error

echo "🚀 Deploying Prospect Sending Cron to N8N Server"
echo "================================================"
echo ""

# Configuration
DEPLOY_DIR="/opt/sam-cron"
SCRIPT_NAME="send-scheduled-prospects-cron.mjs"
LOG_FILE="/var/log/sam-cron/send-cron.log"

# Create directories
echo "📁 Creating directories..."
sudo mkdir -p "$DEPLOY_DIR"
sudo mkdir -p "$(dirname "$LOG_FILE")"
sudo chown -R $(whoami):$(whoami) "$DEPLOY_DIR"
sudo chown -R $(whoami):$(whoami) "$(dirname "$LOG_FILE")"

# Copy script to server (assumes you've already scp'd it)
echo "📋 Installing script..."
if [ -f "$SCRIPT_NAME" ]; then
    cp "$SCRIPT_NAME" "$DEPLOY_DIR/"
    chmod +x "$DEPLOY_DIR/$SCRIPT_NAME"
    echo "✅ Script installed to $DEPLOY_DIR/$SCRIPT_NAME"
else
    echo "❌ Error: $SCRIPT_NAME not found in current directory"
    echo "   Please upload the script first using:"
    echo "   scp scripts/send-scheduled-prospects-cron.mjs user@workflows.innovareai.com:~/"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd "$DEPLOY_DIR"
npm init -y
npm install @supabase/supabase-js dotenv

# Create .env file
echo "🔐 Creating environment file..."
cat > "$DEPLOY_DIR/.env" << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
UNIPILE_DSN=your_unipile_dsn_here
UNIPILE_API_KEY=your_unipile_api_key_here
ENVEOF

echo "⚠️  IMPORTANT: Edit $DEPLOY_DIR/.env with actual credentials"
echo ""

# Install cron job
echo "⏰ Installing cron job..."
CRON_COMMAND="* * * * * cd $DEPLOY_DIR && node $SCRIPT_NAME >> $LOG_FILE 2>&1"

# Check if cron already exists
if crontab -l 2>/dev/null | grep -q "$SCRIPT_NAME"; then
    echo "⚠️  Cron job already exists. Updating..."
    (crontab -l 2>/dev/null | grep -v "$SCRIPT_NAME"; echo "$CRON_COMMAND") | crontab -
else
    (crontab -l 2>/dev/null; echo ""; echo "# SAM AI - Send Scheduled Connection Requests"; echo "$CRON_COMMAND") | crontab -
fi

echo "✅ Cron job installed successfully"
echo ""

# Verify installation
echo "🔍 Verifying installation..."
echo ""
echo "Cron jobs:"
crontab -l | grep -A1 "SAM AI"
echo ""
echo "Files installed:"
ls -lh "$DEPLOY_DIR"
echo ""

# Test the script
echo "🧪 Testing script (dry run)..."
cd "$DEPLOY_DIR"
node "$SCRIPT_NAME" || true
echo ""

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Edit $DEPLOY_DIR/.env with your actual credentials"
echo "2. Test manually: cd $DEPLOY_DIR && node $SCRIPT_NAME"
echo "3. Monitor logs: tail -f $LOG_FILE"
echo ""
echo "To remove cron job: crontab -e (then delete the SAM AI line)"
