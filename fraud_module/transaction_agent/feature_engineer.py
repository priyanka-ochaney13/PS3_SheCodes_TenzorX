import pandas as pd
import numpy as np

REQUIRED_MONTHS = {
    "personal_loan_salaried": 3,
    "personal_loan_self_employed": 6,
    "business_loan": 6,
    "professional_loan": 6,
    "lap": 12
}

def engineer_features(df, stated_income, loan_type):
    if df.empty or 'date' not in df.columns:
        print("⚠️ Empty or invalid DataFrame — returning default high risk features")
        return {
            "avg_monthly_credit": 0,
            "credit_consistency_score": 0,
            "stated_vs_actual_gap_pct": 1.0,
            "foir_existing": 1.0,
            "circular_transaction_flag": 0,
            "window_dressing_flag": 0,
            "bounce_count": 0,
            "statement_period_months": 0,
            "period_sufficient": False
        }
    
    df['month'] = df['date'].dt.to_period('M')
    monthly_credits = df.groupby('month')['credit'].sum()
    avg_monthly_credit = monthly_credits.mean()

    income_gap = abs(stated_income - avg_monthly_credit) / stated_income \
                 if stated_income > 0 else 1

    credit_std = monthly_credits.std()
    consistency = 1 - min(credit_std / avg_monthly_credit, 1) \
                  if avg_monthly_credit > 0 else 0

    df['debit_rounded'] = (df['debit'] / 100).round() * 100
    months_count = df['month'].nunique()
    debit_freq = df[df['debit'] > 0].groupby(
        'debit_rounded')['month'].nunique()
    recurring = [r for r in debit_freq[
        debit_freq >= months_count * 0.8].index.tolist() if r > 1000]
    foir = sum(recurring) / avg_monthly_credit \
           if avg_monthly_credit > 0 else 1

    cash_mask = df['description'].str.upper().str.contains(
        'ATM|CASH|WITHDRAWAL', na=False)
    cash_ratio = df[cash_mask]['debit'].sum() / df['credit'].sum() \
                 if df['credit'].sum() > 0 else 0

    circular = False
    credits = df[df['credit'] > 0][['date','credit']]
    debits = df[df['debit'] > 0][['date','debit']]
    for _, cr in credits.iterrows():
        match = debits[
            (abs(debits['debit'] - cr['credit']) < 100) &
            (abs((debits['date'] - cr['date']).dt.days) <= 2)]
        if len(match) > 0:
            circular = True
            break

    df_sorted = df.sort_values('date')
    recent = df_sorted.tail(max(int(len(df_sorted) * 0.2), 1))
    older = df_sorted.head(max(int(len(df_sorted) * 0.8), 1))
    window_dressing = recent['balance'].mean() > older['balance'].mean() * 2

    bounce_mask = df['description'].str.upper().str.contains(
    'BOUNCE|RETURN|DISHONOUR|UNPAID|ECS BOUNCE|DISHO', na=False)
    bounce_count = int(bounce_mask.sum())

    period_months = (df['date'].max() - df['date'].min()).days / 30
    period_ok = period_months >= REQUIRED_MONTHS.get(loan_type, 6)

    return {
        "avg_monthly_credit": float(avg_monthly_credit),
        "credit_consistency_score": float(consistency),
        "stated_vs_actual_gap_pct": float(income_gap),
        "foir_existing": float(foir),
        "circular_transaction_flag": int(circular),
        "window_dressing_flag": int(window_dressing),
        "bounce_count": bounce_count,
        "statement_period_months": float(period_months),
        "period_sufficient": bool(period_ok)
    }