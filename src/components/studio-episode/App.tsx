import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import Editor from './Editor';
import Login from './Login';
import { AppView, User } from '../../types/studio-episode';
import { authService } from '../../services/studio-episode/authService';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);
  const [editorMode, setEditorMode] = useState<'UPLOAD' | 'YOUTUBE'>('UPLOAD');
  const [user, setUser] = useState<User | null>(null);
  
  // In a real app, this would hold the active project ID
  const [activeProjectVideo, setActiveProjectVideo] = useState<File | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Check for existing session on load
  useEffect(() => {
    const sessionUser = authService.getCurrentUser();
    if (sessionUser) {
      setUser(sessionUser);
      setCurrentView(AppView.DASHBOARD);
    }
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentView(AppView.DASHBOARD);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setCurrentView(AppView.LOGIN);
  };

  const handleNewProject = (mode: 'UPLOAD' | 'YOUTUBE') => {
    setActiveProjectVideo(null);
    setActiveProjectId(null);
    setEditorMode(mode);
    setCurrentView(AppView.EDITOR);
  };

  const handleOpenProject = (projectId: string) => {
    // 프로젝트를 열 때는 Editor로 이동
    setActiveProjectId(projectId);
    setActiveProjectVideo(null);
    setEditorMode('UPLOAD'); // 기존 프로젝트는 UPLOAD 모드
    setCurrentView(AppView.EDITOR);
  };

  // If in Login view, render full screen login without sidebar
  if (currentView === AppView.LOGIN || !user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950 text-white selection:bg-blue-500/30">
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        user={user}
        onLogout={handleLogout}
      />
      
      <main className="flex-1 h-full overflow-hidden flex flex-col">
        {currentView === AppView.DASHBOARD && (
          <Dashboard onNewProject={handleNewProject} onOpenProject={handleOpenProject} user={user} />
        )}
        
        {currentView === AppView.EDITOR && (
          <Editor 
            initialVideo={activeProjectVideo} 
            initialMode={editorMode}
            projectId={activeProjectId}
          />
        )}
      </main>
    </div>
  );
};

export default App;

