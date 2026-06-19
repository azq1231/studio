import os
import re

file_path = r'd:\MyProjects\FinanceFlow\studio\src\components\finance-flow-client.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Using Unicode escapes to prevent any terminal/Git encoding mangling
# 緯: \u7def, 創: \u5275
clean_name_map = """  const nameMap: Record<string, string> = {
    '2330.TW': '\\u53f0\\u7a4d\\u96fb', '2317.TW': '\\u9d3b\\u6d77', '2454.TW': '\\u806f\\u767c\\u79d1', '2308.TW': '\\u53f0\\u9054\\u96fb', 
    '2303.TW': '\\u806f\\u96fb', '2382.TW': '\\u5ee3\\u9054', '3711.TW': '\\u65e5\\u6708\\u5149\\u6295\\u63a7', '2412.TW': '\\u4e2d\\u83ef\\u96fb', 
    '2881.TW': '\\u5bcc\\u90a6\\u91d1', '2882.TW': '\\u570b\\u6cf0\\u91d1', '1301.TW': '\\u53f0\\u5851', '1303.TW': '\\u5357\\u4e9e', 
    '2886.TW': '\\u5146\\u8c50\\u91d1', '2002.TW': '\\u4e2d\\u92fc', '2891.TW': '\\u4e2d\\u4fe1\\u91d1', '1216.TW': '\\u7d71\\u4e00', 
    '2357.TW': '\\u83ef\\u78a9', '3231.TW': '\\u7def\\u5275', '2884.TW': '\\u7309\\u5c71\\u91d1', '2885.TW': '\\u5143\\u5927\\u91d1', 
    '2327.TW': '\\u570b\\u5de8', '2207.TW': '\\u548c\\u6cf0\\u8eca', '1101.TW': '\\u53f0\\u6ce5', '2395.TW': '\\u7814\\u83ef', 
    '2408.TW': '\\u5357\\u4e9e\\u79d1', '3034.TW': '\\u806f\\u8a60', '2892.TW': '\\u7b2c\\u4e00\\u91d1', '2880.TW': '\\u83ef\\u5357\\u91d1', 
    '5880.TW': '\\u5408\\u5eab\\u91d1', '2883.TW': '\\u51f1\\u57fa\\u91d1', '2890.TW': '\\u6c38\\u8c50\\u91d1', '3045.TW': '\\u53f0\\u7063\\u5927', 
    '2912.TW': '\\u7d71\\u4e00\\u8d85', '4904.TW': '\\u9060\\u50b3', '2603.TW': '\\u9577\\u69ae', '2609.TW': '\\u967d\\u660e', 
    '2615.TW': '\\u842c\\u6d77', '2474.TW': '\\u53ef\\u6210', '3008.TW': '\\u5927\\u7acb\\u5149', '3661.TW': '\\u4e16\\u82af-KY', 
    '6669.TW': '\\u7def\\u7a4e', '2379.TW': '\\u745e\\u6631', '1326.TW': '\\u53f0\\u5316', '6505.TW': '\\u53f0\\u5851\\u5316', 
    '1503.TW': '\\u58eb\\u96fb', '2345.TW': '\\u667a\\u90a6', '2301.TW': '\\u5149\\u5bf6\\u79d1', '5871.TW': '\\u4e2d\\u79df-KY', 
    '5876.TW': '\\u4e0a\\u6d77\\u5546\\u9280', '9910.TW': '\\u8c50\\u6cf0'
  };"""

pattern = r'const nameMap: Record<string, string> = \{[\s\S]*?\};'
# Use lambda or escape the replacement backslashes because re.sub also interprets backslashes
new_content = re.sub(pattern, lambda m: clean_name_map, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Updated nameMap with Unicode escapes literally.")
