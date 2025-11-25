~�&}�-j����+�V���~�&}�-j��']�����"��+�#�HȝvW�j����
# main.py (excerpt)
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from data_provider import DataProvider, CURRENT_PROVIDER
from cache import r  # For health
import uvicorn

app = FastAPI(title="W-proj7 Stock Tracker", version="7.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="static")

# Existing API routes (enhanced w/ try/except)
@app.get("/api/price/{ticker}")
async def api_price(ticker: str):
    try:
        return DataProvider.get_price(ticker)
    except Exception as e:
        return {"error": str(e)}

# Similar for historical/dividends...

@app.get("/health")
async def health():
    redis_ok = CACHING_ENABLED and r.ping()
    return {"status": "healthy", "provider": CURRENT_PROVIDER.value, "redis": redis_ok}

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/")
async def root():
    return {"message": "W-proj7 Live!", "provider": CURRENT_PROVIDER.value, "dashboard": "/dashboard", "docs": "/docs"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)