import functions_framework
import os
import tempfile
import sys
import ffmpeg
import json
from google.cloud import firestore
from google.cloud import storage
from openai import OpenAI

# FFmpeg 경로 설정
FFMPEG_PATH = os.path.join(os.path.dirname(__file__), "ffmpeg.exe")
if not os.path.exists(FFMPEG_PATH):
    FFMPEG_PATH = "ffmpeg"

# 클라이언트들을 전역으로 초기화
db = firestore.Client()
storage_client = storage.Client()
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# 임시 파일을 저장할 버킷 이름
TEMP_BUCKET_NAME = "bob-sto"

# 시스템 경로에 audio_processor 모듈 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

def _enhance_audio_for_stt(audio_path):
    """
    음성 인식을 위한 오디오 전처리

    단계:
    1. 노이즈 제거 (배경음 제거)
    2. 침묵 제거 (불필요한 구간 삭제)
    3. 음량 정규화 (일정한 음량 유지)
    4. 톤 균등화 (음성 주파수 강조)
    5. 동적 범위 압축 (명확한 음성)
    """
    try:
        from audio_processor import AudioProcessor
        processor = AudioProcessor(sr=16000)
        enhanced_path = processor.apply_full_enhancement(audio_path)
        print(f"✅ 오디오 강화 완료: {enhanced_path}")
        return enhanced_path
    except Exception as e:
        print(f"⚠️ 오디오 강화 실패 (원본 사용): {str(e)}")
        return audio_path


def _convert_locale_to_iso639_1(locale_code):
    """
    Locale 코드를 ISO-639-1 코드로 변환
    예: 'ko-KR' → 'ko', 'en-US' → 'en', 'ja-JP' → 'ja'
    """
    if not locale_code:
        return "ko"

    # 이미 ISO-639-1 형식이면 그대로 반환
    if len(locale_code) == 2:
        return locale_code.lower()

    # '-' 또는 '_'로 분리된 locale 코드에서 언어 부분만 추출
    language_part = locale_code.split('-')[0].split('_')[0].lower()
    return language_part


def _call_whisper_api(audio_file_path, language_code="ko"):
    """
    OpenAI Whisper API를 사용한 STT 호출

    특징:
    - 99개 언어 지원
    - 단어 단위 타임스탬프 제공
    - 더 높은 정확도 (Google Speech-to-Text 대비)
    """
    # Locale 코드를 ISO-639-1로 변환 (예: 'en-US' → 'en')
    iso_language_code = _convert_locale_to_iso639_1(language_code)
    print(f"🎤 Whisper API 호출 시작 (언어: {iso_language_code}, 원본: {language_code})...")

    try:
        with open(audio_file_path, "rb") as audio_file:
            transcription = openai_client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-1",
                language=iso_language_code,  # ISO-639-1 포맷 사용
                timestamp_granularities=["word", "segment"],
                temperature=0.0,  # 더 정확한 결과
            )

        print(f"✅ Whisper API 호출 완료")
        return transcription
    except Exception as e:
        print(f"❌ Whisper API 오류: {str(e)}")
        raise


def _extract_timestamps_from_whisper(transcription):
    """
    Whisper API 응답에서 단어별 타임스탬프 추출
    """
    all_words = []
    full_transcript = ""

    # 문장 텍스트 추출
    if hasattr(transcription, 'text'):
        full_transcript = transcription.text

    # 단어별 타임스탬프 추출
    if hasattr(transcription, 'words') and transcription.words:
        print(f"단어 레벨 타임스탬프 추출: {len(transcription.words)}개 단어")
        for word_info in transcription.words:
            all_words.append({
                "word": word_info.word,
                "start_time": word_info.start,
                "end_time": word_info.end,
            })
    else:
        # 폴백: segment 레벨 타임스탬프
        print("⚠️ 단어 레벨 타임스탬프 없음, segment 레벨 사용")
        if hasattr(transcription, 'segments') and transcription.segments:
            for segment in transcription.segments:
                all_words.append({
                    "segment": segment.get("text", ""),
                    "start_time": segment.get("start", 0),
                    "end_time": segment.get("end", 0),
                })

    return all_words, full_transcript


@functions_framework.cloud_event
def trigger_stt(cloud_event):
    """
    GCS에 영상 파일이 생성되면 트리거됩니다.

    1. 영상을 임시 다운로드
    2. FFmpeg으로 오디오 추출
    3. 오디오 전처리 (노이즈 제거, 정규화 등)
    4. OpenAI Whisper API로 STT 처리
    5. 임시 파일 삭제
    6. Firestore에 결과 저장
    """
    data = cloud_event.data
    source_bucket_name = data["bucket"]
    source_file_name = data["name"]

    print(f"\n{'='*60}")
    print(f"📹 영상 파일 감지: {source_file_name}")
    print(f"   버킷: {source_bucket_name}")
    print(f"{'='*60}\n")

    # 영상 파일인지 확인
    if not source_file_name.lower().endswith(('.mp4', '.mov', '.avi', '.mkv', '.webm')):
        print(f"⏭️ 영상 파일이 아니므로 처리를 건너뜁니다: {source_file_name}")
        return

    temp_files_to_cleanup = []

    try:
        # 1. 영상 파일 다운로드
        print("📥 단계 1: 영상 파일 다운로드 시작...")
        source_bucket = storage_client.bucket(source_bucket_name)
        source_blob = source_bucket.blob(source_file_name)

        _, temp_local_video_path = tempfile.mkstemp(suffix=os.path.splitext(source_file_name)[1])
        temp_files_to_cleanup.append(temp_local_video_path)
        source_blob.download_to_filename(temp_local_video_path)
        print(f"   ✅ 다운로드 완료: {temp_local_video_path}")

        # 2. FFmpeg으로 오디오 추출 (WAV 형식, 더 높은 비트레이트)
        print("🔊 단계 2: 오디오 추출 시작...")
        temp_local_audio_path = os.path.splitext(temp_local_video_path)[0] + '.wav'
        temp_files_to_cleanup.append(temp_local_audio_path)

        try:
            (
                ffmpeg
                .input(temp_local_video_path)
                .output(temp_local_audio_path, acodec='pcm_s16le', ar=16000, ac=1)
                .run(cmd=FFMPEG_PATH, capture_stdout=True, capture_stderr=True, overwrite_output=True)
            )
            print(f"   ✅ 오디오 추출 완료 (16kHz, Mono, WAV)")
        except ffmpeg.Error as e:
            print(f"   ❌ FFmpeg 오류: {e.stderr.decode()}")
            raise

        # 3. 오디오 전처리 (정확도 향상)
        print("🎛️ 단계 3: 오디오 전처리 시작...")
        enhanced_audio_path = _enhance_audio_for_stt(temp_local_audio_path)
        temp_files_to_cleanup.append(enhanced_audio_path)

        # 4. Whisper API 호출
        print("🎤 단계 4: Whisper API로 STT 처리...")

        # 프로젝트 메타데이터에서 언어 코드 가져오기
        project_id = source_file_name.rsplit('.', 1)[0]
        doc = db.collection("projects").document(project_id).get()
        language_code = "ko-KR"  # 기본값

        if doc.exists:
            # Firestore에서 'language_code' 또는 'language' 필드 찾기
            # (하위 호환성을 위해 둘 다 확인)
            language_code = doc.get("language_code") or doc.get("language", "ko-KR")

        print(f"   📍 프로젝트 언어 설정: {language_code}")

        # _call_whisper_api 함수가 자동으로 locale → ISO-639-1 변환 수행
        transcription = _call_whisper_api(enhanced_audio_path, language_code)

        # 5. 타임스탬프 추출
        print("⏱️ 단계 5: 타임스탬프 추출...")
        all_words, full_transcript = _extract_timestamps_from_whisper(transcription)
        print(f"   ✅ {len(all_words)}개 단어의 타임스탬프 추출 완료")

        # 6. Firestore에 결과 저장
        print(f"💾 단계 6: Firestore에 결과 저장...")
        doc_ref = db.collection("projects").document(project_id)
        doc_ref.set({
            "id": project_id,
            "status": "transcribed",
            "transcript": all_words,
            "full_text": full_transcript.strip(),
            "created_at": firestore.SERVER_TIMESTAMP,
            "stt_engine": "openai-whisper",
            "language_code": _convert_locale_to_iso639_1(language_code),  # ISO-639-1 저장
        }, merge=True)

        print(f"   ✅ Firestore 저장 완료")
        print(f"\n{'='*60}")
        print(f"✨ 전체 STT 처리 완료! (프로젝트: {project_id})")
        print(f"   - 자막 수: {len(all_words)}개")
        print(f"   - 전체 길이: {full_transcript.count(' ') + 1}개 단어")
        print(f"   - STT 엔진: OpenAI Whisper (enhanced audio)")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ STT 처리 중 오류 발생:")
        print(f"   {str(e)}")
        print(f"\n{'='*60}\n")
        raise

    finally:
        # 임시 파일 정리
        print("🗑️ 임시 파일 정리...")
        for file_path in temp_files_to_cleanup:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    print(f"   ✓ 삭제: {os.path.basename(file_path)}")
                except Exception as e:
                    print(f"   ⚠️ 삭제 실패: {os.path.basename(file_path)} - {str(e)}")

    