#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Disabling systemd-resolved...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Stop and disable systemd-resolved
if systemctl is-active --quiet systemd-resolved; then
    echo -e "${YELLOW}Stopping systemd-resolved...${NC}"
    systemctl stop systemd-resolved
fi

if systemctl is-enabled --quiet systemd-resolved; then
    echo -e "${YELLOW}Disabling systemd-resolved...${NC}"
    systemctl disable systemd-resolved
    echo -e "${GREEN}systemd-resolved has been disabled${NC}"
else
    echo -e "${GREEN}systemd-resolved is already disabled${NC}"
fi

# Backup resolv.conf if it exists and is a symlink
if [ -L /etc/resolv.conf ]; then
    echo -e "${YELLOW}Backing up existing resolv.conf symlink...${NC}"
    mv /etc/resolv.conf /etc/resolv.conf.backup.$(date +%Y%m%d_%H%M%S)
fi

# Create new resolv.conf pointing to localhost
echo -e "${YELLOW}Creating /etc/resolv.conf pointing to 127.0.0.1...${NC}"
cat > /etc/resolv.conf << 'EOF'
# DNS configuration for DNS Tic-Tac-Toe
# This file is managed by the deployment script
nameserver 127.0.0.1
EOF

# Make resolv.conf immutable to prevent systemd-resolved from overwriting it
echo -e "${YELLOW}Making resolv.conf immutable...${NC}"
chattr +i /etc/resolv.conf 2>/dev/null || {
    echo -e "${YELLOW}Note: chattr not available, resolv.conf may be overwritten${NC}"
}

echo -e "${GREEN}DNS configuration updated successfully!${NC}"
echo -e "${GREEN}/etc/resolv.conf now points to 127.0.0.1${NC}"

