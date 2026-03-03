const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (using service account or default)
// For local run with 'firebase login', it usually uses default credentials or we can use keys.
// However, I'll use a simpler way: just trigger it from the frontend once fixed.

// Actually, I can use the firebase CLI to set a document if I have the data in a file.
// But the CLI doesn't support complex JSON easily for firestore:set.

const tw50Data = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/tw50_full_scan.json'), 'utf8'));

// Since I cannot easily run admin SDK without service account key, 
// I will use the setDoc logic in the frontend 'sync' button.

console.log("TW50 Data Size:", tw50Data.length);
