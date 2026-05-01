import pdfplumber
import pandas as pd
import re


def parse_bank_statement(pdf_path, password=None):
    raw_text = ""

    with pdfplumber.open(pdf_path, password=password) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                raw_text += text + "\n"

    if not raw_text.strip():
        print("⚠️ No text extracted — PDF may be scanned/image based")
        return pd.DataFrame()

    transactions = extract_transactions(raw_text)

    if not transactions:
        print("⚠️ No transactions found in text")
        return pd.DataFrame()

    df = pd.DataFrame(transactions)
    df['date'] = pd.to_datetime(
        df['date'], errors='coerce', dayfirst=True
    )
    df = df.dropna(subset=['date'])
    print(f"✅ Successfully parsed {len(df)} transactions")
    return df


def extract_transactions(text):
    transactions = []

    # Matches all common Indian bank date formats
    date_patterns = [
        r'\b(\d{2}[-/]\d{2}[-/]\d{4})\b',  # DD-MM-YYYY or DD/MM/YYYY
        r'\b(\d{2}[-/]\d{2}[-/]\d{2})\b',   # DD-MM-YY
        r'\b(\d{2}\s+\w{3}\s+\d{4})\b',     # DD Mon YYYY like 01 Oct 2024
        r'\b(\d{2}-\w{3}-\d{4})\b',          # DD-Mon-YYYY like 01-Oct-2024
    ]

    # Amount pattern — any number with commas and 2 decimal places
    amount_pattern = re.compile(r'([\d,]+\.\d{2})')

    lines = text.split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Skip header and summary lines
        if any(skip in line.upper() for skip in [
            'DATE', 'OPENING', 'CLOSING', 'TOTAL',
            'STATEMENT', 'ACCOUNT', 'BALANCE B/F',
            'PARTICULARS', 'DESCRIPTION', 'NARRATION'
        ]):
            continue

        # Try to find a date at start of line
        date_found = None
        for pattern in date_patterns:
            match = re.search(pattern, line)
            if match:
                date_found = match.group(1)
                break

        if not date_found:
            continue

        # Extract all amounts from this line
        amounts = amount_pattern.findall(line)
        amounts_clean = [float(a.replace(',', '')) for a in amounts]

        if not amounts_clean:
            continue

        # Get description — remove date and amounts
        desc = line
        for pattern in date_patterns:
            desc = re.sub(pattern, '', desc)
        for a in amounts:
            desc = desc.replace(a, '')
        desc = ' '.join(desc.split()).strip()

        # Assign amounts based on count
        # Most banks: [credit, debit, balance] or [debit, balance] or [credit, balance]
        credit, debit, balance = 0.0, 0.0, 0.0

        if len(amounts_clean) >= 3:
            # Last amount is always balance
            balance = amounts_clean[-1]
            # Figure out credit vs debit from description
            if is_credit(desc):
                credit = amounts_clean[0]
                debit = amounts_clean[1] if len(amounts_clean) > 2 else 0.0
            else:
                debit = amounts_clean[0]
                credit = amounts_clean[1] if len(amounts_clean) > 2 else 0.0

        elif len(amounts_clean) == 2:
            balance = amounts_clean[-1]
            if is_credit(desc):
                credit = amounts_clean[0]
            else:
                debit = amounts_clean[0]

        elif len(amounts_clean) == 1:
            balance = amounts_clean[0]

        transactions.append({
            'date': date_found,
            'description': desc,
            'credit': credit,
            'debit': debit,
            'balance': balance
        })

    return transactions


def is_credit(description):
    desc_upper = description.upper()

    # Strong credit signals
    credit_keywords = [
        'SALARY', 'NEFT CR', 'IMPS CR', 'UPI CR',
        'CREDIT', 'DEPOSIT', 'REFUND', 'CASHBACK',
        'INTEREST CREDIT', 'REVERSAL', 'INWARD',
        'RECEIVED', 'CR ', '/CR'
    ]

    # Strong debit signals
    debit_keywords = [
        'ATM', 'WITHDRAWAL', 'DEBIT', 'PAYMENT',
        'NEFT DR', 'IMPS DR', 'UPI DR', 'OUTWARD',
        'PURCHASE', 'POS ', 'EMI', 'BOUNCE',
        'CHARGES', 'DR ', '/DR'
    ]

    credit_score = sum(1 for k in credit_keywords if k in desc_upper)
    debit_score = sum(1 for k in debit_keywords if k in desc_upper)

    return credit_score >= debit_score