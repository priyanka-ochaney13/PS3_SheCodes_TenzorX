"""
GEO AGENT
---------
Responsibilities:
  1. Receive customer's live GPS coordinates from browser
  2. Extract city from KYC address using Groq LLaMA (free)
  3. Map live coordinates to nearest city using Open-Meteo geocoding (free, no key)
  4. Compare cities and calculate distance using Haversine
  5. Save result to geo_output.json

Completely free — no Google Maps, no credit card.

Distance thresholds:
  < 25 km  → Green  → pass
  25-150 km → Yellow → flag but continue
  > 150 km → Red    → fraud signal
"""

import os
import json
import math
import requests
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

OUTPUT_PATH      = "geo_output.json"
THRESHOLD_GREEN  = 25.0
THRESHOLD_YELLOW = 150.0

# Major Indian cities with coordinates
# Used for fallback if API is unavailable
INDIA_CITIES = {
    "mumbai":        (19.0760, 72.8777),
    "delhi":         (28.6139, 77.2090),
    "new delhi":     (28.6139, 77.2090),
    "bangalore":     (12.9716, 77.5946),
    "bengaluru":     (12.9716, 77.5946),
    "hyderabad":     (17.3850, 78.4867),
    "chennai":       (13.0827, 80.2707),
    "kolkata":       (22.5726, 88.3639),
    "pune":          (18.5204, 73.8567),
    "ahmedabad":     (23.0225, 72.5714),
    "jaipur":        (26.9124, 75.7873),
    "surat":         (21.1702, 72.8311),
    "lucknow":       (26.8467, 80.9462),
    "nagpur":        (21.1458, 79.0882),
    "indore":        (22.7196, 75.8577),
    "thane":         (19.2183, 72.9781),
    "bhopal":        (23.2599, 77.4126),
    "visakhapatnam": (17.6868, 83.2185),
    "patna":         (25.5941, 85.1376),
    "vadodara":      (22.3072, 73.1812),
    "ghaziabad":     (28.6692, 77.4538),
    "ludhiana":      (30.9010, 75.8573),
    "agra":          (27.1767, 78.0081),
    "nashik":        (19.9975, 73.7898),
    "coimbatore":    (11.0168, 76.9558),
    "kochi":         (9.9312,  76.2673),
    "chandigarh":    (30.7333, 76.7794),
    "guwahati":      (26.1445, 91.7362),
    "bhubaneswar":   (20.2961, 85.8245),
    "noida":         (28.5355, 77.3910),
    "navi mumbai":   (19.0330, 73.0297),
}


class GeoAgent:
    def __init__(self, live_lat: float, live_lon: float, kyc_address: str):
        self.live_lat    = live_lat
        self.live_lon    = live_lon
        self.kyc_address = kyc_address
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    # ── Haversine ─────────────────────────────────────────

    def haversine_km(self, lat1, lon1, lat2, lon2) -> float:
        R    = 6371.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a    = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
        return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a)), 2)

    # ── Free geocoding via Open-Meteo Geocoding API ───────
    # Completely free, no API key, no rate limits for small usage

    def geocode_with_nominatim(self, address: str) -> dict:
        """
        Uses Nominatim (OpenStreetMap) — 100% free, no API key needed.
        Rate limit: 1 request/second — fine for our use case.
        """
        try:
            url     = "https://nominatim.openstreetmap.org/search"
            params  = {"q": address, "format": "json", "limit": 1, "countrycodes": "in"}
            headers = {"User-Agent": "LoanOnboardingApp/1.0"}  # required by Nominatim ToS
            resp    = requests.get(url, params=params, headers=headers, timeout=8)
            results = resp.json()
            if results:
                return {
                    "lat":       float(results[0]["lat"]),
                    "lon":       float(results[0]["lon"]),
                    "formatted": results[0].get("display_name", address),
                    "error":     None
                }
        except Exception as e:
            print(f"⚠️  Nominatim error: {e}")
        return {"lat": None, "lon": None, "formatted": address, "error": "Nominatim failed"}

    def reverse_geocode_city(self, lat: float, lon: float) -> str:
        """Gets city name from coordinates using Nominatim (free)."""
        try:
            url     = "https://nominatim.openstreetmap.org/reverse"
            params  = {"lat": lat, "lon": lon, "format": "json"}
            headers = {"User-Agent": "LoanOnboardingApp/1.0"}
            resp    = requests.get(url, params=params, headers=headers, timeout=8)
            data    = resp.json()
            addr    = data.get("address", {})
            return (
                addr.get("city") or
                addr.get("town") or
                addr.get("village") or
                addr.get("state_district") or
                "Unknown"
            )
        except Exception:
            return "Unknown"

    # ── Extract city from KYC address using Groq ─────────

    def extract_city_from_address(self, address: str) -> str:
        """Uses Groq LLaMA to extract city name from address string."""
        # First try simple string matching — faster
        address_lower = address.lower()
        for city in INDIA_CITIES:
            if city in address_lower:
                print(f"📍 City matched directly: {city}")
                return city

        # Fallback to Groq
        try:
            resp = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role":    "system",
                        "content": (
                            "You are a geocoding assistant for Indian addresses. "
                            "Extract ONLY the city name from the address. "
                            "Respond with the city name in lowercase only. No other text."
                        )
                    },
                    {
                        "role":    "user",
                        "content": f"Extract the city from: {address}"
                    }
                ],
                max_tokens=10,
                temperature=0.0,
            )
            city = resp.choices[0].message.content.strip().lower()
            print(f"📍 Groq extracted city: {city}")
            return city
        except Exception as e:
            print(f"⚠️  Groq city extraction error: {e}")
            return ""

    # ── Geocode KYC address ───────────────────────────────

    def geocode_kyc_address(self) -> dict:
        """
        1. Try Nominatim (OpenStreetMap) — free, accurate
        2. Fallback to city lookup in INDIA_CITIES dict
        3. Fallback to Groq city extraction + INDIA_CITIES
        """
        print(f"📍 Geocoding KYC address: {self.kyc_address}")

        # Try Nominatim first
        result = self.geocode_with_nominatim(self.kyc_address)
        if result["lat"] is not None:
            print(f"✅ Nominatim geocoded: {result['formatted']}")
            return result

        # Fallback: extract city and look up in dict
        city = self.extract_city_from_address(self.kyc_address)
        if city and city in INDIA_CITIES:
            coords = INDIA_CITIES[city]
            print(f"✅ City dict fallback: {city} → {coords}")
            return {
                "lat":       coords[0],
                "lon":       coords[1],
                "formatted": f"{city.title()}, India",
                "error":     None
            }

        return {"lat": None, "lon": None, "formatted": self.kyc_address, "error": "Could not geocode"}

    # ── Risk classification ───────────────────────────────

    def classify_distance(self, distance_km: float) -> tuple:
        """Returns (address_match, risk_level, flag)."""
        if distance_km < THRESHOLD_GREEN:
            return True,  "low",    None
        elif distance_km < THRESHOLD_YELLOW:
            return False, "medium", f"GEO_YELLOW_{distance_km:.0f}km_from_kyc"
        else:
            return False, "high",   f"GEO_RED_{distance_km:.0f}km_from_kyc"

    # ── Main ──────────────────────────────────────────────

    def run(self) -> dict:
        print("🗺️  Geo Agent running...")

        # Validate inputs
        if not self.live_lat or not self.live_lon:
            return self._fail("GEO_NO_COORDINATES", "Live GPS coordinates not provided")
        if not self.kyc_address or not self.kyc_address.strip():
            return self._fail("GEO_NO_KYC_ADDRESS", "KYC address not provided")

        # Geocode KYC address
        kyc_coords = self.geocode_kyc_address()
        if kyc_coords["lat"] is None:
            return self._fail("GEO_GEOCODING_FAILED", kyc_coords.get("error"))

        # Get live city name
        live_city = self.reverse_geocode_city(self.live_lat, self.live_lon)
        print(f"📍 Live location city: {live_city}")

        # Calculate distance
        distance_km = self.haversine_km(
            self.live_lat, self.live_lon,
            kyc_coords["lat"], kyc_coords["lon"]
        )

        # Classify
        address_match, risk_level, flag = self.classify_distance(distance_km)

        output = {
            "agent":         "geo",
            "status":        "completed",
            "address_match":  address_match,
            "distance_km":   distance_km,
            "live_location": {
                "lat":  self.live_lat,
                "lon":  self.live_lon,
                "city": live_city
            },
            "kyc_location": {
                "lat":       kyc_coords["lat"],
                "lon":       kyc_coords["lon"],
                "formatted": kyc_coords["formatted"]
            },
            "risk_level": risk_level,
            "flag":        flag,
            "error":       None,
        }

        self._save(output)
        emoji = "✅" if address_match else ("🟡" if risk_level == "medium" else "🚨")
        print(f"\n{emoji} Geo agent done → {OUTPUT_PATH}")
        print(f"   Distance: {distance_km:.1f} km | Risk: {risk_level.upper()}")
        return output

    def _fail(self, flag: str, error: str) -> dict:
        output = {
            "agent":         "geo",
            "status":        "failed",
            "address_match":  False,
            "distance_km":   None,
            "live_location": {"lat": self.live_lat, "lon": self.live_lon, "city": "Unknown"},
            "kyc_location":  None,
            "risk_level":    "medium",
            "flag":          flag,
            "error":         error,
        }
        self._save(output)
        print(f"⚠️  Geo agent failed: {error}")
        return output

    def _save(self, output: dict):
        with open(OUTPUT_PATH, "w") as f:
            json.dump(output, f, indent=2)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python agents/geo_check.py <path_to_input_json>")
        print("Example JSON format:")
        print(json.dumps({
            "live_lat": 19.076,
            "live_lon": 72.877,
            "kyc_address": "Andheri West, Mumbai, Maharashtra 400058"
        }, indent=2))
        sys.exit(1)

    input_path = sys.argv[1]
    try:
        with open(input_path, "r") as f:
            data = json.load(f)
        
        lat  = float(data["live_lat"])
        lon  = float(data["live_lon"])
        addr = data["kyc_address"]

    except (FileNotFoundError, KeyError, TypeError) as e:
        print(f"Error reading or parsing input file: {input_path}")
        print(f"Details: {e}")
        sys.exit(1)

    agent = GeoAgent(live_lat=lat, live_lon=lon, kyc_address=addr)
    agent.run()