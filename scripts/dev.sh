#!/bin/bash

echo "🧹 Cleaning up ports 3000-3005..."
lsof -ti:3000,3001,3002,3003,3004,3005 | xargs kill -9 2>/dev/null || true

echo "✓ Ports cleared"
echo ""
echo "🚀 Starting Harbor services..."
echo ""

# Start all services with turbo
pnpm turbo dev
