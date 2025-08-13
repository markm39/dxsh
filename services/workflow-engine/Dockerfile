FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (including for Playwright browser support)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

# Install Playwright browsers with system dependencies
RUN playwright install --with-deps chromium

COPY src/ ./src/

EXPOSE 5000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "5000"]