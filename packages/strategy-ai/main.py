from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import os
import requests

app = FastAPI(title="CryptoSmartTrade - Strategy AI (Quant Brain)")

# Security & CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration: Communication with trade-gateway (Node.js)
# In Docker Network, 'backend' (or the Node.js container name) is used.
GATEWAY_URL = os.environ.get("GATEWAY_INTERNAL_URL", "http://backend:4001")

@app.get("/")
async def root():
    return {"status": "AI Signal Engine Online", "role": "Strategy Layer (Python)"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/analyze-signal")
async def analyze_signal(req: Request):
    """
    Receives current market data (from Node.js or others), 
    runs a complex strategy, and then calls trade-gateway to execute.
    """
    data = await req.json()
    symbol = data.get("symbol", "BTCUSDT")
    
    print(f"🧠 [Strategy AI] Analyzing signal for {symbol}...")
    
    # --- PLACEHOLD FOR REAL QUANT LOGIC (Phase 2) ---
    # Example logic: If RSI < 30 then BUY
    signal = "NONE" 
    
    # In this phase, we just bridge to Node.js
    return {
        "symbol": symbol,
        "signal": signal,
        "reason": "AI Brain Connected. Awaiting real logic (Phase 2)."
    }

@app.post("/request-execute")
async def request_execute(symbol: str, type: str, quantity: float):
    """
    Sends signal manually or automatically from Python -> Node.js
    """
    payload = {
        "symbol": symbol,
        "type": type.upper(), # BUY or SELL
        "quantity": quantity,
        "source": "Python-AI-Strategy"
    }
    
    try:
        # Communicate within Docker Network
        response = requests.post(f"{GATEWAY_URL}/api/execute-python", json=payload, timeout=5)
        return response.json()
    except Exception as e:
        return {"error": str(e), "msg": "Failed to communicate with trade-gateway"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
