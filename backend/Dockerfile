# Use official Python 3.11 slim base image
FROM python:3.11-slim

# Set environment variables for non-buffered logging, bytecode prevention, and pythonpath
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8080

WORKDIR /app

# Install system dependencies (curl for container health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies without local virtual environment
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application source code
COPY . .

# Expose default Cloud Run port
EXPOSE 8080

# Start FastAPI using Uvicorn binding to 0.0.0.0 and reading ${PORT:-8080}
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
