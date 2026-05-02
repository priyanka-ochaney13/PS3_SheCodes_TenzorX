import base64, cv2, numpy as np, re, traceback, os, uuid as _uuid, shutil
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from deepface import DeepFace
import easyocr
from pdf2image import convert_from_bytes
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

reader = easyocr.Reader(['en'], gpu=False)
print("🚀 OCR Ready")

# -------- TEMP DIR HELPER (for concurrent request isolation) --------
def get_tmp_dir():
    d = f"/tmp/deepface_{_uuid.uuid4().hex}"
    os.makedirs(d, exist_ok=True)
    return d

# ---------------- SAVE FILE ----------------
def save_file(data, path):
    file_bytes = base64.b64decode(data.split(",")[1])
    
    if data.startswith("data:application/pdf"):
        images = convert_from_bytes(file_bytes, dpi=300)
        images[0].save(path, "JPEG")
        print(f"📄 PDF → {path}")
    else:
        with open(path, "wb") as f:
            f.write(file_bytes)
        print(f"🖼️ Image → {path}")

# ---------------- OCR ----------------
def get_text(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, None, fx=2, fy=2)
    return " ".join(reader.readtext(gray, detail=0))

# ---------------- VERHOEFF ----------------
d = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
     [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
     [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
     [9,8,7,6,5,4,3,2,1,0]]

p = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
     [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
     [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]]

def verhoeff(num):
    try:
        c = 0
        num = list(map(int, reversed(num)))
        for i, digit in enumerate(num):
            c = d[c][p[i % 8][digit]]
        return c == 0
    except:
        return False

# ---------------- SMART AADHAAR EXTRACTION ----------------
def extract_aadhaar(text):
    clean = re.sub(r'[^0-9X ]', '', text.upper())
    
    # Check masked
    masked_match = re.search(r'XXXX\s?XXXX\s?\d{4}', clean)
    if masked_match:
        return masked_match.group(0), "⚠️ Masked Aadhaar", "❌ Cannot Verify"

    # Find only proper 12-digit formatted groups
    candidates = re.findall(r'\b\d{4}\s\d{4}\s\d{4}\b', clean)

    print("🔍 Candidates:", candidates)

    for c in candidates:
        num = c.replace(" ", "")

        # Reject obvious junk patterns
        if len(set(num)) <= 3:  # like 111111111111
            continue

        if verhoeff(num):
            return num, "✅ Valid Aadhaar", "✅ Passed"

    return "Not Found", "❌ Invalid Aadhaar", "❌ Failed"

# ---------------- PAN EXTRACTION ----------------
def extract_pan(text):
    print("\n🧠 PAN EXTRACTION START")

    text_upper = text.upper()

    # Step 1: normalize spacing (VERY IMPORTANT)
    text_upper = re.sub(r'[^A-Z0-9 ]', ' ', text_upper)
    text_upper = re.sub(r'\s+', ' ', text_upper)

    print("📄 NORMALIZED TEXT SAMPLE:")
    print(text_upper[:200])

    # Step 2: try spaced PAN patterns (handles OCR splits)
    spaced_pattern = re.findall(r'\b[A-Z]\s*[A-Z]\s*[A-Z]\s*[A-Z]\s*[A-Z]\s*[0-9]\s*[0-9]\s*[0-9]\s*[0-9]\s*[A-Z]\b', text_upper)

    print(f"🔍 Spaced PAN candidates: {spaced_pattern}")

    if spaced_pattern:
        pan = re.sub(r'\s+', '', spaced_pattern[0])
        print("✅ PAN FOUND (spaced fix):", pan)
        return pan, "✅ Valid PAN"

    # Step 3: standard PAN pattern
    match = re.search(r'[A-Z]{5}[0-9]{4}[A-Z]', text_upper)

    if match:
        print("✅ PAN FOUND (direct):", match.group(0))
        return match.group(0), "✅ Valid PAN"

    # Step 4: aggressive cleanup fallback
    clean = re.sub(r'[^A-Z0-9]', '', text_upper)

    print("🔍 CLEANED TEXT:", clean[:150])

    match = re.search(r'[A-Z]{5}[0-9]{4}[A-Z]', clean)

    if match:
        print("✅ PAN FOUND (fallback):", match.group(0))
        return match.group(0), "✅ Valid PAN"

    print("❌ PAN NOT FOUND")
    return "Not Found", "❌ Invalid PAN"

# -------- COMBINED KYC ENDPOINT (race-condition safe) --------
@app.post("/process_kyc_full")
async def process_kyc_full(req: Request):
    """Single endpoint replacing verify_docs + process_kyc two-step.
    Fully isolated per request — no shared file state."""
    tmp = get_tmp_dir()
    try:
        data = await req.json()
        ref_path = f"{tmp}/ref.jpg"
        live_path = f"{tmp}/live.jpg"
        aad_path = f"{tmp}/aad.jpg"
        pan_path = f"{tmp}/pan.jpg"
        ref_face_path = f"{tmp}/ref_face.jpg"
        live_face_path = f"{tmp}/live_face.jpg"

        save_file(data['photo'], ref_path)
        save_file(data['image'], live_path)
        save_file(data.get('aadhaar', data['photo']), aad_path)
        save_file(data.get('pan', data['photo']), pan_path)

        # OCR
        aad_text = get_text(cv2.imread(aad_path))
        pan_text = get_text(cv2.imread(pan_path))
        aad_no, aad_status, ver = extract_aadhaar(aad_text)
        pan_no, pan_status = extract_pan(pan_text)

        # Face extraction
        live_faces = DeepFace.extract_faces(
            img_path=live_path,
            detector_backend="retinaface",
            enforce_detection=False
        )
        ref_faces = DeepFace.extract_faces(
            img_path=ref_path,
            detector_backend="retinaface",
            enforce_detection=False
        )

        if not live_faces or not ref_faces:
            return {
                "verified": False, "status": "No face detected",
                "distance": None, "score": None,
                "aadhaar": aad_no, "pan": pan_no, "verhoeff": ver,
                "aadhaar_status": aad_status, "pan_status": pan_status,
            }

        cv2.imwrite(live_face_path, cv2.cvtColor((live_faces[0]['face'] * 255).astype("uint8"), cv2.COLOR_RGB2BGR))
        cv2.imwrite(ref_face_path, cv2.cvtColor((ref_faces[0]['face'] * 255).astype("uint8"), cv2.COLOR_RGB2BGR))

        result = DeepFace.verify(
            img1_path=live_face_path,
            img2_path=ref_face_path,
            model_name="Facenet512",
            enforce_detection=False
        )
        distance = result["distance"]
        score = round(1 - distance, 3)

        if distance < 0.45:
            status, verified = "✅ Face Matched (High Confidence)", True
        elif distance < 0.65:
            status, verified = "⚠️ Face Probably Matched (Low Confidence)", True
        else:
            status, verified = "❌ Face Not Matched", False

        return {
            "verified": verified, "status": status,
            "distance": round(distance, 3), "score": score,
            "aadhaar": aad_no, "aadhaar_status": aad_status, "verhoeff": ver,
            "pan": pan_no, "pan_status": pan_status,
        }

    except Exception as e:
        traceback.print_exc()
        return {"verified": False, "status": f"❌ Error: {str(e)}",
                "distance": None, "score": None}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

# ---------------- VERIFY DOCS ----------------
@app.post("/verify_docs")
async def verify_docs(req: Request):
    try:
        print("\n➡️ VERIFY DOCS")
        
        data = await req.json()

        save_file(data['photo'], "ref.jpg")
        save_file(data['aadhaar'], "aad.jpg")
        save_file(data['pan'], "pan.jpg")

        aad_img = cv2.imread("aad.jpg")
        pan_img = cv2.imread("pan.jpg")

        aad_text = get_text(aad_img)
        pan_text = get_text(pan_img)

       

        aad_no, aad_status, ver = extract_aadhaar(aad_text)
        pan_no, pan_status = extract_pan(pan_text)

        print(f"✅ Aadhaar: {aad_no} | Status: {aad_status} | Verhoeff: {ver}")
        print(f"✅ PAN: {pan_no} | Status: {pan_status}")

        return {
            "aadhaar": aad_no,
            "aadhaar_status": aad_status,
            "verhoeff": ver,
            "pan": pan_no,
            "pan_status": pan_status
        }

    except Exception as e:
        traceback.print_exc()
        return {
            "aadhaar": "Not Found",
            "aadhaar_status": f"❌ Error: {str(e)}",
            "verhoeff": "❌ Error",
            "pan": "Not Found",
            "pan_status": "❌ Error"
        }

# ---------------- FACE MATCH ----------------
@app.post("/process_kyc")
async def process_kyc(req: Request):
    try:
        print("\n➡️ FACE MATCH")
        
        data = await req.json()
        save_file(data['image'], "live.jpg")

        # ---- Extract live face ----
        live_faces = DeepFace.extract_faces(
            img_path="live.jpg",
            detector_backend="retinaface",
            enforce_detection=False
        )

        if not live_faces:
            return {
                "verified": False,
                "status": "⚠️ No face detected in live image",
                "distance": None,
                "score": None
            }

        live_face = (live_faces[0]['face'] * 255).astype("uint8")
        cv2.imwrite("live_face.jpg", cv2.cvtColor(live_face, cv2.COLOR_RGB2BGR))

        # ---- Extract reference face ----
        ref_faces = DeepFace.extract_faces(
            img_path="ref.jpg",
            detector_backend="retinaface",
            enforce_detection=False
        )

        if not ref_faces:
            return {
                "verified": False,
                "status": "⚠️ No face found in uploaded photo",
                "distance": None,
                "score": None
            }

        ref_face = (ref_faces[0]['face'] * 255).astype("uint8")
        cv2.imwrite("ref_face.jpg", cv2.cvtColor(ref_face, cv2.COLOR_RGB2BGR))

        # ---- Compare ----
        result = DeepFace.verify(
            img1_path="live_face.jpg",
            img2_path="ref_face.jpg",
            model_name="Facenet512",
            enforce_detection=False
        )

        distance = result["distance"]
        score = round(1 - distance, 3)

        print(f"📊 Distance: {distance}")

        # ---- Decision Logic ----
        if distance < 0.45:
            status = "✅ Face Matched (High Confidence)"
            verified = True

        elif distance < 0.65:
            status = "⚠️ Face Probably Matched (Low Confidence)"
            verified = True

        else:
            status = "❌ Face Not Matched"
            verified = False

        print(f"📊 Status: {status}")

        return {
            "verified": verified,
            "status": status,
            "distance": round(distance, 3),
            "score": score
        }

    except Exception as e:
        traceback.print_exc()
        return {
            "verified": False,
            "status": f"❌ Error: {str(e)}",
            "distance": None,
            "score": None
        }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)