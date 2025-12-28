#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building DNS Tic-Tac-Toe backend...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
BACKEND_DIR="$PROJECT_ROOT"
BUILD_DIR="$( cd "$SCRIPT_DIR" && pwd )/build"

# Create build directory
mkdir -p "$BUILD_DIR"

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${RED}Error: Go is not installed. Please install Go first.${NC}"
    exit 1
fi

# Check Go version (requires 1.21+)
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
REQUIRED_VERSION="1.21"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$GO_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}Error: Go version $GO_VERSION is too old. Requires Go 1.21 or later.${NC}"
    exit 1
fi

echo -e "${YELLOW}Go version: $GO_VERSION${NC}"

# Verify we're in the right directory
if [ ! -f "$BACKEND_DIR/go.mod" ]; then
    echo -e "${RED}Error: go.mod not found in $BACKEND_DIR${NC}"
    echo -e "${RED}Expected location: $BACKEND_DIR/go.mod${NC}"
    exit 1
fi

# Build for Linux (amd64)
echo -e "${GREEN}Building for Linux amd64...${NC}"
echo -e "${YELLOW}Building from: $BACKEND_DIR${NC}"
cd "$BACKEND_DIR" || {
    echo -e "${RED}Error: Failed to change directory to $BACKEND_DIR${NC}"
    exit 1
}

# Verify we're in the correct directory
CURRENT_DIR=$(pwd)
if [ "$CURRENT_DIR" != "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: Current directory mismatch${NC}"
    echo -e "${RED}Expected: $BACKEND_DIR${NC}"
    echo -e "${RED}Actual: $CURRENT_DIR${NC}"
    exit 1
fi

# Verify the source directory exists
if [ ! -d "./cmd/dns-tic-tac-toe" ]; then
    echo -e "${RED}Error: Source directory ./cmd/dns-tic-tac-toe not found${NC}"
    echo -e "${RED}Current directory: $(pwd)${NC}"
    exit 1
fi

echo -e "${YELLOW}Current working directory: $(pwd)${NC}"
echo -e "${YELLOW}go.mod location: $(pwd)/go.mod${NC}"
GOOS=linux GOARCH=amd64 go build -o "$BUILD_DIR/dns-tic-tac-toe" ./cmd/dns-tic-tac-toe

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Build successful!${NC}"
    echo -e "${GREEN}Binary location: $BUILD_DIR/dns-tic-tac-toe${NC}"
    ls -lh "$BUILD_DIR/dns-tic-tac-toe"
else
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

