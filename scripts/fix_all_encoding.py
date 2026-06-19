import os
import re

def fix_file(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    clean_map_body = """    '2330.TW': '台積電', '2317.TW': '鴻海', '2454.TW': '聯發科', '2308.TW': '台達電', 
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
    '5876.TW': '上海商銀', '9910.TW': '豐泰'"""

    # For TSX file
    if file_path.endswith('.tsx'):
        pattern = r'const nameMap: Record<string, string> = \{[\s\S]*?\};'
        replacement = f"const nameMap: Record<string, string> = {{\n{clean_map_body}\n  }};"
        content = re.sub(pattern, replacement, content)
    
    # For Python file
    elif file_path.endswith('.py'):
        pattern = r'TW50_MAPPING = \{[\s\S]*?\}'
        replacement = f"TW50_MAPPING = {{\n{clean_map_body}\n}}"
        content = re.sub(pattern, replacement, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed {file_path}")

fix_file(r'd:\MyProjects\FinanceFlow\studio\src\components\finance-flow-client.tsx')
fix_file(r'd:\MyProjects\FinanceFlow\studio\scripts\scan_tw50_opportunities.py')
