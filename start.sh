#!/usr/bin/env bash
# start.sh — Starts backend and frontend on Replit
# Runs both concurrently. Replit forwards port 3000 (frontend) publicly.

set -e

# Load environment
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Install if node_modules missing
if [ ! -d "backend/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

if [ ! -d "bots/templates/basic/node_modules" ]; then
  echo "📦 Installing bot template dependencies..."
  cd bots/templates/basic && npm install && cd ../../..
fi

# Build frontend if not built
if [ ! -d "frontend/.next" ]; then
  echo "🔨 Building frontend..."
  cd frontend && npm run build && cd ..
fi

echo "🚀 Starting WhatsApp Bot Panel..."

# Start backend in background
node backend/server.js &
BACKEND_PID=$!

# Start frontend
cd frontend && node_modules/.bin/next start -p 3000 &
FRONTEND_PID=$!

echo "✅ Backend PID: $BACKEND_PID | Frontend PID: $FRONTEND_PID"
echo "🌐 Open: http://localhost:3000"
echo "🔌 API:  http://localhost:3001"

# Wait for both
wait $BACKEND_PID $FRONTEND_PID
