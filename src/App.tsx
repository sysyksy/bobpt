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
  const [uploadMode, setUploadMode] = useState<'file' | 'youtube'>('file')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingProgress, setProcessingProgress] = useState(0)
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
      } else {
        // No state found - default based on login status
        const token = localStorage.getItem('bobpt_auth_token')
        const defaultView = token ? 'projects' : 'auth'
        setCurrentView(defaultView)
        setSelectedProject(null)
        setTranscript([])
        setTranslatedCaptions([])
        setShowTranslation(false)
        setVideoUrl(null)

        // Update history state
        window.history.replaceState({ view: defaultView }, '', `#${defaultView}`)
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
    setUploadProgress(0)
    setProcessingProgress(0)
    setMessage('업로드 준비 중...')

    try {
      // 1. Get upload URL from backend
      const { projectId, uploadUrl } = await getUploadUrl(selectedFile.name)
      setMessage(`프로젝트 생성됨: ${projectId}. 업로드 시작...`)

      // 2. Upload file to GCS with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(percentComplete)
            setMessage(`업로드 중... ${percentComplete}%`)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100)
            resolve()
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed: Network error'))
        })

        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', selectedFile.type || 'video/mp4')
        xhr.send(selectedFile)
      })

      setMessage(`✅ 업로드 완료! 프로젝트 ID: ${projectId}. STT 처리 시작...`)

      // 3. Reload projects
      await loadProjects()

      // 4. Poll for transcript
      pollTranscript(projectId)

      setSelectedFile(null)
      navigateToView('projects')
    } catch (error: any) {
      setMessage(`업로드 실패: ${error.message}`)
      setUploadProgress(0)
      setProcessingProgress(0)
    } finally {
      setUploading(false)
    }
  }

  const pollTranscript = async (projectId: string, attempts = 0) => {
    if (attempts > 20) {
      setMessage(`⚠️ 처리 시간이 너무 오래 걸립니다. 프로젝트 목록에서 확인하세요.`)
      setProcessingProgress(0)
      return
    }

    // Calculate processing progress (0-100%)
    const progress = Math.min(Math.round((attempts / 20) * 100), 95)
    setProcessingProgress(progress)

    try {
      const transcript = await getTranscript(projectId)
      if (transcript.status === 'completed') {
        setProcessingProgress(100)
        setMessage(`🎉 STT 완료! ${transcript.word_count}개 단어 인식됨.`)
        loadProjects()
      } else if (transcript.isProcessing) {
        setMessage(`STT 처리 중... ${progress}% (${attempts + 1}/20)`)
        setTimeout(() => pollTranscript(projectId, attempts + 1), 5000)
      }
    } catch (error: any) {
      if (error.response?.status === 202) {
        // Still processing
        setMessage(`STT 처리 중... ${progress}% (${attempts + 1}/20)`)
        setTimeout(() => pollTranscript(projectId, attempts + 1), 5000)
      } else {
        setMessage(`처리 확인 실패: ${error.message}`)
        setProcessingProgress(0)
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

  const handleDeleteProject = async (projectId?: string) => {
    const targetProject = projectId
      ? projects.find(p => p.projectId === projectId)
      : selectedProject

    if (!targetProject) return

    const confirmed = window.confirm(
      `"${targetProject.fileName}" 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    )

    if (!confirmed) return

    try {
      setMessage('프로젝트 삭제 중...')
      await deleteProject(targetProject.projectId)
      setMessage(`✅ 프로젝트가 삭제되었습니다.`)

      // If we deleted the currently selected project, navigate back
      if (!projectId || selectedProject?.projectId === targetProject.projectId) {
        navigateToView('projects')
        setSelectedProject(null)
        setTranscript([])
      }

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

      {/* Projects View - BOBPT Hub Design */}
      {isLoggedIn && currentView === 'projects' && (
        <div className="min-h-screen bg-[#0a0a0a]">
          {/* Header */}
          <header className="px-8 py-6 border-b border-gray-800">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold">
                  <span className="gradient-text">BOBPT Hub</span>
                </h1>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={loadProjects}
                  className="btn-ghost"
                >
                  🔄 새로고침
                </button>
                <button
                  onClick={() => navigateToView('upload')}
                  className="btn-primary"
                >
                  ➕ 새 프로젝트
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">내 프로젝트</h2>
              <p className="text-gray-400">AI 비디오 자막 프로젝트 관리</p>
            </div>

            {/* Project Grid */}
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-6">
                  <span className="text-5xl">📹</span>
                </div>
                <h3 className="text-xl font-medium text-white mb-2">아직 프로젝트가 없습니다</h3>
                <p className="text-gray-400 mb-6">비디오를 업로드하여 AI 자막 생성을 시작하세요</p>
                <button
                  onClick={() => navigateToView('upload')}
                  className="btn-primary"
                >
                  첫 프로젝트 시작하기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <div
                    key={project.projectId}
                    onClick={() => handleOpenProject(project)}
                    className="card-hover cursor-pointer group"
                  >
                    {/* Thumbnail Placeholder */}
                    <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-t-lg overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-6xl opacity-50">🎬</span>
                      </div>

                      {/* Status Badge - Top Right */}
                      <div className="absolute top-3 right-3">
                        {project.status === 'transcribed' ? (
                          <span className="badge-green">완료</span>
                        ) : project.status === 'processing' ? (
                          <span className="badge-yellow">처리중</span>
                        ) : project.status === 'uploading' ? (
                          <span className="badge-blue">업로드중</span>
                        ) : (
                          <span className="badge-red">대기중</span>
                        )}
                      </div>

                      {/* Processing Progress Bar */}
                      {(project.status === 'processing' || project.status === 'uploading') && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900">
                          <div className="h-full progress-bar animate-pulse" style={{ width: '60%' }} />
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-4">
                      <h3 className="text-white font-medium mb-2 truncate">{project.fileName}</h3>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <span>🕐</span>
                          <span>{new Date(project.created_at).toLocaleDateString('ko-KR')}</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProject(project.projectId)
                          }}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      )}

      {/* Upload View - BOBPT Hub Design */}
      {isLoggedIn && currentView === 'upload' && (
        <div className="min-h-screen bg-[#0a0a0a]">
          {/* Header */}
          <header className="px-8 py-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold gradient-text">새 프로젝트 업로드</h1>
              <button onClick={goBack} className="btn-ghost">
                ← 뒤로가기
              </button>
            </div>
          </header>

          {/* Main Content */}
          <main className="p-8 max-w-4xl mx-auto">
            {/* Upload Mode Selector */}
            <div className="flex gap-4 mb-8 justify-center">
              <button
                onClick={() => setUploadMode('file')}
                className={`px-8 py-3 rounded-lg font-medium transition-all ${
                  uploadMode === 'file'
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
                disabled={uploading}
              >
                💾 비디오 파일 업로드
              </button>
              <button
                onClick={() => setUploadMode('youtube')}
                className={`px-8 py-3 rounded-lg font-medium transition-all ${
                  uploadMode === 'youtube'
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
                disabled={uploading}
              >
                🔗 YouTube 링크
              </button>
            </div>

            {/* File Upload Mode */}
            {uploadMode === 'file' && (
              <div className="mb-8">
                <label className={`
                  block p-12 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all
                  ${selectedFile
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-600 bg-gray-800/50 hover:border-blue-500 hover:bg-blue-500/10'
                  }
                  ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="animate-scale-in">
                      <div className="text-6xl mb-4">✅</div>
                      <div className="text-xl font-bold text-white mb-2">{selectedFile.name}</div>
                      <div className="text-gray-400">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                      {!uploading && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            setSelectedFile(null)
                          }}
                          className="mt-4 text-red-400 hover:text-red-300 text-sm"
                        >
                          파일 제거
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-6xl mb-4">📁</div>
                      <div className="text-xl text-gray-300 mb-2">
                        클릭하여 비디오 파일 선택
                      </div>
                      <div className="text-sm text-gray-500">
                        MP4, AVI, MOV, MKV 등 지원 • 최대 500MB
                      </div>
                    </div>
                  )}
                </label>
              </div>
            )}

            {/* YouTube URL Mode */}
            {uploadMode === 'youtube' && (
              <div className="mb-8">
                <div className="card p-8">
                  <div className="text-center mb-6">
                    <div className="text-6xl mb-4">🎬</div>
                    <h3 className="text-xl font-bold text-white mb-2">YouTube 영상 분석</h3>
                    <p className="text-gray-400">YouTube URL을 입력하면 자동으로 다운로드하여 처리합니다</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        YouTube URL
                      </label>
                      <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        disabled={uploading}
                        className="input w-full"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        💡 팁: YouTube 영상 페이지의 전체 URL을 복사하여 붙여넣으세요
                      </p>
                    </div>

                    {youtubeUrl && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 animate-fade-in">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">✅</span>
                          <div className="flex-1">
                            <div className="font-medium text-green-400 mb-1">URL이 입력되었습니다</div>
                            <div className="text-sm text-gray-400 break-all">{youtubeUrl}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleUpload}
                disabled={
                  uploading ||
                  (uploadMode === 'file' && !selectedFile) ||
                  (uploadMode === 'youtube' && !youtubeUrl.trim())
                }
                className={`flex-1 py-4 rounded-lg font-medium transition-all ${
                  (uploadMode === 'file' && selectedFile) || (uploadMode === 'youtube' && youtubeUrl.trim())
                    ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="spinner"></span>
                    처리 중...
                  </span>
                ) : (
                  `🚀 ${uploadMode === 'youtube' ? 'YouTube 다운로드 및 분석 시작' : '업로드 및 분석 시작'}`
                )}
              </button>
              <button
                onClick={goBack}
                disabled={uploading}
                className="btn-secondary px-8"
              >
                취소
              </button>
            </div>

            {/* Upload Progress Bar */}
            {uploading && uploadProgress > 0 && (
              <div className="mt-8 animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-300">
                    {uploadMode === 'youtube' ? 'YouTube 다운로드 중' : '파일 업로드 중'}
                  </span>
                  <span className="text-sm font-bold text-blue-400">{uploadProgress}%</span>
                </div>
                <div className="w-full h-6 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                  <div
                    className={`h-full progress-bar transition-all duration-300 ease-out flex items-center justify-center ${
                      uploadProgress === 100 ? 'bg-green-500' : ''
                    }`}
                    style={{ width: `${uploadProgress}%` }}
                  >
                    {uploadProgress > 10 && (
                      <span className="text-xs font-bold text-white">{uploadProgress}%</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Processing Progress Bar */}
            {processingProgress > 0 && (
              <div className="mt-6 animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-300">
                    🎤 STT 처리 중 (Whisper AI)
                  </span>
                  <span className="text-sm font-bold text-purple-400">{processingProgress}%</span>
                </div>
                <div className="w-full h-6 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                  <div
                    className="h-full progress-bar transition-all duration-300 ease-out flex items-center justify-center"
                    style={{ width: `${processingProgress}%` }}
                  >
                    {processingProgress > 10 && (
                      <span className="text-xs font-bold text-white">{processingProgress}%</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Status Message */}
            {message && (
              <div className={`mt-6 p-4 rounded-lg animate-fade-in ${
                message.includes('✅') || message.includes('완료')
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : message.includes('❌') || message.includes('실패')
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                  : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
              }`}>
                {message}
              </div>
            )}
          </main>
        </div>
      )}

      {/* Keep old progress bars for other views temporarily */}
      {currentView !== 'upload' && processingProgress > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '5px',
            fontSize: '14px',
            color: '#666'
          }}>
            <span>STT 처리 중</span>
            <span>{processingProgress}%</span>
          </div>
          <div style={{
            width: '100%',
            height: '24px',
            backgroundColor: '#e9ecef',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #dee2e6'
              }}>
                <div style={{
                  width: `${processingProgress}%`,
                  height: '100%',
                  backgroundColor: processingProgress === 100 ? '#28a745' : '#ffc107',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: processingProgress === 100 ? 'white' : '#000',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {processingProgress > 10 && `${processingProgress}%`}
                </div>
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
              onClick={() => handleDeleteProject()}
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
