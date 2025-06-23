#!/bin/bash

echo "Starting Claude Mission Control with safe PTY test mode..."
echo "This will use a test script instead of the real claude command"
echo ""

# Export the environment variable to use safe test mode
export USE_SAFE_PTY_TEST=true

# Run the app
npm run dev