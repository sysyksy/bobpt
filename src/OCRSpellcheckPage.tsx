import React, { useState, useRef } from 'react';
import {
  ocrAnalyzeYouTube,
  ocrAnalyzeLocalFile,
  getOCRStatus,
} from './apiClient';
import './OCRSpellcheckPage.css';

// 타입 정의
interface OCRResult {
  source: 'youtube' | 'local';
  ocr_text: string;
  spell_check: {
    original_text: string;
    naver_corrections: Array<{
      type: string;
      original: string;
      suggestions: string[];
      start: number;
      end: number;
    }>;
    google_corrections: Array<{
      type: string;
      text: string;
      position: number;
    }>;
    total_issues: number;
    timestamp: string;
  };
  status: string;
  url?: string;
  file_name?: string;
}

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  requestId: string | null;
  status: string;
}

const OCRSpellcheckPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'youtube' | 'local'>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    requestId: null,
    status: '',
  });
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCorrectionType, setSelectedCorrectionType] = useState<'naver' | 'google' | 'all'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // YouTube URL에서 동영상 ID 추출 (유효성 검사)
  const isValidYoutubeUrl = (url: string): boolean => {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
  };

  // YouTube URL로 OCR 분석 시작
  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!youtubeUrl.trim()) {
      setError('YouTube URL을 입력해주세요.');
      return;
    }

    if (!isValidYoutubeUrl(youtubeUrl)) {
      setError('올바른 YouTube URL을 입력해주세요.');
      return;
    }

    try {
      setProcessing({
        isProcessing: true,
        progress: 0,
        requestId: null,
        status: 'YouTube 영상 다운로드 중...',
      });

      const response = await ocrAnalyzeYouTube(youtubeUrl);

      // 요청 ID 저장 (나중에 진행 상태 확인 가능)
      const requestId = response.request_id;
      setProcessing((prev) => ({
        ...prev,
        requestId,
      }));

      // 즉시 결과 반환된 경우
      if (response.ocr_text) {
        setResult(response as OCRResult);
        setProcessing({
          isProcessing: false,
          progress: 100,
          requestId,
          status: '완료',
        });
      } else {
        // 백그라운드 처리 중인 경우 폴링 시작
        pollOCRStatus(requestId);
      }
    } catch (err: any) {
      setError(err.message || 'YouTube 분석 중 오류가 발생했습니다.');
      setProcessing({
        isProcessing: false,
        progress: 0,
        requestId: null,
        status: '',
      });
    }
  };

  // 로컬 파일로 OCR 분석 시작
  const handleLocalFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError('비디오 파일을 선택해주세요.');
      return;
    }

    // 파일 형식 확인 (MP4, WebM, MKV 등)
    const allowedFormats = ['video/mp4', 'video/webm', 'video/x-matroska'];
    if (!allowedFormats.includes(selectedFile.type) && !selectedFile.name.match(/\.(mp4|webm|mkv|avi|mov)$/i)) {
      setError('지원하는 비디오 형식: MP4, WebM, MKV, AVI, MOV');
      return;
    }

    try {
      setProcessing({
        isProcessing: true,
        progress: 0,
        requestId: null,
        status: '비디오 파일 업로드 중...',
      });

      const response = await ocrAnalyzeLocalFile(selectedFile);

      setResult(response as OCRResult);
      setProcessing({
        isProcessing: false,
        progress: 100,
        requestId: null,
        status: '완료',
      });
    } catch (err: any) {
      setError(err.message || '로컬 파일 분석 중 오류가 발생했습니다.');
      setProcessing({
        isProcessing: false,
        progress: 0,
        requestId: null,
        status: '',
      });
    }
  };

  // OCR 처리 상태 폴링
  const pollOCRStatus = async (requestId: string) => {
    let pollCount = 0;
    const maxPolls = 120; // 5분 (2.5초 * 120)

    const pollInterval = setInterval(async () => {
      pollCount++;

      try {
        const statusResponse = await getOCRStatus(requestId);

        if (statusResponse.status === 'completed' && statusResponse.data) {
          setResult(statusResponse.data as OCRResult);
          setProcessing({
            isProcessing: false,
            progress: 100,
            requestId,
            status: '완료',
          });
          clearInterval(pollInterval);
        } else if (statusResponse.status === 'processing') {
          setProcessing((prev) => ({
            ...prev,
            progress: Math.min(statusResponse.progress || prev.progress + 5, 95),
            status: statusResponse.message || '처리 중...',
          }));
        } else if (statusResponse.status === 'failed') {
          setError(statusResponse.message || 'OCR 분석 중 오류가 발생했습니다.');
          setProcessing({
            isProcessing: false,
            progress: 0,
            requestId,
            status: '실패',
          });
          clearInterval(pollInterval);
        } else if (pollCount >= maxPolls) {
          setError('처리 시간 초과. 잠시 후 다시 시도해주세요.');
          setProcessing({
            isProcessing: false,
            progress: 0,
            requestId,
            status: '타임아웃',
          });
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('폴링 중 오류:', err);
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
        }
      }
    }, 2500); // 2.5초마다 폴링
  };

  // 맞춤법 검사 결과 렌더링
  const renderSpellCheckResults = () => {
    if (!result || !result.spell_check) return null;

    const { naver_corrections, google_corrections, total_issues } = result.spell_check;
    const naverCount = naver_corrections.length;
    const googleCount = google_corrections.length;

    return (
      <div className="spell-check-container">
        <div className="spell-check-header">
          <h3>맞춤법 검사 결과</h3>
          <div className="spell-check-summary">
            <span className={`badge ${total_issues === 0 ? 'success' : 'warning'}`}>
              총 {total_issues}개 오류 발견
            </span>
          </div>
        </div>

        {/* 필터 탭 */}
        <div className="filter-tabs">
          <button
            className={`filter-tab ${selectedCorrectionType === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCorrectionType('all')}
          >
            전체 ({naverCount + googleCount})
          </button>
          <button
            className={`filter-tab ${selectedCorrectionType === 'naver' ? 'active' : ''}`}
            onClick={() => setSelectedCorrectionType('naver')}
          >
            Naver ({naverCount})
          </button>
          <button
            className={`filter-tab ${selectedCorrectionType === 'google' ? 'active' : ''}`}
            onClick={() => setSelectedCorrectionType('google')}
          >
            Google ({googleCount})
          </button>
        </div>

        {/* 오류가 없는 경우 */}
        {total_issues === 0 && (
          <div className="success-message">
            <span>✓</span> 맞춤법 오류가 없습니다!
          </div>
        )}

        {/* Naver 맞춤법 검사 결과 */}
        {(selectedCorrectionType === 'all' || selectedCorrectionType === 'naver') && naverCount > 0 && (
          <div className="correction-section">
            <h4>Naver 문법 검사</h4>
            <div className="corrections-list">
              {naver_corrections.map((correction, index) => (
                <div key={`naver-${index}`} className="correction-item naver">
                  <div className="correction-header">
                    <span className="correction-type">{correction.type}</span>
                    <span className="correction-text">"{correction.original}"</span>
                  </div>
                  {correction.suggestions && correction.suggestions.length > 0 && (
                    <div className="suggestions">
                      <span className="label">제안:</span>
                      {correction.suggestions.map((suggestion, idx) => (
                        <span key={idx} className="suggestion-badge">
                          {suggestion}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Google NLP 구문 검사 결과 */}
        {(selectedCorrectionType === 'all' || selectedCorrectionType === 'google') && googleCount > 0 && (
          <div className="correction-section">
            <h4>Google NLP 구문 분석</h4>
            <div className="corrections-list">
              {google_corrections.map((correction, index) => (
                <div key={`google-${index}`} className="correction-item google">
                  <div className="correction-header">
                    <span className="correction-type">{correction.type}</span>
                    <span className="correction-text">"{correction.text}"</span>
                  </div>
                  <div className="position-info">위치: {correction.position}번째 문자</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="ocr-spellcheck-page">
      <div className="page-header">
        <h1>🔍 OCR & 맞춤법 검사</h1>
        <p>YouTube 영상이나 로컬 파일에서 텍스트를 추출하고 한국어 맞춤법을 검사합니다.</p>
      </div>

      <div className="content-container">
        {/* 입력 영역 */}
        <div className="input-section">
          {/* 탭 */}
          <div className="input-tabs">
            <button
              className={`input-tab ${activeTab === 'youtube' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('youtube');
                setError(null);
              }}
            >
              <span className="icon">▶️</span> YouTube
            </button>
            <button
              className={`input-tab ${activeTab === 'local' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('local');
                setError(null);
              }}
            >
              <span className="icon">📁</span> 로컬 파일
            </button>
          </div>

          {/* YouTube 입력 폼 */}
          {activeTab === 'youtube' && (
            <form onSubmit={handleYoutubeSubmit} className="input-form">
              <div className="form-group">
                <label htmlFor="youtube-url">YouTube URL</label>
                <input
                  id="youtube-url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={processing.isProcessing}
                />
                <small>예: https://www.youtube.com/watch?v=dQw4w9WgXcQ</small>
              </div>

              <button
                type="submit"
                disabled={processing.isProcessing}
                className="submit-btn"
              >
                {processing.isProcessing ? '처리 중...' : '분석 시작'}
              </button>
            </form>
          )}

          {/* 로컬 파일 입력 폼 */}
          {activeTab === 'local' && (
            <form onSubmit={handleLocalFileSubmit} className="input-form">
              <div className="form-group">
                <label htmlFor="video-file">비디오 파일</label>
                <div
                  className={`file-drop-area ${selectedFile ? 'has-file' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    id="video-file"
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      setSelectedFile(e.target.files?.[0] || null);
                      setError(null);
                    }}
                    disabled={processing.isProcessing}
                    style={{ display: 'none' }}
                  />

                  {selectedFile ? (
                    <div className="file-selected">
                      <span className="icon">✓</span>
                      <div className="file-info">
                        <div className="file-name">{selectedFile.name}</div>
                        <div className="file-size">
                          ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <span className="icon">📽️</span>
                      <div>
                        <div className="primary">파일을 선택하거나 드래그해주세요</div>
                        <div className="secondary">
                          지원 형식: MP4, WebM, MKV, AVI, MOV
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={processing.isProcessing || !selectedFile}
                className="submit-btn"
              >
                {processing.isProcessing ? '처리 중...' : '분석 시작'}
              </button>
            </form>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}
        </div>

        {/* 처리 중 표시 */}
        {processing.isProcessing && (
          <div className="processing-section">
            <div className="processing-card">
              <div className="spinner"></div>
              <h3>{processing.status}</h3>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(processing.progress, 100)}%` }}
                ></div>
              </div>
              <p className="progress-text">{Math.round(processing.progress)}% 완료</p>
              <div className="processing-steps">
                <div className={`step ${processing.progress >= 25 ? 'completed' : ''}`}>
                  1단계: 다운로드
                </div>
                <div className={`step ${processing.progress >= 50 ? 'completed' : ''}`}>
                  2단계: 프레임 추출
                </div>
                <div className={`step ${processing.progress >= 75 ? 'completed' : ''}`}>
                  3단계: OCR 분석
                </div>
                <div className={`step ${processing.progress >= 95 ? 'completed' : ''}`}>
                  4단계: 맞춤법 검사
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 결과 표시 */}
        {result && !processing.isProcessing && (
          <div className="result-section">
            {/* 메타 정보 */}
            <div className="result-meta">
              {result.source === 'youtube' && result.url && (
                <div className="meta-item">
                  <span className="label">출처:</span>
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="url">
                    YouTube
                  </a>
                </div>
              )}
              {result.source === 'local' && result.file_name && (
                <div className="meta-item">
                  <span className="label">파일명:</span>
                  <span>{result.file_name}</span>
                </div>
              )}
              {result.spell_check.timestamp && (
                <div className="meta-item">
                  <span className="label">분석 시간:</span>
                  <span>{new Date(result.spell_check.timestamp).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* 탭 형식 결과 표시 */}
            <div className="result-tabs">
              <div className="tab-content">
                <h3>📄 추출된 텍스트</h3>
                <div className="ocr-text-container">
                  <p className="ocr-text">{result.ocr_text}</p>
                  <button
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(result.ocr_text);
                      alert('텍스트가 복사되었습니다.');
                    }}
                  >
                    📋 복사
                  </button>
                </div>
              </div>

              {/* 맞춤법 검사 결과 */}
              {renderSpellCheckResults()}
            </div>

            {/* 새 분석 시작 버튼 */}
            <div className="action-buttons">
              <button
                className="restart-btn"
                onClick={() => {
                  setResult(null);
                  setError(null);
                  setYoutubeUrl('');
                  setSelectedFile(null);
                  setProcessing({
                    isProcessing: false,
                    progress: 0,
                    requestId: null,
                    status: '',
                  });
                }}
              >
                🔄 새로운 분석 시작
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OCRSpellcheckPage;
