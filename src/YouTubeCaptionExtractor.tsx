import { useState, useRef } from 'react';
import axios from 'axios';

interface Caption {
  start: number;
  duration: number;
  text: string;
}

interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  channelName: string;
}

type YouTubeMode = 'caption' | 'download';

interface YouTubeCaptionExtractorProps {
  onProjectComplete?: (projectId: string) => void;
}

function YouTubeCaptionExtractor({ onProjectComplete }: YouTubeCaptionExtractorProps) {
  // ========== YouTube 섹션 ==========
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeMode, setYoutubeMode] = useState<YouTubeMode>('caption');
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [videoId, setVideoId] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [saveLocal, setSaveLocal] = useState(false);

  // ========== 로컬 업로드 섹션 ==========
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('ko-KR');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ========== YouTube: 자막 추출 함수 ==========
  const extractCaptions = async () => {
    const url = youtubeUrl.trim();

    if (!url) {
      setYoutubeError('YouTube URL을 입력해주세요.');
      return;
    }

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      setYoutubeError('유효한 YouTube URL이 아닙니다. (youtube.com 또는 youtu.be)');
      return;
    }

    setYoutubeLoading(true);
    setYoutubeError('');
    setCaptions([]);

    try {
      console.log('📺 자막 추출 시작:', url);

      const response = await axios.post('/api/extract-youtube-captions', {
        youtubeUrl: url
      });

      console.log('✅ 자막 추출 성공:', response.data);

      setVideoId(response.data.videoId);
      setCaptions(response.data.captions);
    } catch (err: any) {
      console.error('❌ 자막 추출 실패:', err);
      setYoutubeError(err.response?.data?.error || '자막 추출에 실패했습니다.');
    } finally {
      setYoutubeLoading(false);
    }
  };

  // ========== YouTube: 비디오 정보 조회 ==========
  const fetchVideoInfo = async () => {
    const url = youtubeUrl.trim();

    if (!url) {
      setYoutubeError('YouTube URL을 입력해주세요.');
      return;
    }

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      setYoutubeError('유효한 YouTube URL이 아닙니다. (youtube.com 또는 youtu.be)');
      return;
    }

    setYoutubeLoading(true);
    setYoutubeError('');

    try {
      console.log('📺 비디오 정보 조회:', url);

      const response = await axios.get('/api/youtube-info', {
        params: { url: url }
      });

      console.log('✅ 비디오 정보 조회 성공:', response.data);

      setVideoId(response.data.videoId);
      setVideoInfo({
        title: response.data.title,
        duration: response.data.duration,
        thumbnail: response.data.thumbnail,
        channelName: response.data.channelName,
      });
    } catch (err: any) {
      console.error('❌ 비디오 정보 조회 실패:', err);
      setYoutubeError(err.response?.data?.error || '비디오 정보를 조회할 수 없습니다.');
    } finally {
      setYoutubeLoading(false);
    }
  };

  // ========== YouTube: 영상 다운로드 함수 ==========
  const downloadYouTubeVideo = async () => {
    const url = youtubeUrl.trim();

    if (!url) {
      setYoutubeError('YouTube URL을 입력해주세요.');
      return;
    }

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      setYoutubeError('유효한 YouTube URL이 아닙니다. (youtube.com 또는 youtu.be)');
      return;
    }

    setYoutubeLoading(true);
    setYoutubeError('');

    try {
      console.log('📥 YouTube 영상 다운로드 시작:', url);
      console.log('💾 로컬 저장 옵션:', saveLocal ? '예' : '아니오');

      const response = await axios.post('/api/download-youtube', {
        youtubeUrl: url,
        language: language,
        saveLocal: saveLocal
      });

      console.log('✅ 영상 다운로드 완료:', response.data);

      alert(`
✅ YouTube 영상 다운로드 완료!

🎬 제목: ${response.data.videoTitle}
💾 파일 크기: ${(response.data.fileSize / (1024 * 1024)).toFixed(2)} MB
⏱️ 길이: ${Math.floor(response.data.duration / 60)}분 ${response.data.duration % 60}초
${saveLocal && response.data.downloadUrl ? `📥 로컬 파일 다운로드 URL: ${response.data.downloadUrl}` : ''}

💡 "내 프로젝트" 탭에서 확인할 수 있습니다!
필요시 STT 처리를 시작할 수 있습니다.
      `);

      // 로컬 저장 옵션이 활성화되면 파일 다운로드
      if (saveLocal) {
        const downloadUrl = response.data.localDownloadUrl || response.data.downloadUrl;

        if (downloadUrl) {
          console.log('📥 로컬 파일 다운로드 시작:', downloadUrl);

          const link = document.createElement('a');
          link.href = downloadUrl;
          link.setAttribute('download', `${response.data.videoTitle}.mp4`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          console.log('✅ 파일 다운로드 시작됨');
        }
      }

      // URL 초기화
      setYoutubeUrl('');
      setVideoInfo(null);
      setCaptions([]);
      setSaveLocal(false);

      // 프로젝트 목록 새로고침
      window.dispatchEvent(new Event('projectsUpdated'));

      // 콜백 호출
      if (onProjectComplete) {
        onProjectComplete(response.data.projectId);
      }
    } catch (err: any) {
      console.error('❌ 영상 다운로드 실패:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.details || 'YouTube 영상 다운로드에 실패했습니다.';

      if (err.response?.status === 401) {
        setYoutubeError('로그인이 필요합니다. 다시 로그인해주세요.');
      } else {
        setYoutubeError(errorMsg);
      }
    } finally {
      setYoutubeLoading(false);
    }
  };

  // ========== YouTube: SRT 다운로드 함수 ==========
  const downloadSRT = async () => {
    try {
      const response = await axios.post('/api/generate-srt',
        { captions },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${videoId}_captions.srt`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      console.log('✅ SRT 파일 다운로드 완료');
    } catch (err) {
      console.error('❌ SRT 다운로드 실패:', err);
      alert('SRT 파일 생성에 실패했습니다.');
    }
  };

  // ========== 로컬 업로드: 파일 선택 ==========
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError('');
    }
  };

  // ========== 로컬 업로드: 드래그 드롭 ==========
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setUploadError('');
    } else {
      setUploadError('비디오 파일만 업로드 가능합니다.');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // ========== 로컬 업로드: 파일 업로드 ==========
  const uploadVideo = async () => {
    if (!selectedFile) {
      setUploadError('파일을 선택해주세요.');
      return;
    }

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('language', selectedLanguage);

    setUploading(true);
    setUploadProgress(0);
    setUploadError('');

    try {
      console.log(`📤 로컬 영상 업로드 시작: ${selectedFile.name}`);

      const response = await axios.post('/api/upload-video', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded / (progressEvent.total || 1)) * 100);
          setUploadProgress(progress);
        },
      });

      console.log('✅ 영상 업로드 완료:', response.data);

      alert(`
✅ 영상 업로드 완료!

🎬 파일명: ${selectedFile.name}
💾 파일 크기: ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB

⏳ STT 처리가 자동으로 시작됩니다.
💡 "내 프로젝트" 탭에서 진행 상황을 확인할 수 있습니다.
      `);

      // 파일 초기화
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // 프로젝트 목록 새로고침
      window.dispatchEvent(new Event('projectsUpdated'));

      // 콜백 호출
      if (onProjectComplete) {
        onProjectComplete(response.data.projectId);
      }
    } catch (err: any) {
      console.error('❌ 영상 업로드 실패:', err);
      const errorMsg = err.response?.data?.error || '영상 업로드에 실패했습니다.';
      setUploadError(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      padding: '40px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>
        ▶️ 유튜브 & 영상 업로드
      </h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        YouTube 영상을 자막 추출 또는 영상 다운로드하거나, 로컬 파일을 직접 업로드하세요
      </p>

      {/* ========== [1] YouTube URL 입력 섹션 ========== */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '30px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '2px solid #007bff'
      }}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>
          [1️⃣] YouTube URL 입력
        </h2>

        {/* YouTube 모드 선택 */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => {
              setYoutubeMode('caption');
              setVideoInfo(null);
              setCaptions([]);
              setYoutubeError('');
            }}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: youtubeMode === 'caption' ? '#007bff' : '#e9ecef',
              color: youtubeMode === 'caption' ? 'white' : '#495057',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            📋 자막 추출(맞춤법 검사)
          </button>
          <button
            onClick={() => {
              setYoutubeMode('download');
              setCaptions([]);
              setYoutubeError('');
            }}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: youtubeMode === 'download' ? '#28a745' : '#e9ecef',
              color: youtubeMode === 'download' ? 'white' : '#495057',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            📥 영상 다운로드
          </button>
        </div>

        {/* URL 입력 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="https://youtube.com/watch?v=... 또는 https://youtu.be/..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (youtubeMode === 'caption' ? extractCaptions() : fetchVideoInfo())}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: '16px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              outline: 'none'
            }}
          />
          {youtubeMode === 'caption' ? (
            <button
              onClick={extractCaptions}
              disabled={youtubeLoading}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: youtubeLoading ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: youtubeLoading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {youtubeLoading ? '⏳ 추출 중...' : '📥 자막 추출'}
            </button>
          ) : (
            <button
              onClick={fetchVideoInfo}
              disabled={youtubeLoading}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: youtubeLoading ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: youtubeLoading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {youtubeLoading ? '⏳ 확인 중...' : '🔍 정보 확인'}
            </button>
          )}
        </div>

        {/* 언어 선택 (다운로드 모드) */}
        {youtubeMode === 'download' && (
          <div style={{ marginBottom: '15px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '14px', color: '#666', marginRight: '10px' }}>
                언어 선택:
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="ko-KR">🇰🇷 한국어</option>
                <option value="en-US">🇺🇸 영어</option>
                <option value="ja-JP">🇯🇵 일본어</option>
                <option value="zh-CN">🇨🇳 중국어</option>
                <option value="es-ES">🇪🇸 스페인어</option>
                <option value="fr-FR">🇫🇷 프랑스어</option>
              </select>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              backgroundColor: '#e8f4f8',
              borderRadius: '6px',
              border: '1px solid #b3e5fc'
            }}>
              <input
                type="checkbox"
                id="saveLocal"
                checked={saveLocal}
                onChange={(e) => setSaveLocal(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer'
                }}
              />
              <label
                htmlFor="saveLocal"
                style={{
                  fontSize: '14px',
                  color: '#333',
                  cursor: 'pointer',
                  margin: 0,
                  flex: 1
                }}
              >
                💾 이 컴퓨터에 MP4 파일 저장
              </label>
              <span style={{
                fontSize: '12px',
                color: '#666'
              }}>
                (로컬 저장 + 프로젝트 생성)
              </span>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {youtubeError && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            backgroundColor: '#fee',
            color: '#c33',
            borderRadius: '6px',
            fontSize: '14px'
          }}>
            ❌ {youtubeError}
          </div>
        )}
      </div>

      {/* YouTube 비디오 정보 표시 */}
      {youtubeMode === 'download' && videoInfo && (
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '30px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>
            📺 비디오 정보
          </h3>

          <div style={{ display: 'flex', gap: '30px' }}>
            {videoInfo.thumbnail && (
              <div style={{ flex: '0 0 200px' }}>
                <img
                  src={videoInfo.thumbnail}
                  alt="thumbnail"
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                />
              </div>
            )}

            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ color: '#666', fontSize: '14px', fontWeight: 'bold' }}>📌 제목</label>
                <p style={{ margin: '5px 0 0 0', fontSize: '16px', color: '#000' }}>
                  {videoInfo.title}
                </p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ color: '#666', fontSize: '14px', fontWeight: 'bold' }}>👤 채널</label>
                <p style={{ margin: '5px 0 0 0', fontSize: '16px', color: '#000' }}>
                  {videoInfo.channelName}
                </p>
              </div>

              <div>
                <label style={{ color: '#666', fontSize: '14px', fontWeight: 'bold' }}>⏱️ 길이</label>
                <p style={{ margin: '5px 0 0 0', fontSize: '16px', color: '#000' }}>
                  {Math.floor(videoInfo.duration / 60)}분 {videoInfo.duration % 60}초
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #ddd' }}>
            <button
              onClick={downloadYouTubeVideo}
              disabled={youtubeLoading}
              style={{
                padding: '12px 32px',
                fontSize: '16px',
                backgroundColor: youtubeLoading ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: youtubeLoading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {youtubeLoading ? '📥 다운로드 중...' : '✅ 영상 다운로드'}
            </button>
          </div>
        </div>
      )}

      {/* 자막 미리보기 */}
      {captions.length > 0 && (
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '30px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{ fontSize: '20px', margin: 0 }}>
              📋 추출된 자막 ({captions.length}줄)
            </h3>
            <button
              onClick={downloadSRT}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              💾 SRT 파일 다운로드
            </button>
          </div>

          <div style={{
            maxHeight: '500px',
            overflowY: 'auto',
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '6px',
            border: '1px solid #ddd'
          }}>
            {captions.map((caption, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '15px',
                  paddingBottom: '15px',
                  borderBottom: index < captions.length - 1 ? '1px solid #eee' : 'none'
                }}
              >
                <div style={{
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '5px',
                  fontFamily: 'monospace'
                }}>
                  {formatTime(caption.start)} → {formatTime(caption.start + caption.duration)}
                </div>
                <div style={{ fontSize: '15px', lineHeight: '1.6' }}>
                  {caption.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== [2] 직접 업로드 섹션 ========== */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '30px',
        borderRadius: '8px',
        border: '2px solid #28a745'
      }}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>
          [2️⃣] 직접 업로드 (로컬 파일)
        </h2>

        {/* 언어 선택 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '14px', color: '#666', marginRight: '10px' }}>
            언어 선택:
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          >
            <option value="ko-KR">🇰🇷 한국어</option>
            <option value="en-US">🇺🇸 영어</option>
            <option value="ja-JP">🇯🇵 일본어</option>
            <option value="zh-CN">🇨🇳 중국어</option>
            <option value="es-ES">🇪🇸 스페인어</option>
            <option value="fr-FR">🇫🇷 프랑스어</option>
          </select>
        </div>

        {/* 파일 드래그 드롭 영역 */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            padding: '40px',
            border: '2px dashed #007bff',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: '#e7f3ff',
            marginBottom: '20px'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>📹</div>
          <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 5px 0' }}>
            파일을 여기에 드래그하거나 클릭하세요
          </p>
          <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>
            .mp4, .mov, .avi, .mkv (최대 500MB)
          </p>
        </div>

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* 파일 선택 정보 */}
        {selectedFile && (
          <div style={{
            padding: '15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '6px',
            marginBottom: '20px',
            border: '1px solid #81c784'
          }}>
            <div style={{ fontSize: '14px', color: '#2e7d32' }}>
              ✅ 선택된 파일: <strong>{selectedFile.name}</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#558b2f', marginTop: '5px' }}>
              크기: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </div>
          </div>
        )}

        {/* 업로드 진행률 */}
        {uploading && uploadProgress > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>
              업로드 진행률: {uploadProgress}%
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#ddd',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: '#2196f3',
                transition: 'width 0.2s'
              }} />
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {uploadError && (
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: '#fee',
            color: '#c33',
            borderRadius: '6px',
            fontSize: '14px'
          }}>
            ❌ {uploadError}
          </div>
        )}

        {/* 업로드 버튼 */}
        <button
          onClick={uploadVideo}
          disabled={!selectedFile || uploading}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: !selectedFile || uploading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer'
          }}
        >
          {uploading ? `📤 업로드 중... (${uploadProgress}%)` : '📤 영상 업로드'}
        </button>

        <p style={{ fontSize: '13px', color: '#666', marginTop: '15px' }}>
          💡 업로드 후 자동으로 STT 처리가 시작됩니다.
        </p>
      </div>

      {/* 빈 상태 메시지 */}
      {captions.length === 0 && !youtubeLoading && !youtubeError && !uploading && !selectedFile && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#999'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎬</div>
          <p style={{ fontSize: '16px' }}>
            위의 두 가지 방법 중 하나를 선택하세요
          </p>
        </div>
      )}
    </div>
  );
}

// 시간 포맷팅 함수
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default YouTubeCaptionExtractor;
