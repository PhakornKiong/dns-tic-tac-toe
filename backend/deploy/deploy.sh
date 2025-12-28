#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
BACKEND_DIR="$PROJECT_ROOT"
BUILD_DIR="$SCRIPT_DIR/build"
INSTALL_DIR="/opt/dns-tic-tac-toe"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}DNS Tic-Tac-Toe Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Step 1: Build the application
echo -e "${YELLOW}[1/5] Building the application...${NC}"
bash "$SCRIPT_DIR/build.sh"
if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi
echo ""

# Step 2: Create installation directory
echo -e "${YELLOW}[2/5] Creating installation directory...${NC}"
mkdir -p "$INSTALL_DIR"
echo -e "${GREEN}Installation directory: $INSTALL_DIR${NC}"
echo ""

# Step 3: Copy files
echo -e "${YELLOW}[3/5] Copying files to installation directory...${NC}"
cp "$BUILD_DIR/dns-tic-tac-toe" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/dns-tic-tac-toe"

# Copy environment file
if [ -f "$INSTALL_DIR/.env" ]; then
    echo -e "${YELLOW}Existing .env file found. Backing up...${NC}"
    cp "$INSTALL_DIR/.env" "$INSTALL_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
fi

if [ -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${GREEN}Using existing .env file from deploy directory${NC}"
    cp "$SCRIPT_DIR/.env" "$INSTALL_DIR/.env"
else
    echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
    cp "$SCRIPT_DIR/.env.example" "$INSTALL_DIR/.env"
    echo -e "${YELLOW}Please edit $INSTALL_DIR/.env to configure your settings${NC}"
fi

chmod 600 "$INSTALL_DIR/.env"
echo -e "${GREEN}Files copied successfully${NC}"
echo ""

# Step 4: Install systemd service
echo -e "${YELLOW}[4/5] Installing systemd service...${NC}"
cp "$SCRIPT_DIR/dns-tic-tac-toe.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable dns-tic-tac-toe.service
echo -e "${GREEN}Systemd service installed and enabled${NC}"
echo ""

# Step 5: Configure DNS (disable systemd-resolved and update resolv.conf)
echo -e "${YELLOW}[5/5] Configuring DNS...${NC}"
read -p "Do you want to disable systemd-resolved and configure /etc/resolv.conf to use 127.0.0.1? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    bash "$SCRIPT_DIR/disable-systemd-resolved.sh"
else
    echo -e "${YELLOW}Skipping DNS configuration. You can run it later with:${NC}"
    echo -e "${YELLOW}  sudo bash $SCRIPT_DIR/disable-systemd-resolved.sh${NC}"
fi
echo ""

# Start the service
echo -e "${YELLOW}Starting DNS Tic-Tac-Toe service...${NC}"
systemctl start dns-tic-tac-toe.service

# Wait a moment and check status
sleep 2
if systemctl is-active --quiet dns-tic-tac-toe.service; then
    echo -e "${GREEN}Service started successfully!${NC}"
else
    echo -e "${RED}Service failed to start. Check logs with: journalctl -u dns-tic-tac-toe -f${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Service Status:${NC}"
systemctl status dns-tic-tac-toe.service --no-pager -l
echo ""
echo -e "${GREEN}Useful commands:${NC}"
echo -e "  View logs:        ${YELLOW}journalctl -u dns-tic-tac-toe -f${NC}"
echo -e "  Stop service:     ${YELLOW}systemctl stop dns-tic-tac-toe${NC}"
echo -e "  Start service:    ${YELLOW}systemctl start dns-tic-tac-toe${NC}"
echo -e "  Restart service:  ${YELLOW}systemctl restart dns-tic-tac-toe${NC}"
echo -e "  Edit config:      ${YELLOW}nano $INSTALL_DIR/.env${NC}"
echo ""
echo -e "${GREEN}Test the service:${NC}"
echo -e "  ${YELLOW}dig @127.0.0.1 TXT new.game.local${NC}"
echo ""

