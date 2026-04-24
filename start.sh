#!/bin/bash

# ============================================
# AI Anti-Fraud & Credit Analysis Engine
# Complete Start Script
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT=3001
FRONTEND_PORT=3000

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   AI Anti-Fraud & Credit Analysis Engine         ║"
echo "║   Starting Application...                        ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ---- Step 1: Kill processes on used ports ----
echo -e "${YELLOW}[1/7] Cleaning up ports ${BACKEND_PORT} and ${FRONTEND_PORT}...${NC}"
kill_port() {
  local port=$1
  local pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "${RED}  Killing processes on port $port: $pids${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  else
    echo -e "${GREEN}  Port $port is free${NC}"
  fi
}
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

# ---- Step 2: Check .env ----
echo -e "${YELLOW}[2/7] Checking environment configuration...${NC}"
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo -e "${RED}  .env file not found! Creating default...${NC}"
  cat > "$PROJECT_DIR/.env" << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/antifraud
JWT_SECRET=antifraud-secret-key-2024
PORT=3001
OPENROUTER_API_KEY=your-key-here
OPENROUTER_MODEL=anthropic/claude-haiku-4.5
EOF
fi
echo -e "${GREEN}  .env file OK${NC}"

# ---- Step 3: Check PostgreSQL ----
echo -e "${YELLOW}[3/7] Checking PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
  echo -e "${RED}  PostgreSQL not found. Please install it first.${NC}"
  exit 1
fi

if ! pg_isready -q 2>/dev/null; then
  echo -e "${YELLOW}  Starting PostgreSQL...${NC}"
  if command -v brew &> /dev/null; then
    brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
  fi
  sleep 2
fi

if pg_isready -q 2>/dev/null; then
  echo -e "${GREEN}  PostgreSQL is running${NC}"
else
  echo -e "${RED}  PostgreSQL is not running. Please start it manually.${NC}"
  exit 1
fi

# ---- Step 4: Create database and seed ----
echo -e "${YELLOW}[4/7] Setting up database...${NC}"

# Create database if it doesn't exist
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'antifraud'" 2>/dev/null | grep -q 1 || {
  echo -e "${BLUE}  Creating database 'antifraud'...${NC}"
  psql -U postgres -c "CREATE DATABASE antifraud;" 2>/dev/null
}

# Run schema
echo -e "${BLUE}  Running schema...${NC}"
psql -U postgres -d antifraud -f "$PROJECT_DIR/server/schema.sql" 2>/dev/null

# Run seed data
echo -e "${BLUE}  Seeding data...${NC}"
psql -U postgres -d antifraud -f "$PROJECT_DIR/server/seed.sql" 2>/dev/null

echo -e "${GREEN}  Database setup complete${NC}"

# ---- Step 5: Install dependencies ----
echo -e "${YELLOW}[5/7] Installing dependencies...${NC}"

cd "$PROJECT_DIR"
if [ ! -d "node_modules" ]; then
  echo -e "${BLUE}  Installing backend dependencies...${NC}"
  npm install
else
  echo -e "${GREEN}  Backend dependencies OK${NC}"
fi

cd "$PROJECT_DIR/client"
if [ ! -d "node_modules" ]; then
  echo -e "${BLUE}  Installing frontend dependencies...${NC}"
  npm install
else
  echo -e "${GREEN}  Frontend dependencies OK${NC}"
fi

cd "$PROJECT_DIR"

# ---- Step 6: Start backend with nodemon (auto-reload) ----
echo -e "${YELLOW}[6/7] Starting backend server on port ${BACKEND_PORT}...${NC}"
npx nodemon --watch server server/index.js &
BACKEND_PID=$!
echo -e "${GREEN}  Backend started (PID: $BACKEND_PID) with auto-reload${NC}"

# Wait for backend to be ready
echo -e "${BLUE}  Waiting for backend...${NC}"
for i in {1..30}; do
  if curl -s "http://localhost:${BACKEND_PORT}/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}  Backend is ready!${NC}"
    break
  fi
  sleep 1
done

# ---- Step 7: Start frontend with hot reload ----
echo -e "${YELLOW}[7/7] Starting frontend on port ${FRONTEND_PORT}...${NC}"
cd "$PROJECT_DIR/client"
BROWSER=none PORT=$FRONTEND_PORT npm start &
FRONTEND_PID=$!
echo -e "${GREEN}  Frontend started (PID: $FRONTEND_PID) with hot-reload${NC}"

cd "$PROJECT_DIR"

# ---- Done ----
echo ""
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║   Application Started Successfully!              ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║   Frontend:  http://localhost:${FRONTEND_PORT}              ║"
echo "║   Backend:   http://localhost:${BACKEND_PORT}/api           ║"
echo "║                                                  ║"
echo "║   Login Credentials:                             ║"
echo "║   Email:    admin@antifraud.com                  ║"
echo "║   Password: password123                          ║"
echo "║                                                  ║"
echo "║   Both servers auto-reload on code changes       ║"
echo "║   Press Ctrl+C to stop all servers               ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Open browser after a delay
sleep 3
if command -v open &> /dev/null; then
  open "http://localhost:${FRONTEND_PORT}"
fi

# Trap Ctrl+C to clean up
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  kill_port $BACKEND_PORT
  kill_port $FRONTEND_PORT
  echo -e "${GREEN}All servers stopped.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait
