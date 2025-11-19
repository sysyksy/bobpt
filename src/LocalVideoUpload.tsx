import { useState, useEffect, useRef } from 'react';
import axios from 'axios';


interface UploadedProject {
  projectId: string;
  fileName: string;
  status: 'processing' | 'transcribed';
}

interface LocalVideoUploadProps {
  onProjectComplete?: (projectId: string) => void;
}

function LocalVideoUpload({ onProjectComplete }: LocalVideoUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedProject, setUploadedProject] = useState<UploadedProject | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('ko-KR');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);  // ⭐️ interval 참조 저장

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setUploadedProject(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setError('');
      setUploadedProject(null);
    } else {
      setError('비디오 파일만 업로드 가능합니다.');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

const uploadVideo = async () => {
  if (!selectedFile) {
    setError('파일을 선택해주세요.');
    return;
  }

  setUploading(true);
  setError('');
  setUploadProgress(0);

  try {
    console.log('📤 1단계: 프로젝트 초기화 및 Signed URL 요청...');

    // 1. 프로젝트 초기화 및 Signed URL 획득
    const initResponse = await axios.post('/api/projects/init', {
      fileName: selectedFile.name,
      language: selectedLanguage,
    });

    const { projectId, uploadUrl } = initResponse.data;
    console.log('✅ Signed URL 획득 완료:', projectId);

    // 2. GCS에 직접 업로드 (Signed URL 사용)
    console.log('📤 2단계: GCS에 직접 업로드 중...');
    await axios.put(uploadUrl, selectedFile, {
      headers: {
        'Content-Type': 'video/mp4',
      },
      timeout: 300000, // 5분 타임아웃
      onUploadProgress: (progressEvent) => {
        const progress = progressEvent.total
          ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
          : 0;
        setUploadProgress(progress);
        console.log(`업로드 진행: ${progress}%`);
      },
    });

    console.log('✅ GCS 업로드 완료!');

    setUploadedProject({
      projectId,
      fileName: selectedFile.name,
      status: 'processing',
    });
    // Status check will be started automatically by useEffect

  } catch (err: any) {
    console.error('❌ 업로드 실패:', err);

    if (err.code === 'ECONNABORTED') {
      setError('업로드 시간 초과. 파일이 너무 큽니다. 더 작은 파일을 선택하세요.');
    } else if (err.response?.status === 503) {
      setError('Google Cloud 설정이 필요합니다. 관리자에게 문의하세요.');
    } else {
      setError(err.response?.data?.detail || err.message || '업로드에 실패했습니다.');
    }
  } finally {
    setUploading(false);
  }
};

  const checkStatus = async (projectId: string) => {
    try {
      const response = await axios.get(`/api/project-status/${projectId}`);

      console.log(`📊 프로젝트 상태: ${response.data.status}, 자막: ${response.data.transcriptLength}줄`);

      if (response.data.status === 'transcribed' && response.data.hasTranscript) {
        setUploadedProject(prev => prev ? { ...prev, status: 'transcribed' } : null);
        return true;
      }

      return false;
    } catch (err) {
      console.error('상태 확인 실패:', err);
      // 네트워크 에러인지 여부 판별
      if (axios.isAxiosError(err) && !err.response) {
        setError('인터넷 연결을 확인하세요.');
      } else if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('인증이 필요합니다. 다시 로그인해주세요.');
      }
      return false;
    }
  };

  // ⭐️ useEffect로 상태 확인 관리 (메모리 누수 방지)
  useEffect(() => {
    if (!uploadedProject?.projectId || uploadedProject.status === 'transcribed') {
      return;  // 상태 확인 불필요
    }

    setChecking(true);
    let attempt = 0;
    const maxAttempts = 360;  // 30분 (5초 * 360)

    intervalRef.current = setInterval(async () => {
      attempt++;
      const completed = await checkStatus(uploadedProject.projectId);

      if (completed) {
        clearInterval(intervalRef.current!);
        setChecking(false);
        console.log('✅ STT 처리 완료!');
        return;
      }

      // 30분 이상 소요되면 종료
      if (attempt >= maxAttempts) {
        clearInterval(intervalRef.current!);
        setChecking(false);
        setError('STT 처리가 시간을 초과했습니다. 나중에 프로젝트 목록에서 확인하세요.');
        console.warn('⚠️ STT 처리 타임아웃 (30분)');
      }
    }, 5000);

    // ⭐️ 클린업: 컴포넌트 언마운트 또는 상태 변경 시 interval 정리
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setChecking(false);
    };
  }, [uploadedProject?.projectId, uploadedProject?.status]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div style={{ 
      padding: '40px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'sans-serif' 
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>
        📹 로컬 비디오 업로드
      </h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        비디오 파일을 업로드하면 자동으로 STT 처리가 시작됩니다
      </p>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '60px 40px',
          textAlign: 'center',
          backgroundColor: selectedFile ? '#f0f8ff' : '#fafafa',
          marginBottom: '20px',
          cursor: 'pointer',
          transition: 'all 0.3s',
        }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        
        {selectedFile ? (
          <div>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📁</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              {selectedFile.name}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {formatFileSize(selectedFile.size)}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>☁️</div>
            <div style={{ fontSize: '18px', marginBottom: '10px' }}>
              파일을 드래그 앤 드롭하거나 클릭하여 선택하세요
            </div>
            <div style={{ fontSize: '14px', color: '#999' }}>
              지원 형식: MP4, MOV, AVI, MKV (최대 500MB)
            </div>
          </div>
        )}
      </div>

{selectedFile && !uploadedProject && (
  <>
    {/* 언어 선택 */}
    <div style={{ marginBottom: '20px' }}>
      <label style={{ 
        display: 'block', 
        marginBottom: '8px',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        🌐 비디오 언어 선택:
      </label>
      <select
        value={selectedLanguage}
        onChange={(e) => setSelectedLanguage(e.target.value)}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '16px',
          border: '2px solid #ddd',
          borderRadius: '6px',
          backgroundColor: 'white',
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

    <button
      onClick={uploadVideo}
      disabled={uploading}
      style={{
        width: '100%',
        padding: '16px',
        fontSize: '18px',
        fontWeight: 'bold',
        backgroundColor: uploading ? '#ccc' : '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: uploading ? 'not-allowed' : 'pointer',
        marginBottom: '20px',
      }}
    >
      {uploading ? `⏳ 업로드 중... ${uploadProgress}%` : '🚀 업로드 & STT 시작'}
    </button>
  </>
)}


      {uploading && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e0e0e0',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              backgroundColor: '#007bff',
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fee',
          color: '#c33',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          ❌ {error}
        </div>
      )}

      {uploadedProject && (
        <div style={{
          padding: '24px',
          backgroundColor: uploadedProject.status === 'transcribed' ? '#e8f5e9' : '#fff3cd',
          borderRadius: '8px',
          border: '1px solid ' + (uploadedProject.status === 'transcribed' ? '#4caf50' : '#ffc107'),
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
            {uploadedProject.status === 'transcribed' ? '✅ STT 처리 완료!' : '⏳ STT 처리 중...'}
          </h3>
          
          <div style={{ marginBottom: '12px' }}>
            <strong>프로젝트 ID:</strong> {uploadedProject.projectId}
          </div>
          
          <div style={{ marginBottom: '12px' }}>
            <strong>파일명:</strong> {uploadedProject.fileName}
          </div>

          {uploadedProject.status === 'processing' && checking && (
            <div style={{ fontSize: '14px', color: '#666', marginTop: '16px' }}>
              💡 자막 생성 중입니다. 비디오 길이에 따라 몇 분이 소요될 수 있습니다.
              <br />
              (5초마다 자동으로 상태를 확인합니다)
            </div>
          )}

          {uploadedProject.status === 'transcribed' && (
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => {
                  if (onProjectComplete) {
                    onProjectComplete(uploadedProject.projectId);
                  }
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                📝 자막 편집하러 가기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LocalVideoUpload;


