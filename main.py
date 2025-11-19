import functions_framework
import os
import tempfile
import subprocess
from openai import OpenAI
from google.cloud import firestore
from google.cloud import storage
from translation_agent import TranslationAgent

FFMPEG_PATH = "ffmpeg"
db = firestore.Client()
storage_client = storage.Client()
TEMP_BUCKET_NAME = "bob-sto"

# OpenAI Whisper 클라이언트 초기화
openai_api_key = os.environ.get('OPENAI_API_KEY')
client = OpenAI(api_key=openai_api_key) if openai_api_key else None

# TranslationAgent 초기화
try:
    translation_agent = TranslationAgent(api_key=openai_api_key)
    print("[OK] TranslationAgent initialized")
except Exception as e:
    print(f"[WARN] TranslationAgent initialization failed: {str(e)}")
    translation_agent = None

# 타겟 번역 언어 (환경 변수로 설정 가능)
# 예: TRANSLATION_LANGUAGES="en,ja,zh"
TARGET_LANGUAGES = os.environ.get('TRANSLATION_LANGUAGES', 'en').split(',')
ENABLE_TRANSLATION = os.environ.get('ENABLE_TRANSLATION', 'true').lower() == 'true'

@functions_framework.cloud_event
def trigger_stt(cloud_event):
    """
    GCS에 영상 파일이 생성되면 트리거됩니다.
    """
    data = cloud_event.data
    source_bucket_name = data["bucket"]
    source_file_name = data["name"]

    print(f"영상 파일 감지: {source_file_name} in bucket: {source_bucket_name}")

    # temp_audio 폴더의 파일은 무시
    if source_file_name.startswith('temp_audio/'):
        print(f"임시 오디오 파일은 건너뜁니다: {source_file_name}")
        return

    # 영상 파일인지 확인
    if not source_file_name.lower().endswith(('.mp4', '.mov', '.avi', '.mkv')):
        print(f"영상 파일이 아니므로 처리를 건너뜁니다: {source_file_name}")
        return

    # 1. 영상 파일 다운로드
    source_bucket = storage_client.bucket(source_bucket_name)
    source_blob = source_bucket.blob(source_file_name)
    
    _, temp_local_video_path = tempfile.mkstemp(suffix=os.path.splitext(source_file_name)[1])
    print(f"영상을 임시 로컬 경로에 다운로드: {temp_local_video_path}")
    source_blob.download_to_filename(temp_local_video_path)

    # 2. FFmpeg으로 오디오 추출 및 강화 (단일 프로세스)
    temp_local_audio_path = os.path.splitext(temp_local_video_path)[0] + '.mp3'
    print(f"🎵 FFmpeg으로 오디오 추출 및 강화 시작... -> {temp_local_audio_path}")

    try:
        # FFmpeg 명령어: 오디오 추출 + Highpass 필터 + Loudness 정규화
        cmd = [
            FFMPEG_PATH,
            "-i", temp_local_video_path,
            "-af", "highpass=f=200, loudnorm=I=-16:TP=-1.5:LRA=11",
            "-vn",  # 비디오 제거
            "-acodec", "libmp3lame",
            "-q:a", "2",  # 가변 비트레이트 (품질 좋음)
            "-y",  # 덮어쓰기
            temp_local_audio_path
        ]

        # subprocess로 실행 (capture_output=True로 버퍼 오버플로우 방지)
        result = subprocess.run(cmd, check=True, capture_output=True)
        print("✅ FFmpeg 오디오 추출 및 강화 완료")
        audio_to_upload = temp_local_audio_path

    except subprocess.CalledProcessError as e:
        print(f"❌ FFmpeg 오류 발생: {e.stderr.decode()}")
        os.remove(temp_local_video_path)
        raise

    # 4. 강화된 오디오를 GCS에 업로드
    audio_file_name = os.path.splitext(source_file_name)[0] + '.mp3'
    temp_bucket = storage_client.bucket(TEMP_BUCKET_NAME)
    audio_blob = temp_bucket.blob(f"temp_audio/{audio_file_name}")

    print(f"오디오를 GCS에 업로드: gs://{TEMP_BUCKET_NAME}/temp_audio/{audio_file_name}")
    audio_blob.upload_from_filename(audio_to_upload)

    # Firestore에서 언어 정보 가져오기 (파일 정리 전에 수행)
    project_id = source_file_name.rsplit('.', 1)[0]
    doc_ref = db.collection("projects").document(project_id)
    project_doc = doc_ref.get()

    # ISO-639-1 형식으로 변환 (ko-KR → ko)
    language_code = "ko"  # 기본값
    if project_doc.exists:
        project_data = project_doc.to_dict()
        lang_setting = project_data.get("language", "ko-KR")
        # ko-KR, en-US 등 → ko, en
        language_code = lang_setting.split('-')[0].lower()
        print(f"프로젝트 언어 설정: {language_code}")

    # 4. OpenAI Whisper API 호출 (파일 정리 전에 수행)
    if not client:
        print("❌ OpenAI API 키가 설정되지 않았습니다.")
        os.remove(temp_local_video_path)
        os.remove(temp_local_audio_path)
        raise Exception("OpenAI API 키가 필요합니다")

    print(f"🎙️ Whisper API로 음성 인식 시작... (언어: {language_code})")

    try:
        # FFmpeg으로 강화된 오디오 파일 사용
        with open(audio_to_upload, 'rb') as audio_file:
            transcription = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-1",
                language=language_code,
                temperature=0,
                timestamp_granularities=["word", "segment"],
            )

        print("✅ Whisper 음성 인식 완료")

        all_words = []
        full_transcript = transcription.text

        # 단어별 타임스탐프 추출
        if hasattr(transcription, 'words') and transcription.words:
            print(f"📝 단어별 타임스탐프 추출 중... ({len(transcription.words)}개)")
            for word_info in transcription.words:
                all_words.append({
                    "word": word_info.word,
                    "start_time": word_info.start,
                    "end_time": word_info.end,
                })
            print(f"✅ {len(all_words)}개의 단어 추출 완료")
        else:
            print("⚠️ 단어 수준의 타임스탐프를 사용할 수 없습니다. 문장 단위로 분할합니다.")
            # Fallback: 문장 단위로 분할
            sentences = full_transcript.split('.')
            current_time = 0
            for sentence in sentences:
                sentence = sentence.strip()
                if not sentence:
                    continue
                # 문장 길이를 기반으로 대략적인 시간 계산 (단어당 약 0.5초)
                estimated_duration = max(len(sentence.split()) * 0.5, 1.0)
                all_words.append({
                    "word": sentence,
                    "start_time": current_time,
                    "end_time": current_time + estimated_duration,
                })
                current_time += estimated_duration
            print(f"✅ {len(all_words)}개의 문장 추출 완료")

    except Exception as e:
        print(f"❌ Whisper API 호출 실패: {str(e)}")
        raise
    
    # Firestore에 STT 결과 저장 (merge=True로 기존 데이터 유지)
    doc_ref.set({
        "id": project_id,
        "status": "transcribed",
        "transcript": all_words,
        "full_text": full_transcript.strip(),
        "fileName": source_file_name,
        "created_at": firestore.SERVER_TIMESTAMP,
    }, merge=True)

    print(f"✅ Firestore STT 결과 저장 완료: Project ID = {project_id}")

    # ========== 5. 번역 파이프라인 (선택적) ==========
    if ENABLE_TRANSLATION and translation_agent and TARGET_LANGUAGES:
        print("\n" + "="*60)
        print("🌍 번역 파이프라인 시작")
        print(f"   타겟 언어: {', '.join(TARGET_LANGUAGES)}")
        print("="*60 + "\n")

        try:
            # 프로젝트 메타데이터 가져오기
            project_data = doc_ref.get().to_dict()
            original_filename = project_data.get("fileName", "Untitled")

            # 제목과 설명 생성 (파일명 기반)
            title = os.path.splitext(original_filename)[0]
            description = f"Video transcription and translation generated by Project Brew. Original file: {original_filename}"

            # 자막 데이터 변환 (Firestore 형식 → TranslationAgent 형식)
            captions_for_translation = []
            for word_info in all_words:
                captions_for_translation.append({
                    "start": word_info.get("start_time", 0),
                    "end": word_info.get("end_time", 0),
                    "text": word_info.get("word", ""),
                })

            # 전체 프로젝트 번역
            translation_result = translation_agent.translate_project(
                full_transcript=full_transcript.strip(),
                captions=captions_for_translation,
                title=title,
                description=description,
                target_languages=TARGET_LANGUAGES,
                source_language=language_code
            )

            # Firestore에 번역 결과 저장
            translations_data = {}
            for lang, trans in translation_result["translations"].items():
                # 자막을 Firestore 형식으로 변환
                translated_words = []
                for caption in trans["captions"]:
                    translated_words.append({
                        "start_time": caption.get("start", 0),
                        "end_time": caption.get("end", 0),
                        "word": caption.get("text", ""),
                    })

                translations_data[lang] = {
                    "title": trans["title"],
                    "description": trans["description"],
                    "captions": translated_words,
                    "full_text": " ".join([c.get("text", "") for c in trans["captions"]])
                }

            # Firestore 업데이트
            doc_ref.update({
                "translations": translations_data,
                "context": translation_result.get("context", {}),
                "translation_status": "completed",
            })

            print("\n" + "="*60)
            print(f"✅ 번역 완료: {len(translations_data)}개 언어")
            for lang in translations_data.keys():
                print(f"   - {lang.upper()}: {translations_data[lang]['title']}")
            print("="*60 + "\n")

        except Exception as e:
            print(f"⚠️ 번역 실패 (STT 결과는 저장됨): {str(e)}")
            # 번역 실패해도 STT 결과는 유지
            doc_ref.update({
                "translation_status": "failed",
                "translation_error": str(e)
            })
    else:
        print("ℹ️ 번역 비활성화 또는 TranslationAgent 미사용")

    # 6. 모든 로컬 임시 파일 정리
    print("🧹 로컬 임시 파일 정리 중...")
    try:
        if os.path.exists(temp_local_video_path):
            os.remove(temp_local_video_path)
            print(f"   ✅ 삭제: {temp_local_video_path}")
    except Exception as e:
        print(f"   ⚠️ 비디오 파일 삭제 실패: {str(e)}")

    try:
        if os.path.exists(temp_local_audio_path):
            os.remove(temp_local_audio_path)
            print(f"   ✅ 삭제: {temp_local_audio_path}")
    except Exception as e:
        print(f"   ⚠️ 오디오 파일 삭제 실패: {str(e)}")

    # 7. GCS의 임시 오디오 파일 삭제
    print(f"GCS의 임시 오디오 파일 삭제: {audio_blob.name}")
    audio_blob.delete()

    print(f"✅ 모든 처리 완료: {project_id}")

    