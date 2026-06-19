import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

def check_trigger():
    if not firebase_admin._apps:
        # Use absolute path as requested by rules
        sa_path = r"d:\MyProjects\FinanceFlow\service-account.json"
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    trigger_doc = db.collection('marketSync').document('trigger').get()
    
    if trigger_doc.exists:
        data = trigger_doc.to_dict()
        print(f"Trigger Document found:")
        # Convert timestamp to str for JSON serialization
        if 'last_requested_at' in data:
             data['last_requested_at'] = str(data['last_requested_at'])
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print("Trigger document 'marketSync/trigger' DOES NOT EXIST.")

if __name__ == "__main__":
    check_trigger()
