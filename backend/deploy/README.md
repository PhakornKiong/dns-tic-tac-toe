# DNS Tic-Tac-Toe Deployment Guide

This directory contains scripts and configuration files for deploying the DNS Tic-Tac-Toe backend on Ubuntu.

## Prerequisites

- Ubuntu (tested on 20.04+)
- Go 1.21 or later installed
- Root/sudo access

## Quick Start

1. **Configure environment variables** (optional):
   ```bash
   cp .env.example .env
   nano .env  # Edit as needed
   ```

2. **Run the deployment script**:
   ```bash
   sudo bash deploy.sh
   ```

The deployment script will:
- Build the backend binary for Linux
- Install it to `/opt/dns-tic-tac-toe`
- Set up a systemd service
- Optionally configure DNS (disable systemd-resolved and update resolv.conf)

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Build the Application

```bash
bash build.sh
```

This creates a Linux binary in `build/dns-tic-tac-toe`.

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and edit as needed:

```bash
cp .env.example .env
nano .env
```

Available environment variables:
- `DNS_ZONE`: DNS zone name (default: `game.local`)
- `DNS_PORT`: Port to listen on (default: `53`)
- `DNS_TTL`: TTL for DNS records (default: `0`)
- `SESSION_ID_LENGTH`: Length of session IDs (default: `8`)
- `PLAYER_TOKEN_LENGTH`: Length of player tokens (default: `8`)
- `SESSION_MAX_AGE`: Maximum age of inactive sessions (default: `120s`)
- `SESSION_CLEANUP_INTERVAL`: Interval for session cleanup (default: `120s`)

### 3. Install the Service

```bash
# Create installation directory
sudo mkdir -p /opt/dns-tic-tac-toe

# Copy binary
sudo cp build/dns-tic-tac-toe /opt/dns-tic-tac-toe/
sudo chmod +x /opt/dns-tic-tac-toe/dns-tic-tac-toe

# Copy environment file
sudo cp .env /opt/dns-tic-tac-toe/
sudo chmod 600 /opt/dns-tic-tac-toe/.env

# Install systemd service
sudo cp dns-tic-tac-toe.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dns-tic-tac-toe.service
```

### 4. Configure DNS (Required for Port 53)

To use port 53, you need to disable systemd-resolved and configure `/etc/resolv.conf`:

```bash
sudo bash disable-systemd-resolved.sh
```

This script will:
- Stop and disable systemd-resolved
- Create a new `/etc/resolv.conf` pointing to `127.0.0.1`
- Make resolv.conf immutable to prevent overwriting

**Warning**: This will change your system's DNS configuration. Make sure you understand the implications.

### 5. Start the Service

```bash
sudo systemctl start dns-tic-tac-toe.service
sudo systemctl status dns-tic-tac-toe.service
```

## Service Management

```bash
# View logs
sudo journalctl -u dns-tic-tac-toe -f

# Stop service
sudo systemctl stop dns-tic-tac-toe

# Start service
sudo systemctl start dns-tic-tac-toe

# Restart service
sudo systemctl restart dns-tic-tac-toe

# Check status
sudo systemctl status dns-tic-tac-toe
```

## Testing

After deployment, test the service:

```bash
# Create a new session
dig @127.0.0.1 TXT new.game.local

# View help
dig @127.0.0.1 TXT help.game.local
```

## Restoring DNS Configuration

If you need to restore the original DNS configuration:

```bash
sudo bash restore-dns.sh
```

This will:
- Remove the immutable flag from resolv.conf
- Restore the original resolv.conf (if backup exists)
- Re-enable systemd-resolved

## Troubleshooting

### Service won't start

1. Check logs:
   ```bash
   sudo journalctl -u dns-tic-tac-toe -n 50
   ```

2. Verify the binary exists and is executable:
   ```bash
   ls -l /opt/dns-tic-tac-toe/dns-tic-tac-toe
   ```

3. Check environment file:
   ```bash
   sudo cat /opt/dns-tic-tac-toe/.env
   ```

4. Test running the binary manually:
   ```bash
   sudo /opt/dns-tic-tac-toe/dns-tic-tac-toe
   ```

### Port 53 already in use

If port 53 is already in use, you may need to:
- Ensure systemd-resolved is stopped: `sudo systemctl stop systemd-resolved`
- Check what's using port 53: `sudo netstat -tulpn | grep :53`
- Kill the process or change DNS_PORT in `.env` to a different port

### DNS queries not working

1. Verify resolv.conf:
   ```bash
   cat /etc/resolv.conf
   ```
   Should show `nameserver 127.0.0.1`

2. Test DNS query:
   ```bash
   dig @127.0.0.1 TXT help.game.local
   ```

3. Check if the service is listening:
   ```bash
   sudo netstat -tulpn | grep :53
   ```

## Files

- `build.sh` - Builds the backend binary for Linux
- `deploy.sh` - Main deployment script (does everything)
- `disable-systemd-resolved.sh` - Configures DNS for port 53
- `restore-dns.sh` - Restores original DNS configuration
- `dns-tic-tac-toe.service` - Systemd service file
- `.env.example` - Example environment configuration
- `README.md` - This file

## Security Notes

- The service runs as root (required for port 53)
- The `.env` file has restricted permissions (600)
- Consider using firewall rules to restrict access if needed
- The service binds to all interfaces by default

