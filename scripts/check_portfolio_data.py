"""
診斷腳本 v4：檢查 Firestore 中的 portfolio 資料
"""
import json
import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    sa_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'service-account.json')
    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
doc = db.collection('marketRecords').document('portfolio').get()

if not doc.exists:
    print("ERROR: portfolio document not found")
    sys.exit(1)

data = doc.to_dict()
positions = data.get('positions', [])

print(f"Total positions in portfolio: {len(positions)}")
for pos in positions:
    symbol = pos.get('symbol', '?')
    name = pos.get('name', '__MISSING__')
    print(f"  {symbol}: pos.name={repr(name)}")

# Check if symbols have .TW suffix
for pos in positions:
    symbol = pos.get('symbol', '')
    if symbol and '.' not in symbol:
        print(f"  WARNING: Symbol {symbol} is missing suffix (e.g. .TW). This might cause nameMap lookup to fail.")
