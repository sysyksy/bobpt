import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Thumbnail {
  thumbnail_url: string;
  frame_url: string;
  text: string;
  timestamp: number;
  scores: {
    blur_score: number;
    face_count: number;
    face_size: number;
    total_score: number;
  };
}

interface ThumbnailSelectorProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:8000/api'
  : '/api';

export const ThumbnailSelector: React.FC<ThumbnailSelectorProps> = ({
  projectId,
  isOpen,
  onClose
}) => {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [status, setStatus] = useState<'not_started' | 'processing' | 'completed' | 'failed'>('not_started');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // 썸네일 상태 조회
  const fetchThumbnails = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/projects/${projectId}/thumbnails`);
      setThumbnails(response.data.thumbnails || []);
      setStatus(response.data.status || 'not_started');

      if (response.data.status === 'failed') {
        setError(response.data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Failed to fetch thumbnails:', err);
      if (err.response?.status !== 404) {
        setError('썸네일 조회 실패');
      }
    }
  };

  // 썸네일 생성 시작
  const generateThumbnails = async () => {
    setLoading(true);
    setError(null);

    try {
      await axios.post(`${API_BASE_URL}/projects/${projectId}/thumbnails/generate`, {
        num_thumbnails: 3
      });

      setStatus('processing');

      // 5초마다 상태 확인
      const interval = setInterval(async () => {
        await fetchThumbnails();
      }, 5000);

      // 3분 후 타임아웃
      setTimeout(() => {
        clearInterval(interval);
        if (status === 'processing') {
          setError('썸네일 생성 시간 초과');
        }
      }, 180000);

      return () => clearInterval(interval);
    } catch (err: any) {
      console.error('Failed to generate thumbnails:', err);
      setError(err.response?.data?.detail || '썸네일 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  // 텍스트 수정
  const handleTextEdit = (index: number, currentText: string) => {
    setEditingIndex(index);
    setEditText(currentText);
  };

  // 텍스트 저장
  const handleTextSave = async (index: number) => {
    if (editText.trim() === thumbnails[index].text) {
      setEditingIndex(null);
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/projects/${projectId}/thumbnails/regenerate-text`,
        { new_text: editText.trim() },
        { params: { thumbnail_index: index } }
      );

      // 썸네일 업데이트
      const newThumbnails = [...thumbnails];
      newThumbnails[index] = {
        ...newThumbnails[index],
        text: response.data.text,
        thumbnail_url: response.data.thumbnail_url
      };
      setThumbnails(newThumbnails);
      setEditingIndex(null);
    } catch (err: any) {
      console.error('Failed to update text:', err);
      alert('텍스트 수정 실패');
    }
  };

  // 썸네일 다운로드
  const downloadThumbnail = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `thumbnail_${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 초기 로드
  useEffect(() => {
    if (isOpen) {
      fetchThumbnails();
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal bg-black/80 flex items-center justify-center p-4">
      <div className="bg-dark-card rounded-xl border border-dark-border max-w-6xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 bg-dark-card border-b border-dark-border px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold gradient-text">AI 썸네일 생성기</h2>
            <p className="text-gray-400 text-sm mt-1">
              베스트 프레임 추출 + GPT-4o-mini 텍스트 생성
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Status */}
          {status === 'not_started' && (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="w-20 h-20 mx-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">썸네일을 생성해보세요!</h3>
              <p className="text-gray-400 mb-6">
                AI가 영상에서 베스트 프레임을 찾고<br />
                클릭을 유도하는 텍스트를 자동으로 만들어줍니다
              </p>
              <button
                onClick={generateThumbnails}
                disabled={loading}
                className="btn-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner border-2"></span>
                    생성 중...
                  </span>
                ) : (
                  '썸네일 생성 시작'
                )}
              </button>
            </div>
          )}

          {/* Processing */}
          {status === 'processing' && (
            <div className="text-center py-12">
              <div className="spinner border-4 w-16 h-16 mx-auto mb-6"></div>
              <h3 className="text-xl font-bold mb-2">썸네일 생성 중...</h3>
              <p className="text-gray-400">
                영상 분석 및 AI 텍스트 생성 중입니다<br />
                약 1-2분 정도 소요됩니다
              </p>
            </div>
          )}

          {/* Error */}
          {status === 'failed' && error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
              <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-bold mb-2">썸네일 생성 실패</h3>
              <p className="text-red-400">{error}</p>
              <button
                onClick={generateThumbnails}
                className="btn-primary mt-4"
              >
                다시 시도
              </button>
            </div>
          )}

          {/* Thumbnails */}
          {status === 'completed' && thumbnails.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold">생성된 썸네일 ({thumbnails.length}개)</h3>
                  <p className="text-gray-400 text-sm">
                    텍스트를 클릭하여 수정할 수 있습니다
                  </p>
                </div>
                <button
                  onClick={generateThumbnails}
                  className="btn-ghost"
                >
                  🔄 다시 생성
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {thumbnails.map((thumbnail, index) => (
                  <div
                    key={index}
                    className="card-hover p-4"
                  >
                    {/* Thumbnail Image */}
                    <div className="relative mb-4 rounded-lg overflow-hidden">
                      <img
                        src={thumbnail.thumbnail_url}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-auto"
                      />

                      {/* Score Badge */}
                      <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs">
                        <span className="text-green-400">
                          ★ {(thumbnail.scores.total_score * 100).toFixed(0)}%
                        </span>
                      </div>

                      {/* Timestamp */}
                      <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs">
                        {Math.floor(thumbnail.timestamp / 60)}:{String(Math.floor(thumbnail.timestamp % 60)).padStart(2, '0')}
                      </div>
                    </div>

                    {/* Text Editor */}
                    <div className="mb-3">
                      {editingIndex === index ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="input flex-1 text-sm"
                            autoFocus
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleTextSave(index);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleTextSave(index)}
                            className="btn-success px-3 py-1 text-sm"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="btn-secondary px-3 py-1 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleTextEdit(index, thumbnail.text)}
                          className="text-center font-bold text-yellow-400 text-lg cursor-pointer hover:text-yellow-300 transition-colors p-2 rounded hover:bg-gray-800"
                        >
                          "{thumbnail.text}"
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-xs text-gray-400 mb-3">
                      <div>
                        <span className="text-gray-500">선명도:</span>{' '}
                        {thumbnail.scores.blur_score.toFixed(0)}
                      </div>
                      <div>
                        <span className="text-gray-500">얼굴:</span>{' '}
                        {thumbnail.scores.face_count}명
                      </div>
                    </div>

                    {/* Download Button */}
                    <button
                      onClick={() => downloadThumbnail(thumbnail.thumbnail_url, index)}
                      className="btn-primary w-full"
                    >
                      ⬇️ 다운로드
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThumbnailSelector;
