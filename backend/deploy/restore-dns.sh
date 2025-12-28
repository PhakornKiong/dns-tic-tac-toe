#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Restoring DNS configuration...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Remove immutable flag from resolv.conf
if [ -f /etc/resolv.conf ]; then
    echo -e "${YELLOW}Removing immutable flag from resolv.conf...${NC}"
    chattr -i /etc/resolv.conf 2>/dev/null || true
fi

# Restore original resolv.conf if backup exists
BACKUP_FILE=$(ls -t /etc/resolv.conf.backup.* 2>/dev/null | head -n1)
if [ -n "$BACKUP_FILE" ]; then
    echo -e "${YELLOW}Restoring original resolv.conf from backup...${NC}"
    mv "$BACKUP_FILE" /etc/resolv.conf
    echo -e "${GREEN}Original resolv.conf restored${NC}"
else
    # Create a default resolv.conf with common DNS servers
    echo -e "${YELLOW}Creating default resolv.conf...${NC}"
    cat > /etc/resolv.conf << 'EOF'
# DNS configuration
nameserver 8.8.8.8
nameserver 8.8.4.4
EOF
    echo -e "${GREEN}Default resolv.conf created${NC}"
fi

# Re-enable systemd-resolved if it was previously enabled
if systemctl list-unit-files | grep -q "systemd-resolved.service"; then
    echo -e "${YELLOW}Re-enabling systemd-resolved...${NC}"
    systemctl enable systemd-resolved
    systemctl start systemd-resolved
    echo -e "${GREEN}systemd-resolved has been re-enabled${NC}"
fi

echo -e "${GREEN}DNS configuration restored successfully!${NC}"

