# Production Dockerfile for SoundGraph Backend
# Runs Python 3.11 + Node.js 20 + FFmpeg + Hexa-Sonic v2
FROM python:3.11-slim

# Install system dependencies: ffmpeg, nodejs, npm, curl, build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    git \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install Node.js dependencies for Shazam landmark engine
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# 2. Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# 3. Copy application code
COPY . .

# Environment settings
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PORT=8000

EXPOSE 8000

# Start production server
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
