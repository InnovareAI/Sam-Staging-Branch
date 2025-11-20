# Deploy Cron Job to N8N Server

This guide shows how to deploy the prospect sending cron job to your N8N server so it runs 24/7.

## Prerequisites

1. SSH access to `workflows.innovareai.com`
2. Node.js installed on the server
3. Your environment variables (Supabase, Unipile credentials)

## Step 1: Get Server Access Information

You'll need:
- Server hostname: `workflows.innovareai.com`
- SSH username (usually `root`, `ubuntu`, or your username)
- SSH key or password

**Test your access:**
```bash
ssh your-username@workflows.innovareai.com
```

If you don't have access yet, check:
- Your hosting provider dashboard (DigitalOcean, AWS, etc.)
- N8N installation documentation
- Server admin credentials

## Step 2: Prepare Files Locally

From your Mac, run:

```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

# Make deployment script executable
chmod +x scripts/deploy-cron-to-n8n-server.sh
```

## Step 3: Upload Files to Server

```bash
# Upload the cron script
scp scripts/send-scheduled-prospects-cron.mjs your-username@workflows.innovareai.com:~/

# Upload the deployment script
scp scripts/deploy-cron-to-n8n-server.sh your-username@workflows.innovareai.com:~/
```

## Step 4: SSH into Server and Deploy

```bash
# SSH into the server
ssh your-username@workflows.innovareai.com

# Run the deployment script
bash ~/deploy-cron-to-n8n-server.sh
```

## Step 5: Configure Environment Variables

On the server, edit the environment file:

```bash
nano /opt/sam-cron/.env
```

Add your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=your_actual_unipile_key
```

Save and exit (Ctrl+X, then Y, then Enter)

## Step 6: Test the Cron Job

```bash
# Test manually on server
cd /opt/sam-cron
node send-scheduled-prospects-cron.mjs

# You should see output like:
# [2025-11-20 11:44:19] Checking for scheduled prospects...
# Current time: 2025-11-20T11:44:19.000Z
# No prospects ready to send
```

## Step 7: Monitor the Cron Job

```bash
# Watch the logs in real-time
tail -f /var/log/sam-cron/send-cron.log

# View recent cron activity
crontab -l
```

## Verification Checklist

- [ ] SSH access to server works
- [ ] Files uploaded successfully
- [ ] Deployment script ran without errors
- [ ] Environment variables configured
- [ ] Manual test run successful
- [ ] Cron job installed (check with `crontab -l`)
- [ ] Logs are being written to `/var/log/sam-cron/send-cron.log`

## Troubleshooting

### Can't SSH into server?
- Check your hosting provider dashboard for SSH credentials
- Ensure your IP is whitelisted if firewall is configured
- Try SSH with verbose output: `ssh -v username@workflows.innovareai.com`

### Node.js not installed?
```bash
# On Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

### Permission denied errors?
```bash
# On server, ensure proper ownership
sudo chown -R $(whoami):$(whoami) /opt/sam-cron
sudo chown -R $(whoami):$(whoami) /var/log/sam-cron
```

### Cron not running?
```bash
# Check if cron service is running
sudo systemctl status cron   # or 'crond' on some systems

# Restart cron service
sudo systemctl restart cron
```

## Alternative: Docker Container

If the server uses Docker for N8N, you can run the cron in the same container:

```bash
# Find N8N container
docker ps | grep n8n

# Copy script into container
docker cp send-scheduled-prospects-cron.mjs <container-id>:/opt/sam-cron/

# Install cron inside container
docker exec -it <container-id> bash
# Then follow deployment steps above
```

## Remove Cron Job

If you need to remove the cron job:

```bash
# On the server
crontab -e
# Delete the SAM AI line and save

# Or remove all at once
crontab -l | grep -v "send-scheduled-prospects-cron" | crontab -
```

## Support

If you get stuck:
1. Check N8N server logs: `docker logs n8n` (if using Docker)
2. Check system logs: `journalctl -u cron -f`
3. Verify cron syntax: `crontab -l`
