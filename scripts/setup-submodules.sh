#!/bin/bash
# setup-submodules.sh - Initialize git submodules for local development

set -e

echo "🔧 Setting up NodeByte GSM submodules..."

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .gitmodules exists
if [ ! -f .gitmodules ]; then
    echo -e "${YELLOW}⚠️  .gitmodules not found. Have you run the submodule add commands?${NC}"
    echo "See SUBMODULES.md for setup instructions."
    exit 1
fi

echo -e "${BLUE}Initializing submodules...${NC}"
git submodule update --init --recursive

echo -e "${BLUE}Checking submodule status...${NC}"

# Check each submodule
for submodule in games agent lib/providers; do
    if [ -d "$submodule" ] && [ -f "$submodule/.git" ]; then
        echo -e "${GREEN}✓ $submodule${NC}"
    else
        echo -e "${YELLOW}⚠ $submodule (not initialized)${NC}"
    fi
done

echo -e "${GREEN}✓ Submodules setup complete${NC}"
echo ""
echo "Next steps:"
echo "1. cd into each submodule and ensure you're on 'main' branch:"
echo "   cd games && git checkout main && cd .."
echo "2. Run: bun install"
echo "3. Start developing!"
