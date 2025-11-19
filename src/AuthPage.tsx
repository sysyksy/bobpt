import { useState } from 'react';
import { login, register, logout, getCurrentUser, isAuthenticated } from './apiClient';
import './AuthPage.css';

type AuthMode = 'login' | 'register' | 'loggedin';

interface AuthPageProps {
  onAuthSuccess?: () => void;
  onLogout?: () => void;
}

export default function AuthPage({ onAuthSuccess, onLogout }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(isAuthenticated() ? 'loggedin' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const currentUser = getCurrentUser();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      setMode('loggedin');
      onAuthSuccess?.();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || '로그인에 실패했습니다';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await register(email, password, name);
      setMode('loggedin');
      onAuthSuccess?.();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || '회원가입에 실패했습니다';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setMode('login');
    setEmail('');
    setPassword('');
    setName('');
    onLogout?.();
  };

  if (mode === 'loggedin') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="loggedin-section">
            <div className="user-info">
              <h2>👤 로그인됨</h2>
              <p className="user-name">{currentUser?.name}</p>
              <p className="user-email">{currentUser?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="logout-button"
            >
              🚪 로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-form-wrapper">
          <div className="auth-header">
            <h1>🔐 BobPT 인증</h1>
            {mode === 'login' && (
              <p className="auth-subtitle">로그인하여 시작하세요</p>
            )}
            {mode === 'register' && (
              <p className="auth-subtitle">새 계정을 만들기</p>
            )}
          </div>

          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="name">이름</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="최소 8자 이상"
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="submit-button"
            >
              {isLoading ? '처리 중...' : (mode === 'login' ? '로그인' : '회원가입')}
            </button>
          </form>

          <div className="auth-toggle">
            {mode === 'login' ? (
              <p>
                계정이 없으신가요?{' '}
                <button
                  onClick={() => setMode('register')}
                  className="link-button"
                >
                  회원가입하기
                </button>
              </p>
            ) : (
              <p>
                이미 계정이 있으신가요?{' '}
                <button
                  onClick={() => setMode('login')}
                  className="link-button"
                >
                  로그인하기
              </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
