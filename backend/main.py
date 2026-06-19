from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal, Price
from logic.v3_strategy import run_v3_premium_strategy
from logic.ai_analyst import get_ai_decision
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

app = FastAPI(title="FinanceFlow AI Backend", version="1.0.0")

# 依賴項：獲取數據庫會話
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"status": "online", "message": "Welcome to FinanceFlow AI Backend"}

@app.get("/stocks/list")
def list_stocks(db: Session = Depends(get_db)):
    """獲取庫中已收錄的股票清單"""
    stocks = db.query(Price.symbol).distinct().all()
    return {"symbols": [s[0] for s in stocks]}

@app.get("/stocks/{symbol}/price")
def get_latest_price(symbol: str, db: Session = Depends(get_db)):
    """獲取單一標的的最新報價"""
    latest = db.query(Price).filter_by(symbol=symbol).order_by(Price.date.desc()).first()
    if not latest:
        raise HTTPException(status_code=404, detail="Stock not found in database")
    return {
        "symbol": symbol,
        "date": latest.date.strftime('%Y-%m-%d'),
        "close": latest.close,
        "high": latest.high,
        "low": latest.low
    }

@app.get("/backtest/{symbol}")
def run_stock_backtest(symbol: str, capital: float = 100000.0, db: Session = Depends(get_db)):
    """針對特定標的執行 V3 策略回測"""
    # 從資料庫取出該標的所有歷史數據
    prices = db.query(Price).filter_by(symbol=symbol).order_by(Price.date.asc()).all()
    if not prices:
        raise HTTPException(status_code=404, detail="No price data for this symbol")
    
    # 轉換為 DataFrame 送入策略引擎
    data_list = []
    for p in prices:
        data_list.append({
            "date": p.date, "open": p.open, "high": p.high, "low": p.low, "close": p.close
        })
    df = pd.DataFrame(data_list)
    
    result = run_v3_premium_strategy(df, capital)
    result["symbol"] = symbol
    return result

@app.get("/analyze/{symbol}")
def analyze_stock(symbol: str, db: Session = Depends(get_db)):
    """綜合回測結果與 AI 決策分析"""
    # 1. 獲取最新價格資訊
    latest = db.query(Price).filter_by(symbol=symbol).order_by(Price.date.desc()).first()
    if not latest:
        raise HTTPException(status_code=404, detail="Symbol not found in DB")
    
    price_info = {"close": latest.close, "date": latest.date.strftime('%Y-%m-%d')}
    
    # 2. 獲取歷史回測結果 (快速回測數據做為 AI 的參考)
    prices = db.query(Price).filter_by(symbol=symbol).order_by(Price.date.asc()).all()
    data_list = [{"date": p.date, "close": p.close, "open": p.open, "high": p.high, "low": p.low} for p in prices]
    df = pd.DataFrame(data_list)
    strategy_res = run_v3_premium_strategy(df)
    
    # 3. 獲取 AI 判斷 (未來會在此處使用 Gemini SDK)
    ai_res = get_ai_decision(symbol, price_info, strategy_res)
    
    return {
        "symbol": symbol,
        "latest_price": price_info,
        "historical_pnl": f"{strategy_res['pnl_pct']}%",
        "ai_analysis": ai_res
    }

# --- 接下來我們會在此引入 回測 與 LLM 分析邏輯 ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
