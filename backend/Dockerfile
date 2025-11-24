FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-kor \
    git \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 앱 코드 복사
COPY . .

# 로그 디렉토리 생성
RUN mkdir -p logs

# 포트 설정 (Cloud Run이 자동으로 설정하는 PORT 환경 변수 사용)
ENV PORT=8080
EXPOSE 8080

# 실행 (Cloud Run의 PORT 환경 변수 사용)
CMD uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
