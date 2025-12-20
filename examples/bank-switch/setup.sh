#!/bin/bash

# Setup script for Bank Switching Marketplace Demo

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║         🏦  Bank Switching Marketplace Setup  🏦           ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if services are running
echo -e "${CYAN}1. Checking Harbor services...${NC}"

check_service() {
  local service=$1
  local port=$2
  if curl -s http://localhost:$port/health > /dev/null 2>&1; then
    echo -e "   ${GREEN}✓${NC} $service (port $port) is running"
    return 0
  else
    echo -e "   ${YELLOW}✗${NC} $service (port $port) is NOT running"
    return 1
  fi
}

services_ok=true
check_service "Gateway" 3001 || services_ok=false
check_service "Tendering" 3002 || services_ok=false
check_service "Wallet" 3003 || services_ok=false
check_service "Settlement" 3004 || services_ok=false
check_service "User" 3005 || services_ok=false

if [ "$services_ok" = false ]; then
  echo ""
  echo -e "${YELLOW}⚠️  Some services are not running!${NC}"
  echo "   Please start Harbor services first:"
  echo "   cd /Users/carter/Documents/dev/harbor"
  echo "   pnpm dev"
  echo ""
  exit 1
fi

echo ""
echo -e "${CYAN}2. Checking wallet balance...${NC}"

WALLET_ID="58879470-6cfd-482a-a746-a710c6dec9fa"
balance=$(curl -s http://localhost:3003/wallets/$WALLET_ID/balance | grep -o '"amount":[0-9]*' | cut -d':' -f2)

if [ -z "$balance" ]; then
  echo -e "   ${YELLOW}✗${NC} Could not fetch balance"
else
  echo -e "   ${GREEN}✓${NC} Current balance: $balance USDC"

  if [ "$balance" -lt 100 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Balance is low (less than 100 USDC)${NC}"
    read -p "   Would you like to deposit 200 USDC now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${CYAN}   Depositing 200 USDC...${NC}"
      curl -s -X POST http://localhost:3003/deposit \
        -H "Content-Type: application/json" \
        -d '{
          "walletId": "'$WALLET_ID'",
          "amount": {"amount": 200, "currency": "USDC"},
          "paymentMethodId": "pm_demo_setup"
        }' > /dev/null
      echo -e "   ${GREEN}✓${NC} Deposit complete!"
    fi
  fi
fi

echo ""
echo -e "${CYAN}3. Making scripts executable...${NC}"
chmod +x buyer/*.ts sellers/*.ts
echo -e "   ${GREEN}✓${NC} All scripts are executable"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                     ✅ SETUP COMPLETE ✅                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Ready to run the demo!${NC}"
echo ""
echo "Open 3 terminal windows and run:"
echo ""
echo -e "${CYAN}Terminal 1:${NC} cd examples/bank-switch && ./run-datahive.sh"
echo -e "${CYAN}Terminal 2:${NC} cd examples/bank-switch && ./run-phonetree.sh"
echo -e "${CYAN}Terminal 3:${NC} cd examples/bank-switch && ./run-swiftswitch.sh"
echo ""
echo "See README.md for detailed instructions!"
echo ""
