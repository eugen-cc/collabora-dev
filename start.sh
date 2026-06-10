#!/bin/bash

# PID variables
BACKEND_PID=""
FRONTEND_PID=""

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Stopping frontend and backend servers..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null
    fi
    exit 0
}

# Trap Ctrl+C (SIGINT) and SIGTERM to run cleanup
trap cleanup SIGINT SIGTERM

echo "=================================================="
echo "🚀 Starting WOPI / Collabora Workspace Stack"
echo "=================================================="

# Start Backend
echo "-> Starting Java Spring Boot Backend on port 5001..."
npm run backend &
BACKEND_PID=$!

# Give backend a moment to initialize before launching frontend logs
sleep 2

# Start Frontend
echo "-> Starting Vite React Frontend..."
npm run dev &
FRONTEND_PID=$!

echo "=================================================="
echo "✨ Stack is running! Press Ctrl+C to stop both."
echo "=================================================="

# Wait for both processes
wait
