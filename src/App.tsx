import { useState } from 'react'
import { register, login, getProjects } from './apiClient'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [message, setMessage] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    try {
      if (isLogin) {
        const response = await login(email, password)
        setMessage(`로그인 성공! 환영합니다, ${response.user.name}님`)
        setIsLoggedIn(true)
      } else {
        const response = await register(email, password, name)
        setMessage(`회원가입 성공! 환영합니다, ${response.user.name}님`)
        setIsLoggedIn(true)
      }
    } catch (error: any) {
      setMessage(`오류: ${error.response?.data?.detail || error.message}`)
    }
  }

  const handleGetProjects = async () => {
    try {
      const projects = await getProjects()
      setMessage(`프로젝트 ${projects.length}개를 가져왔습니다.`)
      console.log('Projects:', projects)
    } catch (error: any) {
      setMessage(`오류: ${error.response?.data?.detail || error.message}`)
    }
  }

  return (
    <div style={{
      maxWidth: '600px',
      margin: '50px auto',
      padding: '20px',
      fontFamily: 'sans-serif'
    }}>
      <h1>🎬 BobPT - AI Video Editor</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        전체 기능 활성화 테스트 (GCS, Firestore, Translation, OCR)
      </p>

      {!isLoggedIn ? (
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
      ) : (
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2>✅ 로그인 완료</h2>
          <p>이제 API 테스트를 시작할 수 있습니다!</p>
          <button
            onClick={handleGetProjects}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            프로젝트 목록 가져오기
          </button>
          <button
            onClick={() => {
              setIsLoggedIn(false)
              setMessage('')
            }}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            로그아웃
          </button>
        </div>
      )}

      {message && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: message.includes('오류') ? '#f8d7da' : '#d4edda',
          color: message.includes('오류') ? '#721c24' : '#155724',
          borderRadius: '4px',
          border: `1px solid ${message.includes('오류') ? '#f5c6cb' : '#c3e6cb'}`
        }}>
          {message}
        </div>
      )}

      <div style={{
        marginTop: '30px',
        padding: '15px',
        backgroundColor: '#e7f3ff',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <h3 style={{ marginTop: 0 }}>🔧 백엔드 연결 상태</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>백엔드 URL: <code>http://localhost:8000</code></li>
          <li>인증: JWT 토큰 기반</li>
          <li>GCS: 활성화</li>
          <li>Firestore: 활성화</li>
          <li>Translation: 활성화</li>
          <li>Vision (OCR): 활성화</li>
        </ul>
      </div>
    </div>
  )
}

export default App
