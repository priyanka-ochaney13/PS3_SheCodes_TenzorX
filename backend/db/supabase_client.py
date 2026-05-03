# db/supabase_client.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Find .env in the root directory (one level up from 'backend/db')
current_dir = os.path.dirname(os.path.abspath(__file__))
root_env = os.path.join(current_dir, "../../.env")
load_dotenv(root_env)

_supabase: Client = None

def get_supabase() -> Client:
    """Initialize and return a Supabase client singleton."""
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            print("⚠️ Supabase credentials missing in .env")
            return None
            
        _supabase = create_client(url, key)
        
    return _supabase
