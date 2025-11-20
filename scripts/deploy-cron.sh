#!/bin/bash
set -e

echo "🚀 Deploying cron job to workflows.innovareai.com..."

# Step 1: Upload the script
echo "📤 Uploading script..."
scp scripts/send-scheduled-prospects-cron.mjs root@workflows.innovareai.com:/tmp/

# Step 2: SSH and setup
echo "⚙️  Setting up on server..."
ssh root@workflows.innovareai.com << 'ENDSSH'

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo "✅ Node.js installed: $(node --version)"
fi

# Create directory
mkdir -p /opt/sam-cron
mv /tmp/send-scheduled-prospects-cron.mjs /opt/sam-cron/
cd /opt/sam-cron

# Install Node packages
npm init -y
npm install @supabase/supabase-js dotenv

# Create .env file
cat > /opt/sam-cron/.env << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=
EOF

# Update the script to use /opt/sam-cron/.env instead of ../env.local
sed -i "s|join(__dirname, '../.env.local')|'/opt/sam-cron/.env'|g" /opt/sam-cron/send-scheduled-prospects-cron.mjs

# Install cron job (runs every minute)
(crontab -l 2>/dev/null | grep -v "send-scheduled-prospects-cron.mjs"; echo "* * * * * cd /opt/sam-cron && node send-scheduled-prospects-cron.mjs >> /var/log/sam-cron.log 2>&1") | crontab -

echo "✅ Cron job installed"

# Test it
echo "🧪 Testing script..."
node /opt/sam-cron/send-scheduled-prospects-cron.mjs

ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 To monitor the cron job, run:"
echo "   ssh root@workflows.innovareai.com 'tail -f /var/log/sam-cron.log'"
echo ""
echo "🔍 To check cron status:"
echo "   ssh root@workflows.innovareai.com 'crontab -l'"
