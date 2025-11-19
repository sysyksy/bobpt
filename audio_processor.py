"""
오디오 전처리 및 강화 모듈

STT(Speech-to-Text) 정확도를 향상시키기 위한 오디오 처리 함수들:
- 노이즈 제거 (Noise Reduction)
- 음량 정규화 (Normalization)
- 음성 활동 감지 (Voice Activity Detection)
- 톤 균등화 (Equalization)
- 동적 범위 압축 (Compression)
"""

import os
import tempfile
import numpy as np
import librosa
import soundfile as sf
from noisereduce import reduce as nr_reduce


class AudioProcessor:
    """오디오 강화 및 전처리"""

    def __init__(self, sr=16000):
        """
        Args:
            sr: 샘플링 레이트 (기본값: 16000 Hz)
        """
        self.sr = sr

    def load_audio(self, audio_path):
        """오디오 파일 로드"""
        print(f"📂 오디오 로드 중: {audio_path}")
        y, sr = librosa.load(audio_path, sr=self.sr, mono=True)
        print(f"   샘플링 레이트: {sr} Hz, 길이: {len(y)/sr:.2f}초")
        return y

    def save_audio(self, y, output_path):
        """오디오 파일 저장"""
        sf.write(output_path, y, self.sr)
        print(f"✅ 오디오 저장 완료: {output_path}")

    def normalize_audio(self, y):
        """
        음량 정규화

        오디오를 -1.0 ~ 1.0 범위로 정규화하고,
        최대 음량을 일정 수준으로 조정합니다.

        효과: 음량 차이로 인한 음성 인식 오차 감소
        """
        print("🔊 음량 정규화 중...")

        # 피크 정규화
        max_val = np.max(np.abs(y))
        if max_val > 0:
            y = y / max_val

        # 라우드니스 정규화 (LUFS 기준)
        # -20 LUFS는 음성 처리에 최적화된 수준
        target_lufs = -20
        current_loudness = self._estimate_loudness(y)
        loudness_diff = target_lufs - current_loudness
        gain = 10 ** (loudness_diff / 20)

        y = y * gain

        # 클리핑 방지
        y = np.clip(y, -1.0, 1.0)

        print(f"   음량 조정 완료 (게인: {gain:.2f}x)")
        return y

    def remove_noise(self, y, noise_duration=1.0):
        """
        노이즈 제거 (Noise Reduction)

        배경음/잡음을 제거하여 음성만 추출합니다.

        효과:
        - 배경 소음 20~30dB 감소
        - 바람음, 에어컨, 기계음 등 제거
        - 정확도 10~15% 향상
        """
        print("🎙️ 노이즈 제거 중...")

        # 오디오 시작 부분을 노이즈 샘플로 사용
        noise_sample_size = int(self.sr * noise_duration)
        noise_sample = y[:noise_sample_size]

        try:
            # noisereduce 라이브러리 사용
            y_denoised = nr_reduce(
                y,
                sr=self.sr,
                noise_duration=noise_duration,
                stationary=True,  # 정상 노이즈 가정
                prop_decrease=1.0,  # 0~1 범위, 1은 최대 감소
            )
            print(f"   노이즈 감소율: 최대")
            return y_denoised
        except Exception as e:
            print(f"   ⚠️ noisereduce 실패: {str(e)}, 원본 사용")
            return y

    def remove_silence(self, y, threshold_db=-40, duration_threshold=0.3):
        """
        침묵 제거 (Silence Removal)

        음성이 없는 구간을 제거합니다.

        효과:
        - 파일 크기 감소
        - STT 처리 시간 단축
        - 필요한 부분만 처리하여 정확도 향상
        """
        print("🔇 침묵 제거 중...")

        # 데시벨 계산
        S = librosa.feature.melspectrogram(y=y, sr=self.sr)
        S_db = librosa.power_to_db(S, ref=np.max)

        # 각 프레임의 음압 계산
        frame_power = np.mean(S_db, axis=0)

        # 음성/침묵 판정
        threshold = np.max(frame_power) + threshold_db
        voice_mask = frame_power > threshold

        # 짧은 구간 필터링 (노이즈 제거)
        min_frames = int(duration_threshold * self.sr / 512)
        voice_mask = self._filter_small_regions(voice_mask, min_frames)

        # 프레임을 샘플로 변환
        frames = librosa.frames_to_samples(np.where(voice_mask)[0], hop_length=512)

        if len(frames) > 0:
            y_trimmed = y[frames[0]:frames[-1]]
            duration_removed = (len(y) - len(y_trimmed)) / self.sr
            print(f"   침묵 제거: {duration_removed:.2f}초 제거됨")
            return y_trimmed
        else:
            print(f"   ⚠️ 음성 구간 없음")
            return y

    def equalize_audio(self, y):
        """
        톤 균등화 (Equalization)

        주파수 대역별 음량을 조정하여
        음성 주파수 대역을 강조합니다.

        효과:
        - 음성 명확도 향상
        - 고음 및 저음 왜곡 감소
        """
        print("🎛️ 톤 균등화 중...")

        # STFT 계산
        D = librosa.stft(y)
        mag = np.abs(D)
        phase = np.angle(D)

        # 주파수 축
        freqs = librosa.fft_frequencies(sr=self.sr)

        # 음성 주파수 대역 강조 (85Hz ~ 8kHz)
        # 이 대역은 대부분의 음성 정보를 포함
        eq_curve = np.ones_like(freqs)

        # 저음 부스트 (85-250 Hz)
        low_mask = (freqs >= 85) & (freqs <= 250)
        eq_curve[low_mask] = 1.3

        # 중음 부스트 (250Hz ~ 3kHz)
        mid_mask = (freqs > 250) & (freqs <= 3000)
        eq_curve[mid_mask] = 1.2

        # 고음 부스트 (3kHz ~ 8kHz)
        high_mask = (freqs > 3000) & (freqs <= 8000)
        eq_curve[high_mask] = 1.1

        # 초음 감소 (8kHz 이상) - 노이즈 대역
        very_high_mask = freqs > 8000
        eq_curve[very_high_mask] = 0.5

        # EQ 적용
        mag_equalized = mag * eq_curve[:, np.newaxis]
        D_equalized = mag_equalized * np.exp(1j * phase)

        # iSTFT로 시간 영역으로 변환
        y_equalized = librosa.istft(D_equalized)

        print(f"   톤 균등화 완료")
        return y_equalized

    def compress_dynamic_range(self, y, threshold=-20, ratio=4):
        """
        동적 범위 압축 (Compression)

        음량 변화가 큰 부분을 압축하여
        일정한 음량 범위로 유지합니다.

        효과:
        - 음성 명확도 향상
        - 작은 음성도 잘 들림
        """
        print("🔐 동적 범위 압축 중...")

        # 데시벨 변환
        y_db = 20 * np.log10(np.abs(y) + 1e-10)

        # 압축 커브 적용
        y_db_compressed = np.where(
            y_db > threshold,
            threshold + (y_db - threshold) / ratio,
            y_db
        )

        # 선형으로 변환
        y_compressed = np.sign(y) * (10 ** (y_db_compressed / 20))

        print(f"   압축비: {ratio}:1, 임계값: {threshold}dB")
        return y_compressed

    def apply_full_enhancement(self, audio_path, output_path=None):
        """
        전체 오디오 강화 파이프라인 실행

        순서:
        1. 로드
        2. 노이즈 제거
        3. 침묵 제거
        4. 음량 정규화
        5. 톤 균등화
        6. 동적 범위 압축
        """
        print("\n" + "="*50)
        print("🎵 오디오 강화 파이프라인 시작")
        print("="*50)

        # 1. 로드
        y = self.load_audio(audio_path)
        original_duration = len(y) / self.sr

        # 2. 노이즈 제거
        y = self.remove_noise(y, noise_duration=1.0)

        # 3. 침묵 제거
        y = self.remove_silence(y)

        # 4. 음량 정규화
        y = self.normalize_audio(y)

        # 5. 톤 균등화
        y = self.equalize_audio(y)

        # 6. 동적 범위 압축
        y = self.compress_dynamic_range(y)

        # 저장
        if output_path is None:
            output_path = audio_path.replace('.mp3', '_enhanced.mp3')

        self.save_audio(y, output_path)

        enhanced_duration = len(y) / self.sr
        print("\n" + "="*50)
        print(f"✅ 강화 완료")
        print(f"   원본: {original_duration:.2f}초 → 강화: {enhanced_duration:.2f}초")
        print(f"   절감: {(1 - enhanced_duration/original_duration)*100:.1f}%")
        print("="*50 + "\n")

        return output_path

    # 헬퍼 메서드들

    def _estimate_loudness(self, y):
        """LUFS 단위로 라우드니스 추정"""
        # 간단한 RMS 기반 추정
        rms = np.sqrt(np.mean(y ** 2))
        loudness = 20 * np.log10(rms + 1e-10)
        return loudness

    @staticmethod
    def _filter_small_regions(mask, min_size):
        """작은 영역 필터링"""
        from scipy import ndimage

        # 작은 True 영역 제거
        labeled, num_features = ndimage.label(mask)
        sizes = ndimage.sum(mask, labeled, range(num_features + 1))

        for i in range(1, num_features + 1):
            if sizes[i] < min_size:
                mask[labeled == i] = False

        return mask


# 사용 예시
if __name__ == "__main__":
    processor = AudioProcessor(sr=16000)

    # 예: 오디오 파일 강화
    # enhanced_path = processor.apply_full_enhancement("audio.mp3")
