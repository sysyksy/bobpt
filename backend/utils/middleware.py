"""디버깅 미들웨어"""
import time
import uuid
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger("bobpt")


class DebugMiddleware(BaseHTTPMiddleware):
    """요청/응답 로깅 및 성능 측정 미들웨어"""

    async def dispatch(self, request: Request, call_next):
        """
        요청을 처리하고 로깅합니다.

        Args:
            request: FastAPI Request 객체
            call_next: 다음 미들웨어 또는 라우트 핸들러

        Returns:
            Response 객체
        """
        # 고유 요청 ID 생성
        request_id = str(uuid.uuid4())[:8]

        # 요청 정보 로깅
        logger.info(f"[{request_id}] {request.method} {request.url.path}")

        # 시작 시간 기록
        start_time = time.time()

        try:
            # 요청 처리
            response = await call_next(request)

            # 처리 시간 계산
            process_time = time.time() - start_time

            # 응답 로깅
            logger.info(
                f"[{request_id}] Completed in {process_time:.2f}s - "
                f"Status: {response.status_code}"
            )

            # 느린 요청 경고
            if process_time > 3.0:
                logger.warning(
                    f"[{request_id}] SLOW REQUEST: {request.method} {request.url.path} "
                    f"took {process_time:.2f}s"
                )

            # 응답 헤더에 요청 ID 추가 (디버깅용)
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time:.4f}"

            return response

        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"[{request_id}] Request failed after {process_time:.2f}s: {str(e)}",
                exc_info=True
            )
            raise


class CORSLoggingMiddleware(BaseHTTPMiddleware):
    """CORS 요청 로깅"""

    async def dispatch(self, request: Request, call_next):
        """CORS 프리플라이트 요청 로깅"""
        if request.method == "OPTIONS":
            logger.debug(f"CORS preflight: {request.url.path}")

        response = await call_next(request)
        return response
