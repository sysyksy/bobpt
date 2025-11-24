"""통일된 로깅 설정"""
import logging
import sys
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logging(log_level=logging.INFO):
    """통일된 로깅 설정

    Args:
        log_level: 로그 레벨 (기본값: INFO)

    Returns:
        logger: 설정된 로거 인스턴스
    """

    # 로거 생성
    logger = logging.getLogger("bobpt")
    logger.setLevel(log_level)

    # 기존 핸들러 제거 (중복 방지)
    logger.handlers.clear()

    # 포맷 정의
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 콘솔 핸들러
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 로그 디렉토리 생성
    log_dir = Path(__file__).parent.parent / "logs"
    log_dir.mkdir(exist_ok=True)

    # 파일 핸들러 (10MB 로그 파일, 5개까지 보관)
    try:
        file_handler = RotatingFileHandler(
            log_dir / 'bobpt.log',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        logger.warning(f"Failed to create file handler: {e}")

    return logger


def get_logger(name: str = "bobpt") -> logging.Logger:
    """로거 인스턴스 가져오기

    Args:
        name: 로거 이름

    Returns:
        logger: 로거 인스턴스
    """
    return logging.getLogger(name)
