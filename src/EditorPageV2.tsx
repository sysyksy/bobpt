import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Settings, Download, Edit2, Check, X, Loader } from 'lucide-react';
import { getTranscript, updateTranscript, translateCaptions, exportProject } from './apiClient';

// ========== TYPE DEFINITIONS ==========
interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface EditorState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  captions: Caption[];
  editingId: string | null;
  editingText: string;
  selectedId: string | null;
}

interface EditorPageV2Props {
  projectId?: string;  // Optional: if provided, load captions from API
}

// ========== NEON FOCUS THEME COLORS ==========
const COLORS = {
  background: '#111111',
  surface: '#1C1C1C',
  surfaceHover: '#252525',
  primaryAccent: '#3B82F6', // Electric Blue
  secondaryAccent: '#D946EF', // Magenta
  textPrimary: '#F1F1F1',
  textSecondary: '#888888',
  textMuted: '#555555',
  border: '#2D2D2D',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

// ========== MOCK DATA ==========
const MOCK_CAPTIONS: Caption[] = [
  { id: '1', start: 0, end: 3.5, text: '안녕하세요 프로젝트 브루입니다' },
  { id: '2', start: 3.5, end: 7.2, text: '이것은 AI 비디오 에디터의 데모입니다' },
  { id: '3', start: 7.2, end: 10.8, text: '자막을 직접 편집할 수 있습니다' },
  { id: '4', start: 10.8, end: 14.5, text: '타임라인과 동기화됩니다' },
  { id: '5', start: 14.5, end: 18.0, text: '전문가 수준의 편집 기능을 제공합니다' },
];

// ========== HEADER COMPONENT ==========
interface HeaderProps {
  isSaving: boolean;
  error: string | null;
  onTranslate: (language: string) => void;
  onClearError: () => void;
  onSettingsClick: () => void;
  onExportClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ isSaving, error, onTranslate, onClearError, onSettingsClick, onExportClick }) => (
  <header
    style={{ backgroundColor: COLORS.surface, borderBottomColor: COLORS.border }}
    className="border-b sticky top-0 z-50"
  >
    <div className="flex items-center justify-between px-6 py-4">
      {/* Logo & Title */}
      <div className="flex items-center gap-3 flex-1">
        <div
          style={{ backgroundColor: COLORS.primaryAccent }}
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-black"
        >
          PB
        </div>
        <h1 style={{ color: COLORS.textPrimary }} className="text-xl font-bold">
          Project Brew Editor
        </h1>

        {/* Error Message */}
        {error && (
          <div
            style={{
              backgroundColor: COLORS.error,
              color: '#FFFFFF',
            }}
            className="ml-auto px-3 py-1 rounded text-sm flex items-center gap-2"
          >
            {error}
            <button
              onClick={onClearError}
              className="hover:opacity-75 transition"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onTranslate('ko')}
          disabled={isSaving}
          style={{
            backgroundColor: COLORS.surfaceHover,
            color: COLORS.textSecondary,
            borderColor: COLORS.border,
            opacity: isSaving ? 0.5 : 1,
          }}
          className="px-4 py-2 rounded-lg border hover:bg-opacity-80 transition text-sm font-medium flex items-center gap-2 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader size={16} className="animate-spin" /> : null}
          한국어 번역
        </button>
        <button
          onClick={() => onTranslate('en')}
          disabled={isSaving}
          style={{
            backgroundColor: COLORS.surfaceHover,
            color: COLORS.textSecondary,
            borderColor: COLORS.border,
            opacity: isSaving ? 0.5 : 1,
          }}
          className="px-4 py-2 rounded-lg border hover:bg-opacity-80 transition text-sm font-medium flex items-center gap-2 disabled:cursor-not-allowed"
        >
          {isSaving ? <Loader size={16} className="animate-spin" /> : null}
          English 번역
        </button>
        <button
          onClick={onExportClick}
          style={{
            backgroundColor: COLORS.primaryAccent,
            color: '#000000',
          }}
          className="px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition flex items-center gap-2"
        >
          <Download size={16} />
          내보내기
        </button>
        <button
          onClick={onSettingsClick}
          style={{ color: COLORS.textSecondary }}
          className="p-2 hover:bg-opacity-50 transition"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  </header>
);

// ========== VIDEO PLAYER COMPONENT ==========
interface VideoPlayerProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  videoUrl: string | null;
  onPlayPause: () => void;
  onTimeChange: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onDurationChange: (duration: number) => void;
  onCurrentTimeChange: (time: number) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  currentTime,
  duration,
  isPlaying,
  volume,
  videoUrl,
  onPlayPause,
  onTimeChange,
  onVolumeChange,
  onDurationChange,
  onCurrentTimeChange,
  videoRef,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sync play/pause state with video element
  useEffect(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.play().catch((e) => console.log('Playback prevented:', e));
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, videoRef]);

  // Sync volume with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
    }
  }, [volume, videoRef]);

  // Sync seeking with video element
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.1) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime, videoRef]);

  return (
    <div
      style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
      className="border rounded-xl overflow-hidden"
    >
      {/* Video Element */}
      {videoUrl ? (
        <video
          ref={videoRef}
          style={{ backgroundColor: '#000000' }}
          className="w-full aspect-video"
          onTimeUpdate={(e) => onCurrentTimeChange(e.currentTarget.currentTime)}
          onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
          onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
          onEnded={() => onPlayPause()}
          controls={false}
        >
          <source src={videoUrl} />
          Your browser does not support the video tag.
        </video>
      ) : (
        <div
          style={{ backgroundColor: '#000000' }}
          className="w-full aspect-video flex items-center justify-center"
        >
          <div style={{ color: COLORS.textMuted }} className="text-center">
            <div className="text-4xl mb-2">🎬</div>
            <p className="text-sm">비디오를 업로드하거나 URL을 입력하세요</p>
          </div>
        </div>
      )}

      {/* Player Controls */}
      <div style={{ borderTopColor: COLORS.border }} className="border-t p-4">
        {/* Progress Bar */}
        <div className="mb-4">
          <div
            style={{ backgroundColor: COLORS.surfaceHover, borderColor: COLORS.border }}
            className="w-full h-1 rounded-full border cursor-pointer relative group"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const newTime = (e.clientX - rect.left) / rect.width * duration;
              onTimeChange(newTime);
            }}
          >
            <div
              style={{
                width: `${(currentTime / duration) * 100}%`,
                backgroundColor: COLORS.primaryAccent,
              }}
              className="h-full rounded-full transition-all"
            />
          </div>
        </div>

        {/* Control Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause Button */}
            <button
              onClick={onPlayPause}
              style={{
                backgroundColor: COLORS.primaryAccent,
                color: '#000000',
              }}
              className="p-2 rounded-lg hover:opacity-90 transition"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
            </button>

            {/* Time Display */}
            <div style={{ color: COLORS.textSecondary }} className="text-sm font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <Volume2 size={18} style={{ color: COLORS.textSecondary }} />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => onVolumeChange(parseInt(e.target.value))}
              style={{
                accentColor: COLORS.primaryAccent,
              }}
              className="w-20 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== CAPTION BLOCK COMPONENT ==========
interface CaptionBlockProps {
  caption: Caption;
  isActive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  editingText: string;
  isDragging?: boolean;
  onSelect: (id: string) => void;
  onEditStart: (id: string, text: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: (id: string, text: string) => void;
  onEditCancel: () => void;
  onDragStart?: (id: string, e: React.DragEvent) => void;
  onDragOver?: (id: string, e: React.DragEvent) => void;
  onDrop?: (id: string, e: React.DragEvent) => void;
}

const CaptionBlock: React.FC<CaptionBlockProps> = ({
  caption,
  isActive,
  isSelected,
  isEditing,
  editingText,
  isDragging,
  onSelect,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  return (
    <div
      draggable
      onClick={() => onSelect(caption.id)}
      onDragStart={(e) => onDragStart?.(caption.id, e)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver?.(caption.id, e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(caption.id, e);
      }}
      style={{
        backgroundColor: isActive ? COLORS.surfaceHover : COLORS.surface,
        borderColor: isActive ? COLORS.primaryAccent : COLORS.border,
        borderLeftColor: isActive ? COLORS.primaryAccent : COLORS.secondaryAccent,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="border border-l-4 rounded-lg p-4 cursor-move transition-all hover:border-color"
    >
      {/* Time Badge */}
      <div className="flex items-center justify-between mb-2">
        <span
          style={{ color: COLORS.textSecondary, backgroundColor: COLORS.surfaceHover }}
          className="text-xs font-mono px-2 py-1 rounded"
        >
          {Math.floor(caption.start).toString().padStart(2, '0')}:
          {Math.floor((caption.start % 1) * 60)
            .toString()
            .padStart(2, '0')}
        </span>
        {isSelected && (
          <div className="flex gap-1">
            {isEditing ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditSave(caption.id, editingText);
                  }}
                  style={{ color: COLORS.success }}
                  className="p-1 hover:opacity-75 transition"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCancel();
                  }}
                  style={{ color: COLORS.error }}
                  className="p-1 hover:opacity-75 transition"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditStart(caption.id, caption.text);
                }}
                style={{ color: COLORS.primaryAccent }}
                className="p-1 hover:opacity-75 transition"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Text Content */}
      {isEditing ? (
        <textarea
          onClick={(e) => e.stopPropagation()}
          value={editingText}
          onChange={(e) => onEditChange(e.target.value)}
          style={{
            backgroundColor: COLORS.surfaceHover,
            borderColor: COLORS.primaryAccent,
            color: COLORS.textPrimary,
          }}
          className="w-full p-2 rounded border-2 text-sm resize-none focus:outline-none"
          rows={3}
        />
      ) : (
        <p
          style={{
            color: isActive ? COLORS.primaryAccent : COLORS.textPrimary,
          }}
          className="text-sm leading-relaxed font-medium"
        >
          {caption.text}
        </p>
      )}

      {/* Duration Info */}
      <div style={{ color: COLORS.textMuted }} className="text-xs mt-2">
        {(caption.end - caption.start).toFixed(1)}초
      </div>
    </div>
  );
};

// ========== TRANSCRIPT EDITOR COMPONENT ==========
interface TranscriptEditorProps {
  captions: Caption[];
  currentTime: number;
  selectedId: string | null;
  editingId: string | null;
  editingText: string;
  draggingId?: string | null;
  onSelectCaption: (id: string) => void;
  onEditStart: (id: string, text: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: (id: string, text: string) => void;
  onEditCancel: () => void;
  onDragStart?: (id: string, e: React.DragEvent) => void;
  onDragOver?: (id: string, e: React.DragEvent) => void;
  onDrop?: (id: string, e: React.DragEvent) => void;
}

const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  captions,
  currentTime,
  selectedId,
  editingId,
  editingText,
  draggingId,
  onSelectCaption,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeElementRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active caption
  useEffect(() => {
    if (activeElementRef.current && scrollContainerRef.current) {
      activeElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedId]);

  return (
    <div
      style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
      className="border rounded-xl overflow-hidden flex flex-col h-full"
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: COLORS.surfaceHover,
          borderBottomColor: COLORS.border,
        }}
        className="border-b px-4 py-3"
      >
        <h2 style={{ color: COLORS.textPrimary }} className="font-semibold">
          자막 편집
        </h2>
        <p style={{ color: COLORS.textMuted }} className="text-xs mt-1">
          {captions.length}개 자막
        </p>
      </div>

      {/* Captions List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{
          scrollbarColor: `${COLORS.border} ${COLORS.surface}`,
        }}
      >
        {captions.map((caption) => {
          const isActive = currentTime >= caption.start && currentTime < caption.end;
          const isSelected = selectedId === caption.id;
          const isDragging = draggingId === caption.id;

          return (
            <div
              key={caption.id}
              ref={isSelected ? activeElementRef : null}
            >
              <CaptionBlock
                caption={caption}
                isActive={isActive}
                isSelected={isSelected}
                isEditing={editingId === caption.id}
                editingText={editingText}
                isDragging={isDragging}
                onSelect={onSelectCaption}
                onEditStart={onEditStart}
                onEditChange={onEditChange}
                onEditSave={onEditSave}
                onEditCancel={onEditCancel}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ========== SETTINGS MODAL COMPONENT ==========
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
        className="border rounded-xl p-6 w-96 max-h-96 overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: COLORS.textPrimary }} className="text-lg font-bold">
            설정
          </h2>
          <button
            onClick={onClose}
            style={{ color: COLORS.textSecondary }}
            className="p-1 hover:opacity-75 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Video Quality */}
        <div className="mb-6">
          <label style={{ color: COLORS.textPrimary }} className="text-sm font-semibold">
            영상 품질
          </label>
          <select
            style={{
              backgroundColor: COLORS.surfaceHover,
              borderColor: COLORS.border,
              color: COLORS.textPrimary,
            }}
            className="w-full mt-2 px-3 py-2 rounded border text-sm"
          >
            <option>1080p</option>
            <option>720p</option>
            <option>480p</option>
            <option>360p</option>
          </select>
        </div>

        {/* Font Size */}
        <div className="mb-6">
          <label style={{ color: COLORS.textPrimary }} className="text-sm font-semibold">
            자막 글자 크기
          </label>
          <select
            style={{
              backgroundColor: COLORS.surfaceHover,
              borderColor: COLORS.border,
              color: COLORS.textPrimary,
            }}
            className="w-full mt-2 px-3 py-2 rounded border text-sm"
          >
            <option>소</option>
            <option selected>중</option>
            <option>대</option>
            <option>매우 큼</option>
          </select>
        </div>

        {/* Auto-play */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
            <span style={{ color: COLORS.textPrimary }} className="text-sm font-semibold">
              자동 재생
            </span>
          </label>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            backgroundColor: COLORS.primaryAccent,
            color: '#000000',
          }}
          className="w-full py-2 rounded-lg font-semibold hover:opacity-90 transition"
        >
          확인
        </button>
      </div>
    </div>
  );
};

// ========== EXPORT DIALOG COMPONENT ==========
interface ExportDialogProps {
  isOpen: boolean;
  captions: Caption[];
  projectId?: string;
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, captions, projectId, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async (format: 'srt' | 'vtt' | 'premiere' | 'fcpx') => {
    setIsExporting(true);
    setError(null);

    try {
      if (projectId) {
        // API를 통한 내보내기
        await exportProject(projectId, { format });
        onClose();
      } else {
        // 로컬 내보내기 (projectId가 없을 때)
        if (format === 'srt') {
          generateSRT();
        } else if (format === 'vtt') {
          generateVTT();
        } else {
          setError('Premiere Pro와 FCPX 내보내기는 프로젝트 저장 후 이용 가능합니다.');
        }
      }
    } catch (err: any) {
      console.error('내보내기 실패:', err);
      setError(err.message || '내보내기에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const generateSRT = () => {
    let srtContent = '';
    captions.forEach((caption, index) => {
      const startTime = formatTimeForSRT(caption.start);
      const endTime = formatTimeForSRT(caption.end);
      srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${caption.text}\n\n`;
    });
    downloadFile(srtContent, 'captions.srt', 'text/plain');
  };

  const generateVTT = () => {
    let vttContent = 'WEBVTT\n\n';
    captions.forEach((caption) => {
      const startTime = formatTimeForVTT(caption.start);
      const endTime = formatTimeForVTT(caption.end);
      vttContent += `${startTime} --> ${endTime}\n${caption.text}\n\n`;
    });
    downloadFile(vttContent, 'captions.vtt', 'text/vtt');
  };

  const formatTimeForSRT = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  const formatTimeForVTT = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', `data:${type};charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
        className="border rounded-xl p-6 w-[480px]"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: COLORS.textPrimary }} className="text-xl font-bold">
            📥 내보내기
          </h2>
          <button
            onClick={onClose}
            style={{ color: COLORS.textSecondary }}
            className="p-1 hover:opacity-75 transition"
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ color: COLORS.textSecondary }} className="text-sm mb-6">
          원하는 형식을 선택하여 자막을 내보내세요
        </p>

        {error && (
          <div
            style={{ backgroundColor: COLORS.error }}
            className="mb-4 p-3 rounded-lg text-white text-sm"
          >
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* SRT */}
          <button
            onClick={() => handleExport('srt')}
            disabled={isExporting}
            style={{
              backgroundColor: COLORS.surface,
              borderColor: COLORS.primaryAccent,
              color: COLORS.textPrimary,
            }}
            className="w-full p-4 rounded-lg border-2 hover:opacity-90 transition text-left disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-base">📄 SubRip (.srt)</div>
                <div style={{ color: COLORS.textSecondary }} className="text-sm mt-1">
                  범용 자막 파일 형식
                </div>
              </div>
              <Download size={20} style={{ color: COLORS.primaryAccent }} />
            </div>
          </button>

          {/* VTT */}
          <button
            onClick={() => handleExport('vtt')}
            disabled={isExporting}
            style={{
              backgroundColor: COLORS.surface,
              borderColor: COLORS.primaryAccent,
              color: COLORS.textPrimary,
            }}
            className="w-full p-4 rounded-lg border-2 hover:opacity-90 transition text-left disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-base">🌐 WebVTT (.vtt)</div>
                <div style={{ color: COLORS.textSecondary }} className="text-sm mt-1">
                  웹 표준 자막 파일 형식
                </div>
              </div>
              <Download size={20} style={{ color: COLORS.primaryAccent }} />
            </div>
          </button>

          {/* Premiere Pro */}
          <button
            onClick={() => handleExport('premiere')}
            disabled={isExporting || !projectId}
            style={{
              backgroundColor: COLORS.surface,
              borderColor: projectId ? COLORS.secondaryAccent : COLORS.border,
              color: COLORS.textPrimary,
            }}
            className="w-full p-4 rounded-lg border-2 hover:opacity-90 transition text-left disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-base">🎬 Adobe Premiere Pro (.xml)</div>
                <div style={{ color: COLORS.textSecondary }} className="text-sm mt-1">
                  프리미어 프로 프로젝트 파일 (마커 포함)
                </div>
                {!projectId && (
                  <div style={{ color: COLORS.warning }} className="text-xs mt-1">
                    ⚠️ 프로젝트 저장 후 이용 가능
                  </div>
                )}
              </div>
              <Download size={20} style={{ color: projectId ? COLORS.secondaryAccent : COLORS.textSecondary }} />
            </div>
          </button>

          {/* FCPX */}
          <button
            onClick={() => handleExport('fcpx')}
            disabled={isExporting || !projectId}
            style={{
              backgroundColor: COLORS.surface,
              borderColor: projectId ? COLORS.secondaryAccent : COLORS.border,
              color: COLORS.textPrimary,
            }}
            className="w-full p-4 rounded-lg border-2 hover:opacity-90 transition text-left disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-base">🎞️ Final Cut Pro X (.fcpxml)</div>
                <div style={{ color: COLORS.textSecondary }} className="text-sm mt-1">
                  파이널 컷 프로 X 프로젝트 파일
                </div>
                {!projectId && (
                  <div style={{ color: COLORS.warning }} className="text-xs mt-1">
                    ⚠️ 프로젝트 저장 후 이용 가능
                  </div>
                )}
              </div>
              <Download size={20} style={{ color: projectId ? COLORS.secondaryAccent : COLORS.textSecondary }} />
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          disabled={isExporting}
          style={{
            backgroundColor: COLORS.surfaceHover,
            borderColor: COLORS.border,
            color: COLORS.textSecondary,
          }}
          className="w-full mt-4 py-3 rounded-lg border hover:opacity-75 transition text-sm disabled:opacity-50"
        >
          {isExporting ? '내보내는 중...' : '취소'}
        </button>
      </div>
    </div>
  );
};

// ========== TIMELINE COMPONENT ==========
interface TimelineProps {
  captions: Caption[];
  currentTime: number;
  duration: number;
  selectedId: string | null;
  onTimeChange: (time: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({
  captions,
  currentTime,
  duration,
  selectedId,
  onTimeChange,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);

  return (
    <div
      style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
      className="border rounded-xl overflow-hidden"
    >
      {/* Timeline Header */}
      <div
        style={{
          backgroundColor: COLORS.surfaceHover,
          borderBottomColor: COLORS.border,
        }}
        className="border-b px-4 py-3 flex items-center justify-between"
      >
        <h2 style={{ color: COLORS.textPrimary }} className="font-semibold">
          타임라인
        </h2>
        <div style={{ color: COLORS.textMuted }} className="text-xs font-mono">
          {Math.floor(currentTime)} / {Math.floor(duration)}s
        </div>
      </div>

      {/* Timeline Track */}
      <div ref={timelineRef} className="p-4 overflow-x-auto">
        <div className="relative h-32 bg-black bg-opacity-30 rounded-lg">
          {/* Time Markers */}
          <div className="absolute top-0 left-0 right-0 h-6 flex items-end justify-between px-2">
            {Array.from({ length: Math.ceil(duration / 5) + 1 }).map((_, i) => (
              <div
                key={i}
                style={{
                  color: COLORS.textMuted,
                }}
                className="text-xs"
              >
                {i * 5}s
              </div>
            ))}
          </div>

          {/* Caption Blocks */}
          {captions.map((caption) => (
            <div
              key={caption.id}
              onClick={() => onTimeChange(caption.start)}
              style={{
                left: `${(caption.start / duration) * 100}%`,
                width: `${((caption.end - caption.start) / duration) * 100}%`,
                backgroundColor:
                  selectedId === caption.id ? COLORS.primaryAccent : COLORS.secondaryAccent,
                opacity: selectedId === caption.id ? 1 : 0.6,
              }}
              className="absolute top-8 h-16 rounded cursor-pointer hover:opacity-90 transition flex items-center justify-center p-1"
            >
              <span
                style={{ color: '#000000' }}
                className="text-xs font-semibold text-center truncate"
              >
                {caption.text.substring(0, 10)}
              </span>
            </div>
          ))}

          {/* Playhead */}
          <div
            style={{
              left: `${(currentTime / duration) * 100}%`,
              backgroundColor: COLORS.primaryAccent,
            }}
            className="absolute top-0 w-0.5 h-full"
          />
        </div>

        {/* Timeline Info */}
        <div
          style={{ color: COLORS.textMuted }}
          className="text-xs mt-2 text-center"
        >
          클릭하여 타임스탬프로 이동
        </div>
      </div>
    </div>
  );
};

// ========== MAIN EDITOR COMPONENT ==========
const EditorPageV2: React.FC<EditorPageV2Props> = ({ projectId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [state, setState] = useState<EditorState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 75,
    captions: MOCK_CAPTIONS,
    editingId: null,
    editingText: '',
    selectedId: null,
  });

  // Load captions from API if projectId is provided
  useEffect(() => {
    if (!projectId) return;

    const loadCaptions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTranscript(projectId);
        if (data.transcript && data.transcript.length > 0) {
          // Convert transcript format to Caption format
          const captions: Caption[] = data.transcript.map((item: any, index: number) => ({
            id: `caption-${index}`,
            start: item.start_time || 0,
            end: item.end_time || 0,
            text: item.text || item.word || '',
          }));
          setState((prev) => ({ ...prev, captions }));
        }
      } catch (err: any) {
        // 202 means still processing, which is okay
        if (err.response?.status !== 202) {
          setError('자막을 불러올 수 없습니다');
          console.error('Failed to load captions:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadCaptions();
  }, [projectId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in textarea
      if (e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlePlayPause();
          break;

        case 'ArrowRight':
          e.preventDefault();
          handleTimeChange(Math.min(state.currentTime + 1, state.duration));
          break;

        case 'ArrowLeft':
          e.preventDefault();
          handleTimeChange(Math.max(state.currentTime - 1, 0));
          break;

        case 'Delete':
          e.preventDefault();
          if (state.selectedId && state.captions.length > 1) {
            setState((prev) => ({
              ...prev,
              captions: prev.captions.filter((c) => c.id !== state.selectedId),
              selectedId: null,
            }));
          }
          break;

        case 'KeyS':
          if ((e.ctrlKey || e.metaKey) && state.selectedId) {
            e.preventDefault();
            // Trigger save for current caption
            const caption = state.captions.find((c) => c.id === state.selectedId);
            if (caption && state.editingId === state.selectedId) {
              handleEditSave(state.selectedId, state.editingText);
            }
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.currentTime, state.duration, state.isPlaying, state.selectedId, state.editingId, state.editingText, state.captions]);

  // Auto-select caption on playback
  useEffect(() => {
    const activeCaption = state.captions.find(
      (c) => state.currentTime >= c.start && state.currentTime < c.end
    );
    if (activeCaption && state.selectedId !== activeCaption.id) {
      setState((prev) => ({ ...prev, selectedId: activeCaption.id }));
    }
  }, [state.currentTime, state.captions, state.selectedId]);

  const handlePlayPause = () => {
    setState((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  };

  const handleTimeChange = (time: number) => {
    setState((prev) => ({
      ...prev,
      currentTime: time,
      isPlaying: false,
    }));
  };

  const handleVolumeChange = (volume: number) => {
    setState((prev) => ({ ...prev, volume }));
  };

  const handleDurationChange = (duration: number) => {
    setState((prev) => ({ ...prev, duration }));
  };

  const handleCurrentTimeChange = (time: number) => {
    setState((prev) => ({ ...prev, currentTime: time }));
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      // Reset captions when new video is loaded
      setState((prev) => ({
        ...prev,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        selectedId: null,
      }));
    }
  };

  const handleSelectCaption = (id: string) => {
    setState((prev) => ({
      ...prev,
      selectedId: id,
      isPlaying: false,
    }));
    const caption = state.captions.find((c) => c.id === id);
    if (caption) {
      setState((prev) => ({
        ...prev,
        currentTime: caption.start,
      }));
    }
  };

  const handleEditStart = (id: string, text: string) => {
    setState((prev) => ({
      ...prev,
      editingId: id,
      editingText: text,
    }));
  };

  const handleEditChange = (text: string) => {
    setState((prev) => ({
      ...prev,
      editingText: text,
    }));
  };

  const handleEditSave = async (id: string, text: string) => {
    // Update local state
    setState((prev) => ({
      ...prev,
      captions: prev.captions.map((c) =>
        c.id === id ? { ...c, text } : c
      ),
      editingId: null,
      editingText: '',
    }));

    // Save to API if projectId is provided
    if (projectId) {
      setIsSaving(true);
      try {
        const updatedCaptions = state.captions.map((c) =>
          c.id === id ? { ...c, text } : c
        );
        const fullTranscript = updatedCaptions.map((c) => c.text).join(' ');

        await updateTranscript(projectId, fullTranscript, updatedCaptions);
        console.log('Caption saved to API');
      } catch (err) {
        setError('자막 저장에 실패했습니다');
        console.error('Failed to save caption:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleTranslate = async (targetLanguage: string) => {
    if (!state.captions.length) return;

    setIsSaving(true);
    setError(null);
    try {
      const result = await translateCaptions({
        captions: state.captions.map((c) => ({
          start: c.start,
          end: c.end,
          text: c.text,
        })),
        targetLanguage,
      });

      if (result.translated && result.translated.length > 0) {
        // Create new captions with translated text
        const translatedCaptions: Caption[] = result.translated.map((item: any, index: number) => ({
          id: `translated-${index}`,
          start: item.start,
          end: item.end,
          text: item.text,
        }));

        setState((prev) => ({ ...prev, captions: translatedCaptions }));

        // Save translated captions to API if projectId is provided
        if (projectId) {
          const fullTranscript = translatedCaptions.map((c) => c.text).join(' ');
          await updateTranscript(projectId, fullTranscript, translatedCaptions);
        }
      }
    } catch (err) {
      setError(`${targetLanguage}로 번역할 수 없습니다`);
      console.error('Translation failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditCancel = () => {
    setState((prev) => ({
      ...prev,
      editingId: null,
      editingText: '',
    }));
  };

  const handleDragStart = (id: string, e: React.DragEvent) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (_id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');

    if (sourceId === targetId) {
      setDraggingId(null);
      return;
    }

    // Reorder captions
    const sourceIndex = state.captions.findIndex((c) => c.id === sourceId);
    const targetIndex = state.captions.findIndex((c) => c.id === targetId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const newCaptions = [...state.captions];
      const [removed] = newCaptions.splice(sourceIndex, 1);
      newCaptions.splice(targetIndex, 0, removed);

      setState((prev) => ({
        ...prev,
        captions: newCaptions,
      }));

      // Save to API if projectId is provided
      if (projectId) {
        const fullTranscript = newCaptions.map((c) => c.text).join(' ');
        updateTranscript(projectId, fullTranscript, newCaptions).catch((err) => {
          console.error('Failed to save reordered captions:', err);
        });
      }
    }

    setDraggingId(null);
  };

  return (
    <div style={{ backgroundColor: COLORS.background, color: COLORS.textPrimary }}>
      <Header
        isSaving={isSaving}
        error={error}
        onTranslate={handleTranslate}
        onClearError={() => setError(null)}
        onSettingsClick={() => setShowSettings(true)}
        onExportClick={() => setShowExport(true)}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="flex flex-col items-center gap-3">
            <Loader size={40} style={{ color: COLORS.primaryAccent }} className="animate-spin" />
            <p style={{ color: COLORS.textPrimary }} className="text-sm">
              자막을 불러오는 중...
            </p>
          </div>
        </div>
      )}

      <main className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-3 gap-6 h-[calc(100vh-160px)]">
          {/* Left Column: Video & Timeline */}
          <div className="col-span-2 flex flex-col gap-6">
            {/* Video Upload Section */}
            {!videoUrl && (
              <div
                style={{ backgroundColor: COLORS.surface, borderColor: COLORS.primaryAccent }}
                className="border-2 border-dashed rounded-xl p-8 text-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    backgroundColor: COLORS.primaryAccent,
                    color: '#000000',
                  }}
                  className="px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition"
                >
                  비디오 파일 선택
                </button>
                <p style={{ color: COLORS.textSecondary }} className="mt-3 text-sm">
                  또는 드래그 앤 드롭으로 비디오를 추가하세요
                </p>
              </div>
            )}

            {/* Video Player */}
            {videoUrl && (
              <VideoPlayer
                currentTime={state.currentTime}
                duration={state.duration}
                isPlaying={state.isPlaying}
                volume={state.volume}
                videoUrl={videoUrl}
                onPlayPause={handlePlayPause}
                onTimeChange={handleTimeChange}
                onVolumeChange={handleVolumeChange}
                onDurationChange={handleDurationChange}
                onCurrentTimeChange={handleCurrentTimeChange}
                videoRef={videoRef}
              />
            )}

            {/* Timeline - Show only when video is loaded */}
            {videoUrl && state.duration > 0 && (
              <Timeline
                captions={state.captions}
                currentTime={state.currentTime}
                duration={state.duration}
                selectedId={state.selectedId}
                onTimeChange={handleTimeChange}
              />
            )}
          </div>

          {/* Right Column: Transcript Editor */}
          <div className="col-span-1">
            <TranscriptEditor
              captions={state.captions}
              currentTime={state.currentTime}
              selectedId={state.selectedId}
              editingId={state.editingId}
              editingText={state.editingText}
              draggingId={draggingId}
              onSelectCaption={handleSelectCaption}
              onEditStart={handleEditStart}
              onEditChange={handleEditChange}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <ExportDialog
        isOpen={showExport}
        captions={state.captions}
        projectId={projectId}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
};

export default EditorPageV2;
