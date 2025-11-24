// BOBPT Hub - React Component Examples
// 투머치 김호영 YouTube 자막 관리 시스템

// ============================================
// 1. PROJECT DASHBOARD COMPONENT
// ============================================

import React, { useState, useEffect } from 'react';
import { Search, Plus, Clock, PlayCircle, MoreVertical } from 'lucide-react';

// Main Dashboard Component
export const ProjectDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="px-8 py-6 border-b border-gray-800">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                BOBPT Hub
              </span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <SearchBar 
              placeholder="프로젝트 검색..." 
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
              <Plus className="w-5 h-5" />
              <span>새 프로젝트</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - AI Tools */}
        <AIToolsSidebar />
        
        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">내 프로젝트</h2>
            <p className="text-gray-400">투머치 김호영 에피소드 관리</p>
          </div>

          {/* Project Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} {...project} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

// Project Card Component
const ProjectCard = ({ 
  id, 
  thumbnail, 
  title, 
  duration, 
  editedTime, 
  progress,
  status 
}) => {
  return (
    <div className="bg-[#1a1a1a] rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer group">
      <div className="relative aspect-video">
        <img 
          src={thumbnail} 
          alt={title}
          className="w-full h-full object-cover"
        />
        
        {/* Duration Badge */}
        <span className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-sm text-white">
          {duration}
        </span>
        
        {/* Progress Indicator */}
        {progress && progress < 100 && (
          <div className="absolute top-2 right-2">
            <CircularProgress value={progress} />
          </div>
        )}
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <PlayCircle className="w-16 h-16 text-white/80" />
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="text-white font-medium mb-2 truncate">{title}</h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>편집 {editedTime}</span>
          </div>
          
          <StatusBadge status={status} />
        </div>
      </div>
    </div>
  );
};

// ============================================
// 2. AI TRANSLATION COMPONENT
// ============================================

export const AITranslation = () => {
  const [uploadMode, setUploadMode] = useState('file');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [options, setOptions] = useState({
    generateSubtitles: true,
    aiDubbing: false,
    exportSRT: true
  });

  const handleFileDrop = (files) => {
    if (files && files[0]) {
      setUploadedFile(files[0]);
    }
  };

  const handleStartTranslation = async () => {
    // API call to start translation
    console.log('Starting translation...');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">AI 영상 번역</h1>
          <p className="text-gray-400">
            영상의 음성을 자동으로 인식하고 다국어로 번역합니다
          </p>
        </div>

        {/* Upload Mode Selector */}
        <div className="flex gap-4 mb-6 justify-center">
          <button
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              uploadMode === 'file' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            onClick={() => setUploadMode('file')}
          >
            💾 영상 업로드
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              uploadMode === 'youtube' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            onClick={() => setUploadMode('youtube')}
          >
            🔗 유튜브 링크
          </button>
        </div>

        {/* Upload Area */}
        {uploadMode === 'file' ? (
          <FileDropZone 
            onDrop={handleFileDrop}
            file={uploadedFile}
          />
        ) : (
          <YouTubeURLInput />
        )}

        {/* Translation Settings */}
        <TranslationSettings
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          onSourceChange={setSourceLanguage}
          onTargetChange={setTargetLanguage}
          options={options}
          onOptionsChange={setOptions}
        />

        {/* Start Button */}
        <button
          onClick={handleStartTranslation}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span>🚀</span>
          <span>번역 시작</span>
        </button>
      </div>
    </div>
  );
};

// ============================================
// 3. SUBTITLE EDITOR COMPONENT
// ============================================

export const SubtitleEditor = () => {
  const [subtitles, setSubtitles] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSubtitle, setSelectedSubtitle] = useState(null);

  return (
    <div className="h-screen bg-[#0a0a0a] flex">
      {/* Left: Video Player */}
      <div className="flex-1 flex flex-col">
        <VideoPlayer
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTimeUpdate={setCurrentTime}
          onPlayPause={() => setIsPlaying(!isPlaying)}
        />
        
        {/* Playback Controls */}
        <div className="bg-[#1a1a1a] p-4">
          <PlaybackControls
            currentTime={currentTime}
            duration={36.5}
            isPlaying={isPlaying}
            onPlayPause={() => setIsPlaying(!isPlaying)}
            onSeek={setCurrentTime}
          />
        </div>
      </div>

      {/* Right: Subtitle List */}
      <div className="w-[500px] bg-[#0f0f0f] border-l border-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-medium">
              자막 목록 ({subtitles.length}개)
            </h3>
            <button className="text-blue-400 hover:text-blue-300">
              + 추가
            </button>
          </div>
          
          {/* Statistics */}
          <div className="flex gap-4 text-sm">
            <span className="text-orange-400">{subtitles.length} 총 자막</span>
            <span className="text-yellow-400">00:36 영상 길이</span>
          </div>
        </div>

        {/* Subtitle List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {subtitles.map((subtitle, index) => (
            <SubtitleCard
              key={subtitle.id}
              index={index + 1}
              subtitle={subtitle}
              isActive={subtitle.id === selectedSubtitle?.id}
              isPlaying={
                currentTime >= subtitle.startTime && 
                currentTime <= subtitle.endTime
              }
              onSelect={() => setSelectedSubtitle(subtitle)}
            />
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-800">
          <button className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition-colors">
            ✓ 번역기로 이동
          </button>
        </div>
      </div>
    </div>
  );
};

// Subtitle Card Component
const SubtitleCard = ({ 
  index, 
  subtitle,
  isActive,
  isPlaying,
  onSelect,
  onEdit,
  onDelete 
}) => {
  const { startTime, endTime, originalText, translatedText } = subtitle;
  
  return (
    <div 
      className={`
        bg-[#1a1a1a] rounded-lg p-4 border-2 transition-all cursor-pointer
        ${isActive ? 'border-orange-500' : 'border-transparent'}
        ${isPlaying ? 'ring-2 ring-blue-500/50' : ''}
      `}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-sm">#{index}</span>
          <div className="text-sm">
            <span className="text-gray-400">
              {formatTime(startTime)}
            </span>
            <span className="text-gray-600 mx-2">→</span>
            <span className="text-gray-400">
              {formatTime(endTime)}
            </span>
          </div>
        </div>
        
        <div className="flex gap-1">
          <IconButton icon="✏️" onClick={onEdit} />
          <IconButton icon="🗑️" onClick={onDelete} />
          <IconButton icon="▶️" />
        </div>
      </div>
      
      <div className="space-y-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">원본 텍스트</p>
          <p className="text-white">{originalText}</p>
        </div>
        {translatedText && (
          <div>
            <p className="text-xs text-gray-500 mb-1">번역 텍스트</p>
            <p className="text-gray-300">{translatedText}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// 4. SHARED COMPONENTS
// ============================================

// Search Bar Component
const SearchBar = ({ placeholder, value, onChange }) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-4 py-2 bg-gray-800 text-white rounded-lg w-80 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  );
};

// AI Tools Sidebar
const AIToolsSidebar = () => {
  const tools = [
    { id: 1, icon: '🎬', name: 'AI B-Roll Finder', active: false },
    { id: 2, icon: '✂️', name: 'Auto Cut Silence', active: false },
    { id: 3, icon: '🎵', name: 'AI Music Suggestion', active: false },
    { id: 4, icon: '📝', name: 'Script Generator', active: false },
    { id: 5, icon: '🌐', name: 'AI Translate', active: true }
  ];

  return (
    <aside className="w-64 bg-[#0f0f0f] p-4 border-r border-gray-800">
      <h3 className="text-sm text-gray-400 mb-4 uppercase tracking-wide">
        AI Assistant Tools
      </h3>
      <nav className="space-y-2">
        {tools.map(tool => (
          <button
            key={tool.id}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left
              ${tool.active 
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                : 'text-gray-300 hover:bg-gray-800'
              }
            `}
          >
            <span className="text-xl">{tool.icon}</span>
            <span className="text-sm font-medium">{tool.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

// Circular Progress Component
const CircularProgress = ({ value, size = 40 }) => {
  const circumference = 2 * Math.PI * 15;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={15}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="3"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={15}
          stroke="#3B82F6"
          strokeWidth="3"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs text-white font-medium">{value}%</span>
      </div>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    processing: { color: 'bg-yellow-500', text: '처리중' },
    completed: { color: 'bg-green-500', text: '완료' },
    error: { color: 'bg-red-500', text: '오류' },
    pending: { color: 'bg-gray-500', text: '대기중' }
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-gray-400">{config.text}</span>
    </div>
  );
};

// File Drop Zone Component
const FileDropZone = ({ onDrop, file }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    onDrop(files);
  };

  return (
    <div
      className={`
        border-2 border-dashed rounded-lg p-12 transition-all
        ${isDragging 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-green-500/50 bg-green-500/10'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {file ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✓</span>
          </div>
          <p className="text-white font-medium">{file.name}</p>
          <p className="text-gray-400 text-sm">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <button className="mt-2 text-red-400 hover:text-red-300 text-sm">
            파일 제거
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📁</span>
          </div>
          <p className="text-gray-300 mb-2">
            파일을 드래그하거나 클릭하여 업로드
          </p>
          <p className="text-gray-500 text-sm">
            최대 500MB, MP4/MOV/AVI 지원
          </p>
        </div>
      )}
    </div>
  );
};

// Translation Settings Component
const TranslationSettings = ({ 
  sourceLanguage, 
  targetLanguage, 
  onSourceChange, 
  onTargetChange,
  options,
  onOptionsChange
}) => {
  const languages = [
    { code: 'auto', name: '자동 감지' },
    { code: 'ko', name: '한국어' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
    { code: 'zh', name: '中文' },
    { code: 'es', name: 'Español' }
  ];

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-6 mb-8">
      <h3 className="text-white font-medium mb-4">번역 설정</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-gray-400 text-sm mb-2 block">원본 언어</label>
          <select 
            value={sourceLanguage}
            onChange={(e) => onSourceChange(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg"
          >
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="text-gray-400 text-sm mb-2 block">번역 언어</label>
          <select 
            value={targetLanguage}
            onChange={(e) => onTargetChange(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg"
          >
            {languages.filter(l => l.code !== 'auto').map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Additional Options */}
      <div className="space-y-3">
        <OptionToggle
          icon="📝"
          title="자막 생성"
          description="번역된 자막을 영상에 추가"
          checked={options.generateSubtitles}
          onChange={(checked) => 
            onOptionsChange({ ...options, generateSubtitles: checked })
          }
        />
        <OptionToggle
          icon="🎙️"
          title="AI 더빙"
          description="번역된 텍스트를 AI 음성으로 변환"
          checked={options.aiDubbing}
          onChange={(checked) => 
            onOptionsChange({ ...options, aiDubbing: checked })
          }
        />
        <OptionToggle
          icon="📊"
          title="SRT 파일 내보내기"
          description="자막 파일을 별도로 다운로드"
          checked={options.exportSRT}
          onChange={(checked) => 
            onOptionsChange({ ...options, exportSRT: checked })
          }
        />
      </div>
    </div>
  );
};

// Option Toggle Component
const OptionToggle = ({ icon, title, description, checked, onChange }) => {
  return (
    <div 
      className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors cursor-pointer"
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-white font-medium">{title}</p>
          <p className="text-gray-400 text-sm">{description}</p>
        </div>
      </div>
      
      <label className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className={`
          w-11 h-6 rounded-full transition-colors
          ${checked ? 'bg-blue-500' : 'bg-gray-600'}
        `}>
          <div className={`
            w-5 h-5 bg-white rounded-full shadow-lg transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `} />
        </div>
      </label>
    </div>
  );
};

// Utility Functions
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
};

// Export all components
export {
  SearchBar,
  AIToolsSidebar,
  CircularProgress,
  StatusBadge,
  FileDropZone,
  TranslationSettings,
  OptionToggle,
  SubtitleCard,
  formatTime,
  formatFileSize
};
