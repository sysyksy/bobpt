# 1. Node.js 설치된 환경 불러오기
FROM node:18-alpine

# 2. 작업 폴더 만들기
WORKDIR /app

# 3. 패키지 정보 복사 및 라이브러리 설치
COPY package*.json ./
# npm ci는 npm install보다 더 빠르고 정확합니다 (배포용)
RUN npm ci

# 4. 소스 코드 전체 복사
COPY . .

# 5. Vite 빌드 실행 (TypeScript -> JavaScript 변환)
# 결과물은 보통 'dist' 폴더에 생깁니다.
RUN npm run build

# 6. 정적 파일 실행을 위한 가벼운 서버(serve) 설치
RUN npm install -g serve

# 7. Cloud Run이 요구하는 8080 포트 열기
ENV PORT 8080
EXPOSE 8080

# 8. 서버 실행 (dist 폴더를 8080 포트로 배포)
CMD ["serve", "-s", "dist", "-l", "8080"]

