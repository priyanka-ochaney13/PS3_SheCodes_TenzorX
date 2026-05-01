import fitz

def detect_pdf_tampering(pdf_path):
    doc = fitz.open(pdf_path)
    metadata = doc.metadata
    signals = []

    if metadata.get('modDate', '') > metadata.get('creationDate', ''):
        signals.append({"type": "MODIFIED_AFTER_CREATION", "weight": 2})

    producer = metadata.get('producer', '').lower()
    bad_tools = ['photoshop', 'gimp', 'canva', 'illustrator']
    if any(tool in producer for tool in bad_tools):
        signals.append({"type": "EDITED_WITH_IMAGE_TOOL", "weight": 3})

    all_fonts = []
    for page in doc:
        all_fonts += [f[3] for f in page.get_fonts()]
    if len(set(all_fonts)) > 8:
        signals.append({"type": "FONT_INCONSISTENCY", "weight": 2})

    doc.close()
    return {
        "tampered": len(signals) > 0,
        "signals": signals,
        "total_weight": sum(s["weight"] for s in signals)
    }