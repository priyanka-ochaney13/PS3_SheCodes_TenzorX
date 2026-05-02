import joblib
import numpy as np
import os

def score_fraud(features):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(BASE_DIR, 'fraud_model.pkl')
    model = joblib.load(model_path)
    
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