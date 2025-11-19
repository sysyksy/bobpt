# 빌드 스테이지
FROM node:18-alpine AS builder

WORKDIR /app

# 패키지 설치
COPY package*.json ./
RUN npm ci --only=production

# 런타임 스테이지
FROM node:18-alpine

# 환경 변수
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# 빌드 스테이지에서 node_modules 복사
COPY --from=builder /app/node_modules ./node_modules

# 소스 코드 복사
COPY server.js .

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# 포트 노출
EXPOSE 8080

# 서버 실행
CMD ["node", "server.js"]
