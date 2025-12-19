#!/bin/bash
# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
npx tsx sellers/phonetree-caller.ts
