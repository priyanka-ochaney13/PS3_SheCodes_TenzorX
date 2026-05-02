#!/bin/bash
# start.sh — Start all 4 backend services

echo "🚀 Starting Poonawalla Fincorp Backend..."

# Activate venv if it exists
[ -f .venv/bin/activate ] && source .venv/bin/activate

# Train XGBoost model if not already trained
if [ ! -f agents/models/fraud_model.pkl ]; then
  echo "🤖 Training XGBoost fraud model (first-time setup)..."
  python agents/train_synthetic.py
fi

# Start microservices in background
echo "👤 Starting DeepFace service on port 8001..."
uvicorn agents.deepface_agent:app --host 0.0.0.0 --port 8001 --reload &
DEEPFACE_PID=$!

echo "📊 Starting Risk scorer on port 8002..."
uvicorn agents.risk_agent:app --host 0.0.0.0 --port 8002 --reload &
RISK_PID=$!

echo "💰 Starting Offer engine on port 8003..."
uvicorn agents.offer_agent:app --host 0.0.0.0 --port 8003 --reload &
OFFER_PID=$!

sleep 2

# Start main API
echo "🏦 Starting Main API on port 8000..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Cleanup on exit
trap "kill $DEEPFACE_PID $RISK_PID $OFFER_PID 2>/dev/null" EXIT
