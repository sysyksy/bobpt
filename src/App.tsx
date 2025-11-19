import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { getProject, getTranscript, updateTranscript, getReadUrl, isAuthenticated, logout } from './apiClient';
import AuthPage from './AuthPage';
import YouTubeCaptionExtractor from './YouTubeCaptionExtractor';
import ProjectList from './ProjectList';
import TranslationControls from './TranslationControls';
import OCRSpellcheckPage from './OCRSpellcheckPage';
import './App.css'; // 수정된 CSS 파일을 import

// --- 타입 정의 ---
interface WordInfo {
  start_time: number;
  end_time: number;
  word: string;
  text?: string;
  translation?: string;
}
interface ProjectData {
  fileName: string;
  transcript: WordInfo[];
  sceneChanges?: number[];  // 화면전환 시간코드 (초단위)
  videoCaptions?: Array<{
    startTime: number;
    endTime: number;
    text: string;
    confidence: number;
  }>;
}
type Page = 'youtube' | 'projects' | 'editor' | 'ocr' | 'auth';
type TimecodeMode = 'auto' | 'interval10s' | 'scenechange';

// --- 유틸리티 함수: 시간 포맷팅 ---
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ⭐️ --- 유틸리티 함수: 자막을 문장 단위로 그룹화 ---
function groupTranscriptIntoSegments(transcript: WordInfo[], pauseThreshold: number = 0.7): WordInfo[][] {
  if (!transcript || transcript.length === 0) return [];
  const segments: WordInfo[][] = [];
  let currentSegment: WordInfo[] = [transcript[0]];
  for (let i = 1; i < transcript.length; i++) {
    const prevWord = transcript[i - 1];
    const currentWord = transcript[i];
    if (currentWord.start_time - prevWord.end_time > pauseThreshold) {
      segments.push(currentSegment);
      currentSegment = [currentWord];
    } else {
      currentSegment.push(currentWord);
    }
  }
  segments.push(currentSegment);
  return segments;
}

// ⭐️ --- 유틸리티 함수: 타임코드 모드에 따라 세그먼트 생성 ---
function groupTranscriptByMode(
  transcript: WordInfo[],
  mode: TimecodeMode,
  sceneChanges?: number[],
  pauseThreshold: number = 1.2
): WordInfo[][] {
  if (!transcript || transcript.length === 0) return [];

  switch (mode) {
    case 'auto':
      // 자동 그룹화 (pause threshold 적용 = 더 자연스러운 문장 단위)
      return groupTranscriptIntoSegments(transcript, pauseThreshold);

    case 'interval10s':
      // 10초 간격 세그먼트
      return groupTranscriptByInterval(transcript, 10);

    case 'scenechange':
      // 화면 전환 기준 세그먼트
      return groupTranscriptBySceneChanges(transcript, sceneChanges || []);

    default:
      return groupTranscriptIntoSegments(transcript, pauseThreshold);
  }
}

// 일정 시간 간격으로 세그먼트 생성 (예: 10초 단위)
function groupTranscriptByInterval(transcript: WordInfo[], intervalSeconds: number): WordInfo[][] {
  if (!transcript || transcript.length === 0) return [];

  const segments: WordInfo[][] = [];
  let currentSegment: WordInfo[] = [];
  let currentIntervalStart = 0;  // 현재 구간의 시작 시간 (0, 10, 20, ...)

  for (const word of transcript) {
    // 단어가 현재 구간을 넘어가면 새로운 세그먼트 시작
    // 예: 0-10s, 10-20s, 20-30s 등 명확한 경계
    const wordIntervalStart = Math.floor(word.start_time / intervalSeconds) * intervalSeconds;

    if (wordIntervalStart > currentIntervalStart && currentSegment.length > 0) {
      // 세그먼트 저장 (0-10초 구간 완료)
      segments.push([...currentSegment]);
      currentSegment = [word];
      currentIntervalStart = wordIntervalStart;
    } else if (currentSegment.length === 0) {
      // 첫 번째 세그먼트 시작
      currentSegment = [word];
      currentIntervalStart = wordIntervalStart;
    } else {
      // 같은 구간 내의 단어 추가
      currentSegment.push(word);
    }
  }

  // 마지막 세그먼트 추가
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

// 화면 전환 포인트 기준으로 세그먼트 생성
function groupTranscriptBySceneChanges(transcript: WordInfo[], sceneChanges: number[]): WordInfo[][] {
  if (!transcript || transcript.length === 0) return [];
  if (sceneChanges.length === 0) {
    // 화면 전환 포인트가 없으면 기본 자동 그룹화 사용
    return groupTranscriptIntoSegments(transcript, 0.7);
  }

  const segments: WordInfo[][] = [];
  let currentSegment: WordInfo[] = [];
  let sceneChangeIndex = 0;

  for (const word of transcript) {
    // 현재 단어의 시작 시간이 다음 화면전환 포인트를 넘어가면 새로운 세그먼트
    if (
      sceneChangeIndex < sceneChanges.length &&
      word.start_time >= sceneChanges[sceneChangeIndex] &&
      currentSegment.length > 0
    ) {
      segments.push([...currentSegment]);
      currentSegment = [];
      sceneChangeIndex++;
    }
    currentSegment.push(word);
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

// ⭐️ --- 메인 앱 컴포넌트 (구조화됨) ---
function App() {
  const [currentPage, setCurrentPage] = useState<Page>(isAuthenticated() ? 'youtube' : 'auth');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentPage('editor');
  };

  const handleAuthSuccess = () => {
    setAuthenticated(true);
    setCurrentPage('youtube');
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setCurrentPage('auth');
  };

  const renderPage = () => {
    if (!authenticated) {
      return <AuthPage onAuthSuccess={handleAuthSuccess} />;
    }

    switch (currentPage) {
      case 'youtube': return <YouTubeCaptionExtractor onProjectComplete={handleSelectProject} />;
      case 'projects': return <ProjectList onSelectProject={handleSelectProject} />;
      case 'editor': return <EditorPage projectId={selectedProjectId} onBack={() => setCurrentPage('projects')} />;
      case 'ocr': return <OCRSpellcheckPage />;
      case 'auth': return <AuthPage onAuthSuccess={handleAuthSuccess} />;
      default: return null;
    }
  };

  return (
    <div>
      {authenticated && <TabMenu currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={handleLogout} />}
      <main>{renderPage()}</main>
    </div>
  );
}

// --- 탭 메뉴 컴포넌트 ---
const TabMenu = ({
  currentPage,
  setCurrentPage,
  onLogout
}: {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  onLogout?: () => void;
}) => (
    <nav className="tab-menu">
      <div className="tab-menu-left">
        <button onClick={() => setCurrentPage('youtube')} className={currentPage === 'youtube' ? 'active' : ''}>
          <span style={{ fontSize: '18px', marginRight: '6px' }}>▶️</span>유튜브
        </button>
        <button onClick={() => setCurrentPage('projects')} className={currentPage === 'projects' ? 'active' : ''}>📂 내 프로젝트</button>
        <button onClick={() => setCurrentPage('ocr')} className={currentPage === 'ocr' ? 'active' : ''}>
          <span style={{ fontSize: '18px', marginRight: '6px' }}>🔍</span>OCR & 맞춤법
        </button>
      </div>
      <div className="tab-menu-right">
        {onLogout && (
          <button onClick={onLogout} className="logout-btn">🚪 로그아웃</button>
        )}
      </div>
    </nav>
);
// ⭐️ --- 에디터 페이지 컴포넌트 (번역 기능 포함) ---
const EditorPage = ({ projectId, onBack }: { projectId: string; onBack: () => void }) => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<WordInfo[][]>([]);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);  // STT 처리 중 상태
  const [error, setError] = useState<string | null>(null);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [timecodeMode, setTimecodeMode] = useState<TimecodeMode>('auto');
  const [pauseThreshold, setPauseThreshold] = useState(1.2);  // 기본값: 1.2초
  const [isEditing, setIsEditing] = useState(false);  // 편집 모드
  const [isSaving, setIsSaving] = useState(false);  // 저장 중 상태
  const [processingProgress, setProcessingProgress] = useState(0);  // 처리 진행률 (0-100)
  const playerRef = useRef<ReactPlayer>(null);

  // 프로젝트 데이터 로드 (STT 처리 상태 폴링)
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const loadProject = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 1. 프로젝트 기본 정보 로드
        const projData = await getProject(projectId);

        // 2. 실제 트랜스크립트 데이터 로드 (STT 결과)
        const transcriptData = await getTranscript(projectId);

        // STT가 처리 중인 경우 폴링 시작
        if (transcriptData.isProcessing) {
          setProjectData({
            fileName: projData.fileName || `${projectId}.mp4`,
            transcript: [],
            sceneChanges: projData.sceneChanges,
            videoCaptions: projData.videoCaptions,
          });
          setError(null);
          setIsLoading(false);
          setIsProcessing(true);

          // 3초마다 폴링 (최대 10분)
          let pollCount = 0;
          const maxPolls = 200; // 3초 * 200 = 600초 = 10분

          // 진행률 시뮬레이션 시작 (0% -> 95%)
          const progressInterval = setInterval(() => {
            setProcessingProgress(prev => {
              if (prev < 95) {
                return prev + Math.random() * 10;
              }
              return prev;
            });
          }, 2000);

          pollInterval = setInterval(async () => {
            pollCount++;
            try {
              const updatedData = await getTranscript(projectId);

              if (!updatedData.isProcessing && updatedData.transcript.length > 0) {
                // STT 완료
                setProjectData({
                  fileName: projData.fileName || `${projectId}.mp4`,
                  transcript: updatedData.transcript,
                  sceneChanges: projData.sceneChanges,
                  videoCaptions: projData.videoCaptions,
                });
                setTranscriptSegments(
                  groupTranscriptByMode(
                    updatedData.transcript,
                    timecodeMode,
                    projData.sceneChanges
                  )
                );
                setIsProcessing(false);
                setProcessingProgress(100);

                if (pollInterval) clearInterval(pollInterval);
                if (progressInterval) clearInterval(progressInterval);
              } else if (pollCount >= maxPolls) {
                // 폴링 타임아웃 (10분)
                setError("STT 처리 시간 초과. 잠시 후 다시 시도해주세요.");
                if (pollInterval) clearInterval(pollInterval);
                if (progressInterval) clearInterval(progressInterval);
              }
            } catch (err) {
              console.error("STT 상태 폴링 중 오류:", err);
            }
          }, 3000);
        } else {
          // STT가 이미 완료된 경우
          setProjectData({
            fileName: projData.fileName || `${projectId}.mp4`,
            transcript: transcriptData.transcript,
            sceneChanges: projData.sceneChanges,
            videoCaptions: projData.videoCaptions,
          });

          // 자막 데이터를 초기 모드에 따라 그룹화
          if (transcriptData.transcript && transcriptData.transcript.length > 0) {
            setTranscriptSegments(
              groupTranscriptByMode(
                transcriptData.transcript,
                timecodeMode,
                projData.sceneChanges
              )
            );
          }

          setIsLoading(false);
        }

        // 비디오 URL 로드
        const fileName = projData.fileName || `${projectId}.mp4`;
        try {
          const readUrl = await getReadUrl(fileName);
          setVideoUrl(readUrl);
        } catch (err) {
          console.error("비디오 URL 로드 실패:", err);
        }
      } catch (err) {
        setError("프로젝트를 불러오는 데 실패했습니다.");
        setIsLoading(false);
      }
    };

    if (projectId) {
      loadProject();
    }

    // 컴포넌트 언마운트 시 폴링 중지
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [projectId, timecodeMode]);

  // 타임코드 모드 또는 pause threshold 변경 시 세그먼트 재생성
  useEffect(() => {
    if (projectData?.transcript) {
      setTranscriptSegments(
        groupTranscriptByMode(
          projectData.transcript,
          timecodeMode,
          projectData.sceneChanges,
          pauseThreshold
        )
      );
    }
  }, [timecodeMode, pauseThreshold, projectData]);

  const handleSegmentClick = (startTime: number) => {
    playerRef.current?.seekTo(startTime, 'seconds');
  };

  // 번역 처리 함수
  const handleTranslate = (translatedTranscript: WordInfo[]) => {
    setProjectData({ ...projectData!, transcript: translatedTranscript });
    setTranscriptSegments(groupTranscriptIntoSegments(translatedTranscript));
  };

  // 자막 텍스트 변경 핸들러
  const handleCaptionChange = (index: number, newText: string) => {
    if (!projectData) return;

    const updatedTranscript = [...projectData.transcript];
    updatedTranscript[index] = {
      ...updatedTranscript[index],
      word: newText,
      text: newText,
    };

    setProjectData({
      ...projectData,
      transcript: updatedTranscript,
    });

    // 세그먼트 재생성
    setTranscriptSegments(
      groupTranscriptByMode(updatedTranscript, timecodeMode, projectData.sceneChanges, pauseThreshold)
    );
  };

  // 저장 함수
  const handleSave = async () => {
    if (!projectData || !projectId) return;

    try {
      setIsSaving(true);

      // 자막 형식 변환: WordInfo -> 서버 포맷
      const captions = projectData.transcript.map((word) => ({
        start: word.start_time,
        end: word.end_time,
        text: word.word || word.text || '',
      }));

      // 전체 트랜스크립트 텍스트
      const transcript = projectData.transcript
        .map(w => w.word || w.text)
        .filter(Boolean)
        .join(' ');

      // API 호출
      await updateTranscript(projectId, transcript, captions);

      setIsEditing(false);
      alert('자막이 저장되었습니다.');
    } catch (err) {
      console.error('저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="status-message">⏳ 프로젝트를 불러오는 중입니다...</div>;
  if (error) return <div className="status-message error">❌ {error}</div>;

  return (
    <div>
      <div className="back-button-container">
        <button onClick={onBack} className="back-button">← 프로젝트 목록</button>
      </div>
      <div className="editor-layout">
        <div className="video-player-section">
          <h2>🎥 {projectData?.fileName}</h2>
          <div className="player-wrapper">
            <ReactPlayer
              ref={playerRef}
              url={videoUrl}
              controls={true}
              width="100%"
              height="auto"
              onProgress={(p) => setPlayedSeconds(p.playedSeconds)}
              config={{
                file: {
                  attributes: {
                    crossOrigin: "anonymous"
                  }
                }
              }}
            />
          </div>
        </div>
        <div className="caption-section">
          <div className="caption-header">
            <h2>📝 자막 편집</h2>

            {/* ⭐️ 타임코드 모드 선택 버튼 */}
            <div className="timecode-mode-selector">
              <label>타임코드 모드:</label>
              <div className="mode-buttons">
                <button
                  className={`mode-btn ${timecodeMode === 'auto' ? 'active' : ''}`}
                  onClick={() => setTimecodeMode('auto')}
                  title="침묵 구간 기반 자동 구분"
                >
                  🤖 자동
                </button>
                <button
                  className={`mode-btn ${timecodeMode === 'interval10s' ? 'active' : ''}`}
                  onClick={() => setTimecodeMode('interval10s')}
                  title="10초 고정 간격으로 자막 분할"
                >
                  ⏱️ 10초 간격
                </button>
                <button
                  className={`mode-btn ${timecodeMode === 'scenechange' ? 'active' : ''}`}
                  onClick={() => setTimecodeMode('scenechange')}
                  title="화면 전환 포인트 기준 분할"
                  disabled={!projectData?.sceneChanges || projectData.sceneChanges.length === 0}
                >
                  🎬 화면전환
                </button>
              </div>
            </div>

            {/* ⭐️ 자동 모드에서 pause threshold 조정 슬라이더 */}
            {timecodeMode === 'auto' && (
              <div className="pause-threshold-slider">
                <label>
                  침묵 감지 임계값: <strong>{pauseThreshold.toFixed(1)}</strong>초
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={pauseThreshold}
                  onChange={(e) => setPauseThreshold(parseFloat(e.target.value))}
                  title="값이 작을수록 더 자주 세그먼트 분할 (작은 문장), 클수록 길게 연결"
                />
                <div className="threshold-hint">
                  {pauseThreshold < 1.0 && '작은 문장으로 분할'}
                  {pauseThreshold >= 1.0 && pauseThreshold < 1.5 && '자연스러운 문장 단위'}
                  {pauseThreshold >= 1.5 && '큰 문단 단위로 통합'}
                </div>
              </div>
            )}

            {/* ⭐️ 번역 컨트롤 추가 */}
            {projectData?.transcript && projectData.transcript.length > 0 && (
              <TranslationControls
                transcript={projectData.transcript}
                onTranslate={handleTranslate}
              />
            )}

            {/* ⭐️ 편집/저장 버튼 */}
            {projectData?.transcript && projectData.transcript.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#ff9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '14px',
                    }}
                  >
                    ✏️ 편집
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: isSaving ? '#ccc' : '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                      }}
                    >
                      {isSaving ? '저장 중...' : '💾 저장'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: '#999',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                      }}
                    >
                      취소
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="caption-list">
            {isProcessing ? (
              <div className="processing-info">
                <h3>
                  <span className="spinner"></span>
                  STT 처리 중입니다
                </h3>
                <p>비디오가 음성 인식으로 변환되고 있습니다...</p>

                {/* 진행 바 */}
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(processingProgress, 95)}%` }}
                  ></div>
                </div>

                {/* 진행률 텍스트 */}
                <p style={{ fontSize: '13px', marginTop: '10px' }}>
                  진행률: {Math.round(processingProgress)}%
                </p>

                {/* 처리 단계 */}
                <div className="processing-steps">
                  <div className={`processing-step ${processingProgress < 40 ? 'active' : ''}`}>
                    1. 오디오 추출
                  </div>
                  <div className={`processing-step ${processingProgress >= 40 && processingProgress < 80 ? 'active' : ''}`}>
                    2. 음성 인식
                  </div>
                  <div className={`processing-step ${processingProgress >= 80 ? 'active' : ''}`}>
                    3. 저장 중
                  </div>
                </div>

                <div className="time-estimate">
                  최초 실행 시 모델 로드로 시간이 걸릴 수 있습니다.
                </div>
              </div>
            ) : transcriptSegments.length > 0 ? (
              transcriptSegments.map((segment, index) => {
                const startTime = segment[0].start_time;
                const endTime = segment[segment.length - 1].end_time;
                const isActive = playedSeconds >= startTime && playedSeconds <= endTime;

                // ⭐️ 원문 텍스트 생성: 단어들을 공백으로 연결
                const segmentText = segment
                  .map(w => w.word || w.text)
                  .filter(Boolean)  // 빈 값 제거
                  .join(' ');

                // ⭐️ 번역된 텍스트 추출: 각 단어의 번역을 합침
                const hasTranslation = segment.some(w => w.translation);
                const translatedText = hasTranslation
                  ? segment
                      .map(w => w.translation || '')
                      .filter(Boolean)  // 빈 값 제거
                      .join(' ')
                  : null;

                return (
                  <div
                    key={index}
                    className={`caption-segment ${isActive ? 'active' : ''}`}
                    onClick={() => handleSegmentClick(startTime)}
                  >
                    <div className="segment-timecode">
                      {formatTime(startTime)} → {formatTime(endTime)}
                    </div>

                    {/* 원문 텍스트 (편집 모드) */}
                    {isEditing ? (
                      <textarea
                        value={segmentText}
                        onChange={(e) => {
                          // 현재 세그먼트의 모든 단어 인덱스 찾기
                          let wordIndex = 0;
                          for (let i = 0; i < index; i++) {
                            wordIndex += transcriptSegments[i].length;
                          }
                          // 단어 단위로 변경
                          const words = e.target.value.split(/\s+/).filter(w => w);
                          words.forEach((word, i) => {
                            if (wordIndex + i < projectData!.transcript.length) {
                              handleCaptionChange(wordIndex + i, word);
                            }
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '8px',
                          fontSize: '14px',
                          fontFamily: 'Arial, sans-serif',
                          borderRadius: '4px',
                          border: '2px solid #ff9800',
                          minHeight: '60px',
                          marginTop: '8px',
                          resize: 'vertical',
                        }}
                      />
                    ) : (
                      <div className="segment-text">{segmentText}</div>
                    )}

                    {/* 번역된 텍스트 (있을 경우) */}
                    {translatedText && (
                      <div className="segment-translation">{translatedText}</div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="no-caption">자막 데이터가 없습니다.</div>
            )}
          </div>
        </div>

        {/* 영상 내 추출된 자막 섹션 */}
        {projectData?.videoCaptions && projectData.videoCaptions.length > 0 && (
          <div className="caption-section" style={{ marginTop: '30px', borderTop: '2px solid #ddd', paddingTop: '20px' }}>
            <div className="caption-header">
              <h2>🎬 영상 내 추출된 자막</h2>
              <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>
                Google Cloud Video Intelligence API (고급 신뢰도 필터링)로 감지된 자막
              </p>

              {/* 신뢰도 통계 표시 */}
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#e8f5e9',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#2e7d32',
                border: '1px solid #81c784'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                  📊 신뢰도 분석
                </div>
                <div>• 추출된 자막: {projectData.videoCaptions.length}개</div>
                <div>• 평균 신뢰도: {((projectData.videoCaptions.reduce((sum: number, c: any) => sum + c.confidence, 0) / projectData.videoCaptions.length) * 100).toFixed(1)}%</div>
                <div>• 최소 신뢰도: {Math.min(...projectData.videoCaptions.map((c: any) => c.confidence * 100)).toFixed(1)}%</div>
                <div>• 필터링: 90% 이상만 포함</div>
              </div>
            </div>
            <div className="caption-list">
              {projectData.videoCaptions.map((caption, index) => (
                <div
                  key={index}
                  className="caption-segment"
                  onClick={() => handleSegmentClick(caption.startTime)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="segment-timecode">
                    {formatTime(caption.startTime)} → {formatTime(caption.endTime)}
                  </div>
                  <div className="segment-text">{caption.text}</div>
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                    marginTop: '4px',
                  }}>
                    신뢰도: {Math.round(caption.confidence * 100)}%
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => downloadVideoCaptionsAsSRT(projectData.videoCaptions || [])}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 'bold',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              💾 자막을 SRT로 다운로드
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// 자막을 SRT 형식으로 다운로드
function downloadVideoCaptionsAsSRT(captions: Array<{
  startTime: number;
  endTime: number;
  text: string;
  confidence?: number;
}>) {
  const srtContent = captions.map((caption, index) => {
    const startTime = formatSRTTime(caption.startTime);
    const endTime = formatSRTTime(caption.endTime);
    return `${index + 1}\n${startTime} --> ${endTime}\n${caption.text}\n`;
  }).join('\n');

  const blob = new Blob([srtContent], { type: 'text/plain; charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'video-captions.srt');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 시간을 SRT 형식으로 변환 (HH:MM:SS,mmm)
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export default App; 


