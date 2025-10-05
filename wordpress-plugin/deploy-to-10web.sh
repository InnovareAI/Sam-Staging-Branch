#!/bin/bash

# Deploy SAM Signup Modal Plugin to 10Web
# Usage: ./deploy-to-10web.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== SAM Signup Modal - 10Web Deployment ===${NC}\n"

# Configuration
SSH_HOST="34.136.237.175"
SSH_PORT="55031"
SSH_USER="sftp_live_sLxM0"
SSH_PASS="9ZwwWS8zmr9rj3q1BuMQDeKHDkN2XHgD8G"
REMOTE_PATH="/wp-content/plugins/sam-signup-modal"
LOCAL_PATH="./sam-signup-modal"

# Check if sshpass is installed (for password authentication)
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}Warning: sshpass not installed${NC}"
    echo -e "${YELLOW}Installing sshpass for automated deployment...${NC}\n"

    # Install sshpass based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install hudochenkov/sshpass/sshpass
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt-get update && sudo apt-get install -y sshpass
    fi
fi

echo -e "${GREEN}Step 1: Creating plugin archive...${NC}"
cd "$(dirname "$0")"
tar -czf sam-signup-modal.tar.gz sam-signup-modal/
echo -e "${GREEN}✓ Archive created: sam-signup-modal.tar.gz${NC}\n"

echo -e "${GREEN}Step 2: Uploading to 10Web...${NC}"
sshpass -p "$SSH_PASS" scp -P "$SSH_PORT" -o StrictHostKeyChecking=no \
    sam-signup-modal.tar.gz \
    ${SSH_USER}@${SSH_HOST}:/tmp/
echo -e "${GREEN}✓ Archive uploaded${NC}\n"

echo -e "${GREEN}Step 3: Extracting on server...${NC}"
sshpass -p "$SSH_PASS" ssh -p "$SSH_PORT" -o StrictHostKeyChecking=no \
    ${SSH_USER}@${SSH_HOST} << 'ENDSSH'
    cd wp-content/plugins/

    # Backup existing plugin if it exists
    if [ -d "sam-signup-modal" ]; then
        echo "Backing up existing plugin..."
        mv sam-signup-modal sam-signup-modal.backup.$(date +%Y%m%d_%H%M%S)
    fi

    # Extract new version
    tar -xzf /tmp/sam-signup-modal.tar.gz
    rm /tmp/sam-signup-modal.tar.gz

    # Set permissions
    chmod -R 755 sam-signup-modal

    echo "Plugin deployed successfully!"
ENDSSH
echo -e "${GREEN}✓ Plugin extracted and permissions set${NC}\n"

# Clean up local archive
rm sam-signup-modal.tar.gz

echo -e "${GREEN}Step 4: Activation instructions${NC}"
echo -e "${YELLOW}Please complete activation manually:${NC}"
echo -e "1. Go to WordPress Admin → Plugins"
echo -e "2. Find 'SAM AI Signup Modal'"
echo -e "3. Click 'Activate'"
echo -e "\nOr via WP-CLI (if available):"
echo -e "${GREEN}wp plugin activate sam-signup-modal${NC}\n"

echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "\nNext steps:"
echo -e "1. Activate plugin in WordPress admin"
echo -e "2. Edit SAM page in Elementor"
echo -e "3. Add 'SAM Signup Button' widget"
echo -e "4. Test the signup modal\n"
