import sys
import firebase_admin
from firebase_admin import credentials, firestore
import json
import os

try:
    if not firebase_admin._apps:
        current_dir = r"d:\MyProjects\FinanceFlow"
        path = os.path.join(current_dir, 'service-account.json')
        cred = credentials.Certificate(path)
        firebase_admin.initialize_app(cred)
        
    db = firestore.client()
    doc_ref = db.collection('marketRecords').document('tw50')
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        stocks = data.get('stocks', [])
        for s in stocks:
            if '3231' in s.get('s', ''):
                print(f"FOUND 3231 in Firestore:")
                print(json.dumps(s, ensure_ascii=False))
                break
    else:
        print("No such document!")
except Exception as e:
    print(f"Error: {e}")
