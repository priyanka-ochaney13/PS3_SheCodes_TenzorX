import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
import os

def train():
    n = 1000
    np.random.seed(42)

    legit = {
        'avg_monthly_credit': np.random.normal(45000, 10000, n//2),
        'credit_consistency_score': np.random.uniform(0.7, 1.0, n//2),
        'stated_vs_actual_gap_pct': np.random.uniform(0, 0.1, n//2),
        'foir_existing': np.random.uniform(0.1, 0.4, n//2),
        'circular_transaction_flag': np.zeros(n//2),
        'window_dressing_flag': np.zeros(n//2),
        'bounce_count': np.random.randint(0, 2, n//2),
        'label': np.zeros(n//2)
    }
    fraud = {
        'avg_monthly_credit': np.random.normal(30000, 15000, n//2),
        'credit_consistency_score': np.random.uniform(0.2, 0.6, n//2),
        'stated_vs_actual_gap_pct': np.random.uniform(0.3, 0.8, n//2),
        'foir_existing': np.random.uniform(0.6, 1.0, n//2),
        'circular_transaction_flag': np.random.randint(0, 2, n//2),
        'window_dressing_flag': np.random.randint(0, 2, n//2),
        'bounce_count': np.random.randint(3, 8, n//2),
        'label': np.ones(n//2)
    }

    df = pd.concat([pd.DataFrame(legit),
                    pd.DataFrame(fraud)]).sample(frac=1)
    X = df.drop('label', axis=1)
    y = df['label']

    model = xgb.XGBClassifier(n_estimators=100, max_depth=4,
                               learning_rate=0.1, eval_metric='logloss')
    model.fit(X, y)

    os.makedirs('models', exist_ok=True)
    joblib.dump(model, 'models/fraud_model.pkl')
    print("✅ Model trained and saved to models/fraud_model.pkl")

if __name__ == "__main__":
    train()