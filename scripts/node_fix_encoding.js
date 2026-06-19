const fs = require('fs');
const path = require('path');

const tsxPath = path.join(__dirname, '..', 'studio', 'src', 'components', 'finance-flow-client.tsx');
const pyPath = path.join(__dirname, '..', 'studio', 'scripts', 'scan_tw50_opportunities.py');

const cleanMap = `  const nameMap: Record<string, string> = {
    '2330.TW': '台積電', '2317.TW': '鴻海', '2454.TW': '聯發科', '2308.TW': '台達電', 
    '2303.TW': '聯電', '2382.TW': '廣達', '3711.TW': '日月光投控', '2412.TW': '中華電', 
    '2881.TW': '富邦金', '2882.TW': '國泰金', '1301.TW': '台塑', '1303.TW': '南亞', 
    '2886.TW': '兆豐金', '2002.TW': '中鋼', '2891.TW': '中信金', '1216.TW': '統一', 
    '2357.TW': '華碩', '3231.TW': '緯創', '2884.TW': '玉山金', '2885.TW': '元大金', 
    '2327.TW': '國巨', '2207.TW': '和泰車', '1101.TW': '台泥', '2395.TW': '研華', 
    '2408.TW': '南亞科', '3034.TW': '聯詠', '2892.TW': '第一金', '2880.TW': '華南金', 
    '5880.TW': '合庫金', '2883.TW': '凱基金', '2890.TW': '永豐金', '3045.TW': '台灣大', 
    '2912.TW': '統一超', '4904.TW': '遠傳', '2603.TW': '長榮', '2609.TW': '陽明', 
    '2615.TW': '萬海', '2474.TW': '可成', '3008.TW': '大立光', '3661.TW': '世芯-KY', 
    '6669.TW': '緯穎', '2379.TW': '瑞昱', '1326.TW': '台化', '6505.TW': '台塑化', 
    '1503.TW': '士電', '2345.TW': '智邦', '2301.TW': '光寶科', '5871.TW': '中租-KY', 
    '5876.TW': '上海商銀', '9910.TW': '豐泰'
  };`;

const pyCleanMap = cleanMap.replace('  const nameMap: Record<string, string> = {', 'TW50_MAPPING = {').replace('  };', '}');

if (fs.existsSync(tsxPath)) {
    let tsx = fs.readFileSync(tsxPath, 'utf8');
    tsx = tsx.replace(/const nameMap: Record<string, string> = \{[\s\S]*?\};/, cleanMap);
    fs.writeFileSync(tsxPath, tsx, 'utf8');
}

if (fs.existsSync(pyPath)) {
    let py = fs.readFileSync(pyPath, 'utf8');
    py = py.replace(/TW50_MAPPING = \{[\s\S]*?\}/, pyCleanMap);
    // Remove the bad print with the checkbox to prevent crashes in CP950
    py = py.replace('✅ ', '');
    py = py.replace('❌ ', '');
    // Ensure json dump generates normal characters without escapes for local json debug
    py = py.replace('ensure_ascii=True', 'ensure_ascii=False');
    fs.writeFileSync(pyPath, py, 'utf8');
}
