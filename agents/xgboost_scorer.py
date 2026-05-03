import joblib
import numpy as np
import os

def score_fraud(features):
    # Use absolute path to load the model
    base_dir = os.path.dirname(__file__)
    model_path = os.path.join(base_dir, 'fraud_model.pkl')
    
    try:
        model = joblib.load(model_path)
    except Exception as e:
        print(f"⚠️ Error loading XGBoost model from {model_path}: {e}")
        # Return a safe fallback if model missing
        return {
            "fraud_probability": 0.0,
            "fraud_signal": False,
            "weight": 0
        }

    vector = np.array([[
        features['avg_monthly_credit'],
        features['credit_consistency_score'],
        features['stated_vs_actual_gap_pct'],
        features['foir_existing'],
        features['circular_transaction_flag'],
        features['window_dressing_flag'],
        features['bounce_count']
    ]])
    prob = float(model.predict_proba(vector)[0][1])
    return {
        "fraud_probability": prob,
        "fraud_signal": prob > 0.7,
        "weight": 3 if prob > 0.7 else 1 if prob > 0.4 else 0
    }