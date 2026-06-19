import firebase_admin
from firebase_admin import credentials, firestore
import os

def check_sync():
    if not firebase_admin._apps:
        sa_path = r"d:\MyProjects\FinanceFlow\service-account.json"
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    tsmc = db.collection('marketRecords').document('tsmc').get().to_dict()
    print(f"TSMC Last Update: {tsmc.get('last_updated')}")
    print(f"Current UTC Time: {os.popen('date -u').read().strip()}")

if __name__ == "__main__":
    check_sync()
