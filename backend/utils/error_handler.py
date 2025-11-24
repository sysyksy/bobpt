"""통일된 에러 핸들링"""
import logging
import traceback
from fastapi import HTTPException
from typing import Optional

logger = logging.getLogger("bobpt")


class ErrorHandler:
    """통일된 에러 핸들링 클래스"""

    @staticmethod
    def handle_exception(
        e: Exception,
        context: str,
        user_message: str = "An error occurred",
        status_code: int = 500,
        log_stacktrace: bool = True
    ):
        """
        통일된 방식으로 예외를 처리합니다.

        Args:
            e: 발생한 예외
            context: 에러 발생 위치 (예: "generate_chapters")
            user_message: 사용자에게 보여줄 메시지
            status_code: HTTP 상태 코드
            log_stacktrace: 스택트레이스 로깅 여부

        Raises:
            HTTPException: 항상 HTTPException을 발생시킵니다
        """
        # 개발 환경에서는 상세 정보 로깅
        if log_stacktrace:
            logger.error(f"[{context}] {str(e)}")
            logger.error(traceback.format_exc())
        else:
            logger.error(f"[{context}] {str(e)}")

        # HTTPException은 그대로 raise
        if isinstance(e, HTTPException):
            raise e

        # 일반 예외는 HTTPException으로 변환
        raise HTTPException(
            status_code=status_code,
            detail=user_message
        )

    @staticmethod
    def log_and_raise(
        context: str,
        message: str,
        status_code: int = 500,
        log_level: str = "error"
    ):
        """
        로그를 남기고 HTTPException을 발생시킵니다.

        Args:
            context: 에러 발생 위치
            message: 에러 메시지
            status_code: HTTP 상태 코드
            log_level: 로그 레벨 (error, warning, info)
        """
        log_msg = f"[{context}] {message}"

        if log_level == "error":
            logger.error(log_msg)
        elif log_level == "warning":
            logger.warning(log_msg)
        elif log_level == "info":
            logger.info(log_msg)

        raise HTTPException(status_code=status_code, detail=message)

    @staticmethod
    def safe_operation(
        operation,
        context: str,
        fallback_value=None,
        log_error: bool = True
    ):
        """
        안전하게 작업을 수행하고 실패 시 fallback 값을 반환합니다.

        Args:
            operation: 수행할 함수
            context: 작업 설명
            fallback_value: 실패 시 반환할 값
            log_error: 에러 로깅 여부

        Returns:
            작업 결과 또는 fallback_value
        """
        try:
            return operation()
        except Exception as e:
            if log_error:
                logger.warning(f"[{context}] Operation failed: {str(e)}")
            return fallback_value
