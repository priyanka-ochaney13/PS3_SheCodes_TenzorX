# save as: generate_fraud_statement.py
from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", size=12)

pdf.set_font("Helvetica", 'B', 16)
pdf.cell(200, 10, "SBI Bank - Account Statement", ln=True, align='C')
pdf.set_font("Helvetica", size=11)
pdf.cell(200, 8, "Account Holder: Amit Verma", ln=True)
pdf.cell(200, 8, "Account No: XXXX XXXX 7823", ln=True)
pdf.cell(200, 8, "Statement Period: 01-Oct-2024 to 31-Dec-2024", ln=True)
pdf.ln(5)

pdf.set_font("Helvetica", 'B', 10)
pdf.set_fill_color(200, 200, 200)
pdf.cell(35, 8, "Date", border=1, fill=True)
pdf.cell(75, 8, "Description", border=1, fill=True)
pdf.cell(30, 8, "Debit", border=1, fill=True)
pdf.cell(30, 8, "Credit", border=1, fill=True)
pdf.cell(30, 8, "Balance", border=1, fill=True)
pdf.ln()

pdf.set_font("Helvetica", size=9)

# Fraudulent profile:
# Stated income = 80000 but actual credits are irregular and low
# Window dressing — large credit in December before applying
# Circular transaction in November
# Bounced ECS

transactions = [
    # October — low irregular credits
    ("01-Oct-2024", "Opening Balance", "", "", "5000.00"),
    ("07-Oct-2024", "CASH DEPOSIT", "", "18000.00", "23000.00"),
    ("10-Oct-2024", "ATM WITHDRAWAL", "10000.00", "", "13000.00"),
    ("15-Oct-2024", "NEFT INWARD", "", "12000.00", "25000.00"),
    ("18-Oct-2024", "NEFT OUTWARD", "12000.00", "", "13000.00"),  # circular!
    ("22-Oct-2024", "ECS BOUNCE - LOAN EMI", "500.00", "", "12500.00"),  # bounce!
    ("25-Oct-2024", "ATM WITHDRAWAL", "5000.00", "", "7500.00"),
    ("31-Oct-2024", "CLOSING BALANCE", "", "", "7500.00"),

    # November — inconsistent
    ("03-Nov-2024", "CASH DEPOSIT", "", "20000.00", "27500.00"),
    ("05-Nov-2024", "ATM WITHDRAWAL", "15000.00", "", "12500.00"),
    ("10-Nov-2024", "NEFT INWARD - FRIEND", "", "25000.00", "37500.00"),
    ("11-Nov-2024", "NEFT OUTWARD", "25000.00", "", "12500.00"),  # circular!
    ("15-Nov-2024", "ECS BOUNCE - CREDIT CARD", "500.00", "", "12000.00"),  # bounce!
    ("20-Nov-2024", "CASH DEPOSIT", "", "8000.00", "20000.00"),
    ("30-Nov-2024", "CLOSING BALANCE", "", "", "20000.00"),

    # December — window dressing! Sudden large credit before loan application
    ("01-Dec-2024", "NEFT INWARD - RELATIVE", "", "150000.00", "170000.00"),
    ("05-Dec-2024", "ATM WITHDRAWAL", "3000.00", "", "167000.00"),
    ("10-Dec-2024", "UPI PAYMENT", "2000.00", "", "165000.00"),
    ("15-Dec-2024", "ATM WITHDRAWAL", "5000.00", "", "160000.00"),
    ("31-Dec-2024", "CLOSING BALANCE", "", "", "160000.00"),
]

for t in transactions:
    pdf.cell(35, 7, t[0], border=1)
    pdf.cell(75, 7, t[1], border=1)
    pdf.cell(30, 7, t[2], border=1, align='R')
    pdf.cell(30, 7, t[3], border=1, align='R')
    pdf.cell(30, 7, t[4], border=1, align='R')
    pdf.ln()

pdf.output("fraud_statement.pdf")
print("✅ fraud_statement.pdf created — contains circular txns, bounces, window dressing")