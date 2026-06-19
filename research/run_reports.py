from stress_test_2022 import run_stress_test
import sys
import os

# 重導向 stdout 到文件
orig_stdout = sys.stdout
with open('stress_report.txt', 'w', encoding='utf-8') as f:
    sys.stdout = f
    print("=== 2330.TW Stress Test ===")
    run_stress_test("2330.TW")
    print("\n" + "="*50 + "\n")
    print("=== 2454.TW Stress Test ===")
    run_stress_test("2454.TW")
    print("\n" + "="*50 + "\n")
    print("=== 1503.TW Stress Test ===")
    run_stress_test("1503.TW")
sys.stdout = orig_stdout
print("Report saved to stress_report.txt")
