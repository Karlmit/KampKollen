#!/bin/bash
# Stop KampKollen
pkill -f "node dist/index.js" 2>/dev/null && echo "KampKollen stopped" || echo "Not running"
