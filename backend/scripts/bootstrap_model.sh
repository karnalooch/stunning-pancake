#!/bin/bash
# ==============================================================================
# Model Bootstrap Script — SPORT Platform
# Runs automatically in the backend container if no model exists yet.
# Usage: docker compose exec backend scripts/bootstrap_model.sh
# ==============================================================================
set -e

MODEL_PATH="${ML_MODEL_PATH:-/app/models/anomaly_detector.pkl}"

if [ -f "$MODEL_PATH" ]; then
    echo "✅ ML model already exists at $MODEL_PATH — skipping training."
    exit 0
fi

echo "🤖 No ML model found. Training baseline from synthetic data..."
python /app/scripts/train_baseline_model.py --output "$MODEL_PATH"
echo "✅ ML model ready."
