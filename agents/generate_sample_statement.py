# save as: generate_sample_statement.py
# pip install fpdf2

from fpdf import FPDF
import random

pdf = FPDF()
pdf.add_page()
pdf.set_font("Helvetica", size=12)

# Header
pdf.set_font("Helvetica", 'B', 16)
pdf.cell(200, 10, "HDFC Bank - Account Statement", ln=True, align='C')
pdf.set_font("Helvetica", size=11)
pdf.cell(200, 8, "Account Holder: Rahul Sharma", ln=True)
pdf.cell(200, 8, "Account No: XXXX XXXX 4521", ln=True)
pdf.cell(200, 8, "Statement Period: 01-Oct-2024 to 31-Dec-2024", ln=True)
pdf.ln(5)

# Table header
pdf.set_font("Helvetica", 'B', 10)
pdf.set_fill_color(200, 200, 200)
pdf.cell(35, 8, "Date", border=1, fill=True)
pdf.cell(75, 8, "Description", border=1, fill=True)
pdf.cell(30, 8, "Debit", border=1, fill=True)
pdf.cell(30, 8, "Credit", border=1, fill=True)
pdf.cell(30, 8, "Balance", border=1, fill=True)
pdf.ln()

# Transactions
pdf.set_font("Helvetica", size=9)

transactions = [
    ("01-Oct-2024", "Opening Balance", "", "", "45000.00"),
    ("01-Oct-2024", "NEFT - SALARY HDFC BANK", "", "50000.00", "95000.00"),
    ("03-Oct-2024", "ATM WITHDRAWAL", "5000.00", "", "90000.00"),
    ("05-Oct-2024", "EMI - HDFC HOME LOAN", "15000.00", "", "75000.00"),
    ("07-Oct-2024", "UPI - AMAZON PAY", "2500.00", "", "72500.00"),
    ("10-Oct-2024", "UTILITY - ELECTRICITY", "1200.00", "", "71300.00"),
    ("15-Oct-2024", "UPI - SWIGGY", "800.00", "", "70500.00"),
    ("20-Oct-2024", "UPI - PETROL PUMP", "3000.00", "", "67500.00"),
    ("25-Oct-2024", "INSURANCE PREMIUM", "2000.00", "", "65500.00"),
    ("31-Oct-2024", "CLOSING BALANCE", "", "", "65500.00"),

    ("01-Nov-2024", "NEFT - SALARY HDFC BANK", "", "50000.00", "115500.00"),
    ("02-Nov-2024", "ATM WITHDRAWAL", "4000.00", "", "111500.00"),
    ("05-Nov-2024", "EMI - HDFC HOME LOAN", "15000.00", "", "96500.00"),
    ("08-Nov-2024", "UPI - FLIPKART", "3500.00", "", "93000.00"),
    ("12-Nov-2024", "UTILITY - INTERNET", "999.00", "", "92001.00"),
    ("18-Nov-2024", "UPI - ZOMATO", "650.00", "", "91351.00"),
    ("22-Nov-2024", "ATM WITHDRAWAL", "5000.00", "", "86351.00"),
    ("28-Nov-2024", "UPI - GROCERY", "2200.00", "", "84151.00"),
    ("30-Nov-2024", "CLOSING BALANCE", "", "", "84151.00"),

    ("01-Dec-2024", "NEFT - SALARY HDFC BANK", "", "50000.00", "134151.00"),
    ("03-Dec-2024", "ATM WITHDRAWAL", "3000.00", "", "131151.00"),
    ("05-Dec-2024", "EMI - HDFC HOME LOAN", "15000.00", "", "116151.00"),
    ("10-Dec-2024", "UPI - AMAZON", "4500.00", "", "111651.00"),
    ("15-Dec-2024", "UTILITY - GAS", "800.00", "", "110851.00"),
    ("20-Dec-2024", "UPI - RESTAURANT", "1200.00", "", "109651.00"),
    ("25-Dec-2024", "INSURANCE PREMIUM", "2000.00", "", "107651.00"),
    ("31-Dec-2024", "CLOSING BALANCE", "", "", "107651.00"),
]

for t in transactions:
    pdf.cell(35, 7, t[0], border=1)
    pdf.cell(75, 7, t[1], border=1)
    pdf.cell(30, 7, t[2], border=1, align='R')
    pdf.cell(30, 7, t[3], border=1, align='R')
    pdf.cell(30, 7, t[4], border=1, align='R')
    pdf.ln()

pdf.output("sample_statement.pdf")
print("✅ sample_statement.pdf created successfully")