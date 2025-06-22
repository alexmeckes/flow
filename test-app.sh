#!/bin/bash

echo "Starting Claude Mission Control in test mode..."
echo "This will use a Claude simulator instead of the real Claude CLI"
echo ""

# Set environment variable to use test simulator
export USE_TEST_CLAUDE=true

# Compile and run
npm run compile:electron && npm run dev