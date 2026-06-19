import os

def get_ai_decision(symbol: str, price_data: dict, strategy_result: dict):
    """
    結合策略回測數據與 AI 判斷 (此處為模擬 AI 邏輯，待接上 Gemini API)
    """
    pnl_pct = strategy_result.get('pnl_pct', 0)
    
    # 這裡未來會接上真正的 LLM Prompt
    # Prompt 會包含：歷史績效、最新價格、MA20 狀態
    
    analysis = f"針對 {symbol}：目前最新價格為 {price_data['close']}。"
    
    if pnl_pct > 20:
        advice = "此標的 V3 歷史表現極佳，顯示其對超跌訊號有強勁反彈慣性。建議維持監控，出現 J < 15 時大膽分批佈局。"
    elif pnl_pct < 0:
        advice = "此標的在 2025 年處於下行趨勢，V3 策略曾觸發止損。目前不建議重倉，應縮小槓桿或觀察月線是否翻揚。"
    else:
        advice = "表現中規中矩，適合在中租之外做為第二備選資產。"

    return {
        "symbol": symbol,
        "advice": advice,
        "strategy_score": pnl_pct,
        "ai_confidence": "HIGH" if abs(pnl_pct) > 10 else "MEDIUM"
    }
