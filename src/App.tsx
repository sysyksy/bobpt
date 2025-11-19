import { useState, useEffect } from 'react'
import { register, login, getProjects, getUploadUrl, getTranscript } from './apiClient'

interface Project {
  projectId: string
  fileName: string
  status: string
  created_at: string
}

interface TranscriptItem {
  start: number
  end: number
  text: string
}

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [message, setMessage] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [currentView, setCurrentView] = useState<'auth' | 'projects' | 'upload' | 'editor'>('auth')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [transcript, setTranscript] = useState<TranscriptItem[]>([])
  const [loadingTranscript, setLoadingTranscript] = useState(false)

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('bobpt_auth_token')
    if (token) {
      setIsLoggedIn(true)
      setCurrentView('projects')
      loadProjects()
    }
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    try {
      if (isLogin) {
        const response = await login(email, password)
        setMessage(`로그인 성공! 환영합니다, ${response.user.name}님`)
        setIsLoggedIn(true)
        setCurrentView('projects')
        loadProjects()
      } else {
        const response = await register(email, password, name)
        setMessage(`회원가입 성공! 환영합니다, ${response.user.name}님`)
        setIsLoggedIn(true)
        setCurrentView('projects')
      }
    } catch (error: any) {
      setMessage(`오류: ${error.response?.data?.detail || error.message}`)
    }
  }

  const loadProjects = async () => {
    try {
      const projectList = await getProjects()
      setProjects(projectList)
      setMessage(`프로젝트 ${projectList.length}개를 불러왔습니다.`)
    } catch (error: any) {
      setMessage(`프로젝트 로딩 실패: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setMessage(`파일 선택됨: ${e.target.files[0].name}`)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('파일을 먼저 선택하세요.')
      return
    }

    setUploading(true)
    setMessage('업로드 중...')

    try {
      // 1. Get upload URL from backend
      const { projectId, uploadUrl } = await getUploadUrl(selectedFile.name)
      setMessage(`프로젝트 생성됨: ${projectId}. 업로드 시작...`)

      // 2. Upload file to GCS
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type || 'video/mp4',
        },
        body: selectedFile,
      })

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`)
      }

      setMessage(`✅ 업로드 완료! 프로젝트 ID: ${projectId}. STT 처리 시작...`)

      // 3. Reload projects
      await loadProjects()

      // 4. Poll for transcript
      pollTranscript(projectId)

      setSelectedFile(null)
      setCurrentView('projects')
    } catch (error: any) {
      setMessage(`업로드 실패: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const pollTranscript = async (projectId: string, attempts = 0) => {
    if (attempts > 20) {
      setMessage(`⚠️ 처리 시간이 너무 오래 걸립니다. 프로젝트 목록에서 확인하세요.`)
      return
    }

    try {
      const transcript = await getTranscript(projectId)
      if (transcript.status === 'completed') {
        setMessage(`🎉 STT 완료! ${transcript.word_count}개 단어 인식됨.`)
        loadProjects()
      } else if (transcript.isProcessing) {
        setMessage(`처리 중... (${attempts + 1}/20)`)
        setTimeout(() => pollTranscript(projectId, attempts + 1), 5000)
      }
    } catch (error: any) {
      if (error.response?.status === 202) {
        // Still processing
        setMessage(`처리 중... (${attempts + 1}/20)`)
        setTimeout(() => pollTranscript(projectId, attempts + 1), 5000)
      } else {
        setMessage(`처리 확인 실패: ${error.message}`)
      }
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('bobpt_auth_token')
    localStorage.removeItem('bobpt_user')
    setIsLoggedIn(false)
    setCurrentView('auth')
    setProjects([])
    setMessage('')
  }

  const handleOpenProject = async (project: Project) => {
    setSelectedProject(project)
    setCurrentView('editor')
    setLoadingTranscript(true)
    setMessage(`프로젝트 "${project.fileName}" 로딩 중...`)

    try {
      const transcriptData = await getTranscript(project.projectId)

      if (transcriptData.transcript && Array.isArray(transcriptData.transcript)) {
        setTranscript(transcriptData.transcript)
        setMessage(`✅ 자막 ${transcriptData.transcript.length}개 로드됨`)
      } else {
        setTranscript([])
        setMessage(`⚠️ 아직 자막이 생성되지 않았습니다. 상태: ${project.status}`)
      }
    } catch (error: any) {
      setMessage(`자막 로딩 실패: ${error.message}`)
      setTranscript([])
    } finally {
      setLoadingTranscript(false)
    }
  }

  return (
    <div style={{
      maxWidth: '900px',
      margin: '50px auto',
      padding: '20px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h1 style={{ margin: 0 }}>🎬 BobPT - AI Video Editor</h1>
        {isLoggedIn && (
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            로그아웃
          </button>
        )}
      </div>

      <p style={{ color: '#666', marginBottom: '30px' }}>
        전체 기능 활성화 테스트 (GCS, Firestore, Translation, OCR)
      </p>

      {/* Auth View */}
      {!isLoggedIn && currentView === 'auth' && (
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2>{isLogin ? '로그인' : '회원가입'}</h2>
          <form onSubmit={handleAuth}>
            {!isLogin && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    borderRadius: '4px',
                    border: '1px solid #ccc'
                  }}
                />
              </div>
            )}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              {isLogin ? '로그인' : '회원가입'}
            </button>
          </form>
          <button
            onClick={() => setIsLogin(!isLogin)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: 'transparent',
              color: '#007bff',
              border: '1px solid #007bff',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isLogin ? '회원가입하기' : '로그인하기'}
          </button>
        </div>
      )}

      {/* Projects View */}
      {isLoggedIn && currentView === 'projects' && (
        <div>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setCurrentView('upload')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ➕ 새 비디오 업로드
            </button>
            <button
              onClick={loadProjects}
              style={{
                padding: '12px 24px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              🔄 새로고침
            </button>
          </div>

          <h2>프로젝트 목록 ({projects.length}개)</h2>
          {projects.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              color: '#666'
            }}>
              아직 프로젝트가 없습니다. 비디오를 업로드하여 시작하세요!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {projects.map((project) => (
                <div
                  key={project.projectId}
                  onClick={() => handleOpenProject(project)}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '15px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0f8ff'
                    e.currentTarget.style.borderColor = '#007bff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.borderColor = '#ddd'
                  }}
                >
                  <h3 style={{ margin: '0 0 10px 0' }}>{project.fileName}</h3>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    <div>ID: {project.projectId}</div>
                    <div>상태: <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: project.status === 'transcribed' ? '#d4edda' : '#fff3cd',
                      color: project.status === 'transcribed' ? '#155724' : '#856404'
                    }}>{project.status}</span></div>
                    <div>생성: {new Date(project.created_at).toLocaleString('ko-KR')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload View */}
      {isLoggedIn && currentView === 'upload' && (
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2>비디오 업로드</h2>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              padding: '40px',
              border: '2px dashed #ccc',
              borderRadius: '8px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: 'white'
            }}>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              {selectedFile ? (
                <div>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>📹</div>
                  <div style={{ fontWeight: 'bold' }}>{selectedFile.name}</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>📁</div>
                  <div>클릭하여 비디오 파일 선택</div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                    MP4, AVI, MOV 등 지원
                  </div>
                </div>
              )}
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: selectedFile && !uploading ? '#28a745' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: selectedFile && !uploading ? 'pointer' : 'not-allowed'
              }}
            >
              {uploading ? '업로드 중...' : '업로드 시작'}
            </button>
            <button
              onClick={() => setCurrentView('projects')}
              disabled={uploading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: uploading ? 'not-allowed' : 'pointer'
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Editor View */}
      {isLoggedIn && currentView === 'editor' && selectedProject && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => {
                setCurrentView('projects')
                setSelectedProject(null)
                setTranscript([])
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '10px'
              }}
            >
              ← 프로젝트 목록으로
            </button>
          </div>

          <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: '#f9f9f9',
            marginBottom: '20px'
          }}>
            <h2 style={{ marginTop: 0 }}>{selectedProject.fileName}</h2>
            <div style={{ fontSize: '14px', color: '#666' }}>
              <div><strong>프로젝트 ID:</strong> {selectedProject.projectId}</div>
              <div><strong>상태:</strong> <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: selectedProject.status === 'transcribed' ? '#d4edda' : '#fff3cd',
                color: selectedProject.status === 'transcribed' ? '#155724' : '#856404',
                marginLeft: '5px'
              }}>{selectedProject.status}</span></div>
              <div><strong>생성일:</strong> {new Date(selectedProject.created_at).toLocaleString('ko-KR')}</div>
            </div>
          </div>

          <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: 'white'
          }}>
            <h3 style={{ marginTop: 0 }}>📝 자막 (Transcript)</h3>

            {loadingTranscript ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                로딩 중...
              </div>
            ) : transcript.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                backgroundColor: '#fff3cd',
                borderRadius: '8px',
                color: '#856404'
              }}>
                {selectedProject.status === 'processing' || selectedProject.status === 'uploading' ? (
                  <>
                    ⏳ STT 처리 중입니다. 잠시 후 다시 확인하세요.
                  </>
                ) : (
                  <>
                    자막이 없습니다.
                  </>
                )}
              </div>
            ) : (
              <div style={{
                maxHeight: '500px',
                overflowY: 'auto',
                border: '1px solid #eee',
                borderRadius: '4px',
                padding: '10px'
              }}>
                {transcript.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '10px',
                      marginBottom: '5px',
                      backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '5px'
                    }}>
                      <span style={{ color: '#007bff', fontWeight: 'bold' }}>
                        #{index + 1}
                      </span>
                      <span style={{ color: '#666', fontSize: '12px' }}>
                        {item.start ? `${item.start.toFixed(2)}s` : '0.00s'} - {item.end ? `${item.end.toFixed(2)}s` : '0.00s'}
                      </span>
                    </div>
                    <div style={{ color: '#333' }}>
                      {item.text || '(텍스트 없음)'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#e7f3ff',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <strong>💡 편집 기능 (추후 추가 예정):</strong>
              <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px' }}>
                <li>자막 편집 및 수정</li>
                <li>다국어 번역 (Google Translation API)</li>
                <li>자막 내보내기 (SRT, VTT, XML)</li>
                <li>비디오 플레이어 연동</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Message Display */}
      {message && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: message.includes('오류') || message.includes('실패') ? '#f8d7da' : '#d4edda',
          color: message.includes('오류') || message.includes('실패') ? '#721c24' : '#155724',
          borderRadius: '4px',
          border: `1px solid ${message.includes('오류') || message.includes('실패') ? '#f5c6cb' : '#c3e6cb'}`
        }}>
          {message}
        </div>
      )}

      {/* Status Panel */}
      <div style={{
        marginTop: '30px',
        padding: '15px',
        backgroundColor: '#e7f3ff',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <h3 style={{ marginTop: 0 }}>🔧 시스템 상태</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>백엔드: <code>http://localhost:8000</code></li>
          <li>인증: {isLoggedIn ? '✅ 로그인됨' : '❌ 로그아웃'}</li>
          <li>Google Cloud Storage: ✅ 활성화</li>
          <li>Firestore: ✅ 활성화</li>
          <li>Translation API: ✅ 활성화</li>
          <li>Vision (OCR): ✅ 활성화</li>
        </ul>
      </div>
    </div>
  )
}

export default App
