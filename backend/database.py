from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, UniqueConstraint, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# 1. 數據庫連接配置
DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'finance_flow.db')
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 2. 數據模型定義 (OHLCV)
class Price(Base):
    __tablename__ = "prices"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    date = Column(DateTime, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Integer)

    __table_args__ = (UniqueConstraint('symbol', 'date', name='_symbol_date_uc'),)

# 3. 數據模型定義 (基本面)
class Fundamental(Base):
    __tablename__ = "fundamentals"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    date = Column(DateTime, index=True)
    revenue = Column(Float)
    eps = Column(Float)
    margin = Column(Float)

    __table_args__ = (UniqueConstraint('symbol', 'date', name='_symbol_fund_uc'),)

# 4. 數據模型定義 (策略研發紀錄)
class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    symbol = Column(String, index=True)
    parameters = Column(JSON)          # 儲存回測參數：{'j_buy': 15, 'trailing_stop': 0.08, ...}
    performance = Column(JSON)         # 儲存主要績效：{'total_pnl_pct': 56.5, 'trades_count': 10}
    sharpe = Column(Float)             # 夏普比率
    drawdown = Column(Float)           # 最大回撤 (MDD)
    created_at = Column(DateTime, default=os.sys.modules['datetime'].datetime.now)

# 5. 初始化數據庫
def init_db():
    Base.metadata.create_all(bind=engine)
    print(f"🚀 數據庫初始化完成：{DB_PATH}")

if __name__ == "__main__":
    init_db()
