FROM python:3.11-slim-bullseye

# System deps (optional, for TA-Lib)
RUN apt-get update && apt-get install -y \
    build-essential \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# TA-Lib build 
# --- (Simplified for now, real build script can be added) ---
# For now, let's just use Python deps and add talib-binary if needed.

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
