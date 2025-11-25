# data_provider.py (excerpt – full in repo)
from enum import Enum
import yfinance as yf
import requests
import pandas as pd
from dotenv import load_dotenv
import os
from typing import Dict, List, Any
from cache import cache  # Our new caching!

load_dotenv()

class Provider(str, Enum):
    YFINANCE = "yfinance"
    FMP = "fmp"
    EODHD = "eodhd"

CURRENT_PROVIDER = Provider(os.getenv("CURRENT_PROVIDER", "yfinance"))

FMP_KEY = os.getenv("FMP_KEY")
EODHD_KEY = os.getenv("EODHD_KEY")

class DataProvider:
    @staticmethod
    @cache(ttl=300)  # 5 min for prices
    def get_price(ticker: str) -> Dict[str, Any]:
        # Full implementation as before – yfinance/FMP/EODHD switch
        # ... (same logic from our chat)

    @staticmethod
    @cache(ttl=86400)  # 24h for historical
    def get_historical(ticker: str, days: int = 365) -> Dict[str, Any]:
        # Full impl...

    @staticmethod
    @cache(ttl=604800)  # 7 days for dividends
    def get_dividends(ticker: str, limit: int = 10) -> Dict[str, Any]:
        # Full impl...