import { useState, useEffect } from 'react'
import { register, login, getProjects, getUploadUrl, getTranscript, deleteProject, translateCaptions, exportProject, updateTranscript, getReadUrl } from './apiClient'

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

  // Editor features state
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editedText, setEditedText] = useState('')
  const [saving, setSaving] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translatedCaptions, setTranslatedCaptions] = useState<TranscriptItem[]>([])
  const [targetLanguage, setTargetLanguage] = useState('en')
  const [showTranslation, setShowTranslation] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('bobpt_auth_token')
    if (token) {
      setIsLoggedIn(true)
      setCurrentView('projects')
      loadProjects()
    }

    // Handle browser back/forward buttons
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setCurrentView(event.state.view)
        if (event.state.view === 'editor' && event.state.project) {
          setSelectedProject(event.state.project)
        } else {
          setSelectedProject(null)
          setTranscript([])
          setTranslatedCaptions([])
          setShowTranslation(false)
          setVideoUrl(null)
        }
      }
    }

    window.addEventListener('popstate', handlePopState)

    // Set initial history state
    if (!window.history.state) {
      window.history.replaceState({ view: currentView }, '')
    }

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const navigateToView = (view: 'auth' | 'projects' | 'upload' | 'editor', project?: Project) => {
    setCurrentView(view)
    window.history.pushState({ view, project }, '', `#${view}`)
  }

  const goBack = () => {
    window.history.back()
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    try {
      if (isLogin) {
        const response = await login(email, password)
        setMessage(`로그인 성공! 환영합니다, ${response.user.name}님`)
        setIsLoggedIn(true)
        navigateToView('projects')
        loadProjects()
      } else {
        const response = await register(email, password, name)
        setMessage(`회원가입 성공! 환영합니다, ${response.user.name}님`)
        setIsLoggedIn(true)
        navigateToView('projects')
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
      navigateToView('projects')
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
    navigateToView('auth')
    setProjects([])
    setMessage('')
  }

  const handleOpenProject = async (project: Project) => {
    setSelectedProject(project)
    navigateToView('editor', project)
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

      // Load video URL
      loadVideoUrl(project.fileName)
    } catch (error: any) {
      setMessage(`자막 로딩 실패: ${error.message}`)
      setTranscript([])
    } finally {
      setLoadingTranscript(false)
    }
  }

  const loadVideoUrl = async (fileName: string) => {
    setLoadingVideo(true)
    try {
      const url = await getReadUrl(fileName)
      setVideoUrl(url)
    } catch (error: any) {
      console.error('비디오 URL 로딩 실패:', error)
      setVideoUrl(null)
    } finally {
      setLoadingVideo(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!selectedProject) return

    const confirmed = window.confirm(
      `"${selectedProject.fileName}" 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    )

    if (!confirmed) return

    try {
      setMessage('프로젝트 삭제 중...')
      await deleteProject(selectedProject.projectId)
      setMessage(`✅ 프로젝트가 삭제되었습니다.`)
      navigateToView('projects')
      setSelectedProject(null)
      setTranscript([])
      loadProjects()
    } catch (error: any) {
      setMessage(`❌ 프로젝트 삭제 실패: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleEditStart = (index: number, text: string) => {
    setEditingIndex(index)
    setEditedText(text)
  }

  const handleEditCancel = () => {
    setEditingIndex(null)
    setEditedText('')
  }

  const handleEditSave = async () => {
    if (editingIndex === null || !selectedProject) return

    setSaving(true)
    try {
      // Update the transcript item
      const updatedTranscript = [...transcript]
      updatedTranscript[editingIndex] = {
        ...updatedTranscript[editingIndex],
        text: editedText
      }

      // Convert to backend format (captions with start, end, text)
      const captions = updatedTranscript.map(item => ({
        start: item.start || 0,
        end: item.end || 0,
        text: item.text || ''
      }))

      // Send update to backend
      await updateTranscript(
        selectedProject.projectId,
        updatedTranscript.map(item => item.text).join('\n'),
        captions
      )

      // Update local state
      setTranscript(updatedTranscript)
      setMessage('✅ 자막이 저장되었습니다.')
      setEditingIndex(null)
      setEditedText('')
    } catch (error: any) {
      setMessage(`❌ 저장 실패: ${error.response?.data?.detail || error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTranslate = async () => {
    if (transcript.length === 0) {
      setMessage('⚠️ 번역할 자막이 없습니다.')
      return
    }

    setTranslating(true)
    setMessage(`번역 중... (${targetLanguage})`)

    try {
      const captions = transcript.map(item => ({
        start: item.start || 0,
        end: item.end || 0,
        text: item.text || ''
      }))

      const result = await translateCaptions({
        captions,
        targetLanguage
      })

      // Convert translated captions to TranscriptItem format
      const translated = result.translated.map((item: any) => ({
        start: item.start,
        end: item.end,
        text: item.text
      }))

      setTranslatedCaptions(translated)
      setShowTranslation(true)
      setMessage(`✅ 번역 완료! (${result.originalLanguage} → ${result.targetLanguage})`)
    } catch (error: any) {
      setMessage(`❌ 번역 실패: ${error.response?.data?.detail || error.message}`)
    } finally {
      setTranslating(false)
    }
  }

  const handleExport = async (format: 'srt' | 'vtt' | 'premiere' | 'fcpx') => {
    if (!selectedProject) return

    try {
      setMessage(`내보내기 중... (${format.toUpperCase()})`)
      await exportProject(selectedProject.projectId, {
        format,
        frameRate: 30,
        videoWidth: 1920,
        videoHeight: 1080
      })
      setMessage(`✅ ${format.toUpperCase()} 파일이 다운로드되었습니다.`)
    } catch (error: any) {
      setMessage(`❌ 내보내기 실패: ${error.response?.data?.detail || error.message}`)
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
              onClick={() => navigateToView('upload')}
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
              onClick={goBack}
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
          {/* Header with Back and Delete buttons */}
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={goBack}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ← 뒤로가기
            </button>
            <button
              onClick={handleDeleteProject}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🗑️ 프로젝트 삭제
            </button>
          </div>

          {/* Project Info */}
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

          {/* Video Player */}
          <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: 'white',
            marginBottom: '20px'
          }}>
            <h3 style={{ marginTop: 0 }}>🎬 비디오 플레이어</h3>
            {loadingVideo ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                비디오 로딩 중...
              </div>
            ) : videoUrl ? (
              <video
                src={videoUrl}
                controls
                style={{
                  width: '100%',
                  maxHeight: '500px',
                  borderRadius: '4px',
                  backgroundColor: '#000'
                }}
              />
            ) : (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                color: '#666'
              }}>
                비디오를 불러올 수 없습니다.
              </div>
            )}
          </div>

          {/* Translation Panel */}
          <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: 'white',
            marginBottom: '20px'
          }}>
            <h3 style={{ marginTop: 0 }}>🌐 번역</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
              <label style={{ fontWeight: 'bold' }}>대상 언어:</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                disabled={translating}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '14px'
                }}
              >
                <option value="en">영어 (English)</option>
                <option value="ko">한국어 (Korean)</option>
                <option value="ja">일본어 (Japanese)</option>
                <option value="zh">중국어 (Chinese)</option>
                <option value="es">스페인어 (Spanish)</option>
                <option value="fr">프랑스어 (French)</option>
                <option value="de">독일어 (German)</option>
              </select>
              <button
                onClick={handleTranslate}
                disabled={translating || transcript.length === 0}
                style={{
                  padding: '8px 16px',
                  backgroundColor: translating ? '#ccc' : '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: translating || transcript.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {translating ? '번역 중...' : '번역하기'}
              </button>
              {showTranslation && (
                <button
                  onClick={() => setShowTranslation(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  원문 보기
                </button>
              )}
            </div>
            {showTranslation && translatedCaptions.length > 0 && (
              <div style={{
                padding: '15px',
                backgroundColor: '#e7f3ff',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                <strong>✅ 번역된 자막이 아래에 표시됩니다</strong>
              </div>
            )}
          </div>

          {/* Export Panel */}
          <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: 'white',
            marginBottom: '20px'
          }}>
            <h3 style={{ marginTop: 0 }}>📥 내보내기</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleExport('srt')}
                disabled={transcript.length === 0}
                style={{
                  padding: '10px 20px',
                  backgroundColor: transcript.length === 0 ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: transcript.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                SRT 다운로드
              </button>
              <button
                onClick={() => handleExport('vtt')}
                disabled={transcript.length === 0}
                style={{
                  padding: '10px 20px',
                  backgroundColor: transcript.length === 0 ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: transcript.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                VTT 다운로드
              </button>
              <button
                onClick={() => handleExport('premiere')}
                disabled={transcript.length === 0}
                style={{
                  padding: '10px 20px',
                  backgroundColor: transcript.length === 0 ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: transcript.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                Premiere XML
              </button>
              <button
                onClick={() => handleExport('fcpx')}
                disabled={transcript.length === 0}
                style={{
                  padding: '10px 20px',
                  backgroundColor: transcript.length === 0 ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: transcript.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                FCPX XML
              </button>
            </div>
          </div>

          {/* Transcript Editor */}
          <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: 'white'
          }}>
            <h3 style={{ marginTop: 0 }}>📝 자막 편집기</h3>

            {loadingTranscript ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                로딩 중...
              </div>
            ) : (showTranslation ? translatedCaptions : transcript).length === 0 ? (
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
                {(showTranslation ? translatedCaptions : transcript).map((item, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '10px',
                      marginBottom: '5px',
                      backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
                      borderRadius: '4px',
                      fontSize: '14px',
                      border: editingIndex === index ? '2px solid #007bff' : 'none'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '5px',
                      alignItems: 'center'
                    }}>
                      <span style={{ color: '#007bff', fontWeight: 'bold' }}>
                        #{index + 1}
                      </span>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ color: '#666', fontSize: '12px' }}>
                          {item.start ? `${item.start.toFixed(2)}s` : '0.00s'} - {item.end ? `${item.end.toFixed(2)}s` : '0.00s'}
                        </span>
                        {!showTranslation && editingIndex !== index && (
                          <button
                            onClick={() => handleEditStart(index, item.text || '')}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            ✏️ 수정
                          </button>
                        )}
                      </div>
                    </div>

                    {editingIndex === index ? (
                      <div>
                        <textarea
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '14px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            marginBottom: '8px',
                            fontFamily: 'inherit',
                            minHeight: '60px'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={handleEditSave}
                            disabled={saving}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: saving ? '#ccc' : '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {saving ? '저장 중...' : '✅ 저장'}
                          </button>
                          <button
                            onClick={handleEditCancel}
                            disabled={saving}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ❌ 취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#333' }}>
                        {item.text || '(텍스트 없음)'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
