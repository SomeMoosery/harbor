#!/bin/bash

# Setup Platform Wallets Script
# This script creates the platform agent and wallets needed for escrow/revenue

set -e

echo "🚀 Setting up platform wallets..."
echo ""

# Check if services are running
echo "Checking if services are running..."
if ! curl -s http://localhost:3002/health > /dev/null 2>&1; then
  echo "❌ User service not running. Start it with: cd services/user && pnpm dev"
  exit 1
fi

if ! curl -s http://localhost:3003/health > /dev/null 2>&1; then
  echo "❌ Wallet service not running. Start it with: cd services/wallet && pnpm dev"
  exit 1
fi

echo "✓ Services are running"
echo ""

# Prompt for user ID
read -p "Enter your user ID (or press Enter to create a new platform user): " USER_ID

if [ -z "$USER_ID" ]; then
  echo "Creating platform user..."
  USER_RESPONSE=$(curl -s -X POST http://localhost:3002/users \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Platform",
      "type": "BUSINESS",
      "email": "platform@harbor.com",
      "phone": "+1-555-PLATFORM"
    }')

  USER_ID=$(echo $USER_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  echo "✓ Created platform user: $USER_ID"
fi

echo ""
echo "Creating platform agent..."
AGENT_RESPONSE=$(curl -s -X POST "http://localhost:3002/users/$USER_ID/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Platform System",
    "type": "DUAL",
    "capabilities": { "platform": true }
  }')

AGENT_ID=$(echo $AGENT_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "✓ Created platform agent: $AGENT_ID"

# Wait for wallet to be created (auto-created by user service)
echo "Waiting for platform agent wallet to be created..."
sleep 2

# Get the auto-created wallet
AGENT_WALLET_RESPONSE=$(curl -s "http://localhost:3003/wallets/agent/$AGENT_ID")
AGENT_WALLET_ID=$(echo $AGENT_WALLET_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "✓ Platform agent wallet: $AGENT_WALLET_ID"

echo ""
echo "Creating escrow wallet..."
ESCROW_RESPONSE=$(curl -s -X POST http://localhost:3003/wallets \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"$AGENT_ID\"
  }")

ESCROW_WALLET_ID=$(echo $ESCROW_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "✓ Created escrow wallet: $ESCROW_WALLET_ID"

echo ""
echo "Creating revenue wallet..."
REVENUE_RESPONSE=$(curl -s -X POST http://localhost:3003/wallets \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"$AGENT_ID\"
  }")

REVENUE_WALLET_ID=$(echo $REVENUE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "✓ Created revenue wallet: $REVENUE_WALLET_ID"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Platform wallets created successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Add these to your .env file:"
echo ""
echo "ESCROW_WALLET_ID=$ESCROW_WALLET_ID"
echo "REVENUE_WALLET_ID=$REVENUE_WALLET_ID"
echo ""
echo "Then restart the settlement service:"
echo "  cd services/settlement && pnpm dev"
echo ""
echo "Platform Agent ID: $AGENT_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
