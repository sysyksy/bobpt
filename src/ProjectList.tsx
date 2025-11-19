import { useState, useEffect } from 'react';
import axios from 'axios';
import { getProjects } from './apiClient';

interface Project {
  id: string;
  fileName: string;
  displayName?: string;
  originalName?: string;
  status: string;
  uploadedAt: string;
  transcriptLength: number;
  captionsCount?: number;
  captionsExtractedAt?: string;
}

interface ProjectListProps {
  onSelectProject: (projectId: string) => void;
}

function ProjectList({ onSelectProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [extractingId, setExtractingId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  // YouTube 다운로드 완료 후 프로젝트 목록 새로고침
  useEffect(() => {
    const handleProjectsUpdated = () => {
      console.log('📂 프로젝트 목록 새로고침');
      loadProjects();
    };

    window.addEventListener('projectsUpdated', handleProjectsUpdated);
    return () => window.removeEventListener('projectsUpdated', handleProjectsUpdated);
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError('');
      const projects = await getProjects();
      setProjects(projects || []);
    } catch (error: any) {
      console.error('프로젝트 목록 로드 실패:', error);
      const errorMsg = error.response?.data?.error || '프로젝트 목록을 불러오지 못했습니다';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 영상 내 자막 추출
  const extractVideoCaptions = async (projectId: string) => {
    try {
      setExtractingId(projectId);
      console.log(`🎬 영상 자막 추출 시작: ${projectId}`);

      const response = await axios.post('/api/extract-video-captions', {
        projectId: projectId,
      });

      console.log('✅ 자막 추출 완료:', response.data);

      alert(`
✅ 영상 내 자막 추출 완료!

📝 추출된 자막: ${response.data.totalCaptions}개
⏱️ 처리 시간: ${response.data.processingTime}초

📊 신뢰도 통계:
  • 평균 신뢰도: ${(response.data.confidenceStats?.average * 100 || 0).toFixed(1)}%
  • 최소 신뢰도: ${(response.data.confidenceStats?.minimum * 100 || 0).toFixed(1)}%
  • 모두 90% 이상: ${response.data.confidenceStats?.allAbove90Percent ? '✅ YES' : '❌ NO'}

프로젝트 목록이 업데이트되었습니다.
      `);

      // 프로젝트 목록 새로고침
      await loadProjects();
    } catch (error: any) {
      console.error('❌ 자막 추출 실패:', error);
      const errorMsg = error.response?.data?.error || '자막 추출에 실패했습니다.';
      alert(`❌ 자막 추출 실패\n\n${errorMsg}`);
    } finally {
      setExtractingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        ⏳ 프로젝트 목록을 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{
      padding: '40px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>
        📂 내 프로젝트
      </h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        업로드한 비디오와 자막을 관리하세요
      </p>

      {error && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fee',
          color: '#c33',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #f99'
        }}>
          ❌ {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div style={{ 
          padding: '60px', 
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📭</div>
          <p style={{ fontSize: '18px', color: '#666' }}>
            아직 프로젝트가 없습니다.
          </p>
          <p style={{ fontSize: '14px', color: '#999', marginTop: '10px' }}>
            "📹 로컬 업로드" 탭에서 비디오를 업로드하세요.
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px' 
        }}>
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              style={{
                padding: '24px',
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              <div style={{ 
                fontSize: '48px', 
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                🎬
              </div>
              
              <h3 style={{
                fontSize: '16px',
                marginBottom: '8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {project.displayName || project.originalName || project.fileName}
              </h3>
              
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                {project.status === 'transcribed' ? (
                  <span style={{ color: '#4caf50' }}>✅ 자막 생성 완료</span>
                ) : (
                  <span style={{ color: '#ff9800' }}>⏳ 처리 중</span>
                )}
              </div>

              <div style={{ fontSize: '12px', color: '#999' }}>
                자막: {project.transcriptLength}줄
              </div>

              {/* 영상 내 추출된 자막 표시 */}
              {project.captionsCount !== undefined && project.captionsCount > 0 && (
                <div style={{ fontSize: '12px', color: '#2196f3', marginTop: '4px' }}>
                  🎬 화면 자막: {project.captionsCount}개
                </div>
              )}

              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                {new Date(project.uploadedAt).toLocaleString('ko-KR')}
              </div>

              {/* 자막 추출 버튼 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  extractVideoCaptions(project.id);
                }}
                disabled={extractingId === project.id}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '10px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  backgroundColor: extractingId === project.id ? '#ccc' : '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: extractingId === project.id ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (extractingId !== project.id) {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#1976d2';
                  }
                }}
                onMouseLeave={(e) => {
                  if (extractingId !== project.id) {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#2196f3';
                  }
                }}
              >
                {extractingId === project.id ? '🔄 추출 중...' : '🎬 영상 내 자막 추출'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectList;

