"""
Audio preprocessing module for improving STT accuracy.
Supports two modes:
1. Vocal Separation (demucs) - for music/background noise removal
2. Highpass Filter (FFmpeg) - for dialogue-focused videos
"""

import subprocess
import os
import logging
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class AudioPreprocessor:
    """Audio preprocessing for STT accuracy improvement"""

    def __init__(self, mode: str = "highpass"):
        """
        Initialize audio preprocessor

        Args:
            mode: "vocal_separation" or "highpass" (default)
        """
        self.mode = mode
        self.demucs_model = "htdemucs"  # High-quality model

    def process(self, input_path: str, output_dir: str) -> str:
        """
        Process audio file based on selected mode

        Args:
            input_path: Path to input audio file
            output_dir: Directory to save processed audio

        Returns:
            Path to processed audio file
        """
        if self.mode == "vocal_separation":
            return self.separate_vocals(input_path, output_dir)
        elif self.mode == "highpass":
            return self.apply_highpass_filter(input_path, output_dir)
        else:
            logger.warning(f"Unknown mode '{self.mode}', using original audio")
            return input_path

    def separate_vocals(self, input_path: str, output_dir: str) -> str:
        """
        Separate vocals from music using Facebook's demucs

        Args:
            input_path: Path to input audio file
            output_dir: Directory to save separated vocals

        Returns:
            Path to separated vocals file, or original if failed
        """
        try:
            logger.info(f"Starting vocal separation with demucs: {input_path}")

            # Create output directory
            os.makedirs(output_dir, exist_ok=True)

            # Run demucs command
            # --two-stems=vocals: Only separate vocals (faster than full 4-stem)
            # -n htdemucs: Use high-quality model
            # -o: Output directory
            command = [
                "demucs",
                "--two-stems=vocals",
                "-n", self.demucs_model,
                "-o", output_dir,
                input_path
            ]

            logger.info(f"Running command: {' '.join(command)}")

            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes max
            )

            if result.returncode != 0:
                logger.error(f"Demucs failed: {result.stderr}")
                return input_path  # Fallback to original

            # Find the separated vocals file
            # demucs creates: output_dir/htdemucs/filename/vocals.wav
            input_filename = Path(input_path).stem
            vocals_path = os.path.join(
                output_dir,
                self.demucs_model,
                input_filename,
                "vocals.wav"
            )

            if os.path.exists(vocals_path):
                logger.info(f"Vocal separation successful: {vocals_path}")
                return vocals_path
            else:
                logger.error(f"Vocals file not found at: {vocals_path}")
                return input_path  # Fallback

        except subprocess.TimeoutExpired:
            logger.error("Demucs timeout (10 minutes exceeded)")
            return input_path
        except FileNotFoundError:
            logger.error("Demucs not installed. Install with: pip install demucs")
            return input_path
        except Exception as e:
            logger.error(f"Vocal separation error: {e}")
            return input_path

    def apply_highpass_filter(self, input_path: str, output_dir: str) -> str:
        """
        Apply highpass filter to remove low-frequency noise (good for dialogue)

        Args:
            input_path: Path to input audio file
            output_dir: Directory to save filtered audio

        Returns:
            Path to filtered audio file, or original if failed
        """
        try:
            logger.info(f"Applying highpass filter: {input_path}")

            # Create output directory
            os.makedirs(output_dir, exist_ok=True)

            # Output filename
            input_filename = Path(input_path).stem
            output_path = os.path.join(output_dir, f"{input_filename}_filtered.wav")

            # FFmpeg highpass filter
            # - highpass=f=200: Remove frequencies below 200Hz (removes rumble, bass)
            # - lowpass=f=3000: Remove frequencies above 3000Hz (removes hiss)
            # - volume=1.5: Boost volume slightly
            command = [
                "ffmpeg",
                "-i", input_path,
                "-af", "highpass=f=200,lowpass=f=3000,volume=1.5",
                "-ar", "16000",  # 16kHz sample rate (Whisper optimal)
                "-ac", "1",      # Mono
                "-y",            # Overwrite
                output_path
            ]

            logger.info(f"Running command: {' '.join(command)}")

            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes max
            )

            if result.returncode != 0:
                logger.error(f"FFmpeg highpass failed: {result.stderr}")
                return input_path  # Fallback

            if os.path.exists(output_path):
                logger.info(f"Highpass filter successful: {output_path}")
                return output_path
            else:
                logger.error(f"Filtered file not found: {output_path}")
                return input_path  # Fallback

        except subprocess.TimeoutExpired:
            logger.error("FFmpeg timeout (5 minutes exceeded)")
            return input_path
        except Exception as e:
            logger.error(f"Highpass filter error: {e}")
            return input_path


def preprocess_audio(
    input_path: str,
    output_dir: str,
    mode: str = "highpass",
    enable: bool = True
) -> str:
    """
    Convenience function for audio preprocessing

    Args:
        input_path: Path to input audio
        output_dir: Output directory
        mode: "vocal_separation" or "highpass"
        enable: Enable preprocessing (if False, return original)

    Returns:
        Path to processed audio file
    """
    if not enable:
        logger.info("Audio preprocessing disabled, using original audio")
        return input_path

    preprocessor = AudioPreprocessor(mode=mode)
    return preprocessor.process(input_path, output_dir)


if __name__ == "__main__":
    # Test
    logging.basicConfig(level=logging.INFO)

    test_audio = "test.mp3"
    output = "output"

    # Test highpass
    result = preprocess_audio(test_audio, output, mode="highpass")
    print(f"Highpass result: {result}")

    # Test vocal separation
    result = preprocess_audio(test_audio, output, mode="vocal_separation")
    print(f"Vocal separation result: {result}")
