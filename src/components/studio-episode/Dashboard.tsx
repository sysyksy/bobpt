
import React, { useState, useEffect } from 'react';
import { Project, User } from '../../types/studio-episode';
import { Video, Youtube, Globe, Type, Image, Scissors, Upload, Star, ArrowRight, RefreshCw } from 'lucide-react';
import Logo from './Logo';
import { getProjects } from '../../apiClient';

interface DashboardProps {
  onNewProject: (type: 'UPLOAD' | 'YOUTUBE') => void;
  onOpenProject?: (projectId: string) => void;
  user: User | null;
}

const Dashboard: React.FC<DashboardProps> = ({ onNewProject, onOpenProject, user }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const bobptProjects = await getProjects();
      // BobPT 프로젝트 형식을 Studio Episode 형식으로 변환
      const convertedProjects: Project[] = bobptProjects.map((p: any) => ({
        id: p.projectId || p.id,
        userId: user?.id || '1',
        name: p.fileName || 'Untitled Project',
        lastModified: p.created_at ? new Date(p.created_at) : new Date(),
        durationString: '', // BobPT에는 duration 정보가 없을 수 있음
        type: p.source === 'youtube' ? 'YOUTUBE' : 'UPLOAD',
        thumbnailUrl: undefined
      }));
      setProjects(convertedProjects);
    } catch (error) {
      console.error("프로젝트 로딩 실패:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };
  
  const ActionCard = ({ icon: Icon, title, description, onClick, colorClass }: any) => (
    <button 
      onClick={onClick}
      className="flex flex-col items-start p-6 bg-gray-900 border border-gray-800 rounded-2xl hover:border-episode-500/50 hover:bg-gray-800 transition-all text-left group h-full relative overflow-hidden"
    >
      <div className={`absolute top-0 right-0 p-20 bg-gradient-to-br ${colorClass} to-transparent opacity-0 group-hover:opacity-5 transition-opacity rounded-bl-full pointer-events-none`}></div>
      <div className={`p-3 rounded-xl mb-4 bg-gray-800 group-hover:bg-episode-500/10 transition-colors`}>
        <Icon className={`w-6 h-6 text-gray-400 group-hover:text-episode-500 transition-colors`} />
      </div>
      <h3 className="text-lg font-bold text-gray-200 mb-1 group-hover:text-white">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </button>
  );

  return (
    <div className="flex-1 bg-gray-950 p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Branding Hero Section */}
        <div className="relative overflow-visible rounded-3xl bg-gray-900 border border-gray-800 mt-8 group">
          {/* Backlights adjusted for Black Logo visibility */}
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-72 h-72 bg-episode-600/20 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 p-10 md:p-16 flex flex-col md:flex-row items-center gap-12">
             <div className="flex-shrink-0 transform transition-transform duration-500 pl-4 drop-shadow-2xl">
                <Logo size={180} variant="mark" is3D={true} />
             </div>
             <div className="text-center md:text-left space-y-6">
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                  Welcome back, <span className="text-episode-500">{user?.name || 'Creator'}</span>.
                </h1>
                <p className="text-xl text-gray-400 max-w-xl leading-relaxed">
                  Studio Episode gives you the power of AI-driven editing. 
                  Your workflow, redefined in <span className="text-white font-semibold">Obsidian</span> & <span className="text-episode-500 font-semibold">Orange</span>.
                </p>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start pt-2">
                  <button 
                    onClick={() => onNewProject('UPLOAD')}
                    className="px-8 py-3 bg-episode-500 hover:bg-episode-600 text-white font-bold rounded-full shadow-lg shadow-episode-600/30 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    Start New Project <ArrowRight className="w-5 h-5" />
                  </button>
                  <button className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-full border border-gray-700 transition-all">
                    Watch Tutorial
                  </button>
                </div>
             </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Star className="w-5 h-5 text-episode-500 fill-current" />
                Studio Tools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <ActionCard 
                icon={Upload}
                title="Video to STT"
                description="Upload video, analyze speech, and generate accurate subtitles."
                colorClass="from-episode-500"
                onClick={() => onNewProject('UPLOAD')}
            />
            <ActionCard 
                icon={Globe}
                title="AI Translation"
                description="Auto-translate your video into multiple languages instantly."
                colorClass="from-green-500"
                onClick={() => onNewProject('UPLOAD')}
            />
            <ActionCard 
                icon={Type}
                title="Fix Subtitles"
                description="Paste a YouTube link to extract & fix hardcoded captions."
                colorClass="from-yellow-500"
                onClick={() => onNewProject('YOUTUBE')}
            />
            <ActionCard 
                icon={Image}
                title="Auto Thumbnail"
                description="Generate high-CTR thumbnails from your video content."
                colorClass="from-purple-500"
                onClick={() => onNewProject('UPLOAD')}
            />
            <ActionCard 
                icon={Scissors}
                title="Shorts Maker"
                description="Extract viral highlights and crop for vertical viewing."
                colorClass="from-pink-500"
                onClick={() => onNewProject('UPLOAD')}
            />
            </div>
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Recent Projects</h2>
            <button 
              onClick={loadProjects}
              className="flex items-center gap-2 text-sm text-episode-500 hover:text-episode-400 font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
          
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>프로젝트 로딩 중...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>아직 프로젝트가 없습니다.</p>
              <p className="text-sm mt-2">새 프로젝트를 시작하세요.</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div 
                  key={project.id} 
                  onClick={() => onOpenProject?.(project.id)}
                  className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden hover:border-episode-500/50 transition-all cursor-pointer group shadow-lg hover:shadow-episode-900/10"
                >
                <div className="h-32 bg-gray-800 relative flex items-center justify-center group-hover:bg-gray-800/80 transition-colors">
                   {project.type === 'YOUTUBE' ? <Youtube className="w-10 h-10 text-red-500" /> : <Video className="w-10 h-10 text-gray-600 group-hover:text-episode-500 transition-colors" />}
                     {project.durationString && (
                   <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-xs font-mono rounded text-white">{project.durationString}</span>
                     )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-200 line-clamp-1 group-hover:text-episode-500 transition-colors">{project.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                    <span>{project.lastModified.toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{project.type === 'YOUTUBE' ? 'YouTube Import' : 'Local File'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
