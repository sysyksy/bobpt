
import React, { useRef, useEffect } from 'react';
import { SubtitleBlock } from '../../types/studio-episode';
import { Clock, User, Trash2, Plus } from 'lucide-react';

interface SubtitleListProps {
  subtitles: SubtitleBlock[];
  currentTime: number;
  onUpdateSubtitle: (id: string, text: string) => void;
  onDeleteSubtitle: (id: string) => void;
  onJumpToTime: (time: number) => void;
  activeId: string | null;
}

const SubtitleList: React.FC<SubtitleListProps> = ({ 
  subtitles, 
  currentTime, 
  onUpdateSubtitle, 
  onDeleteSubtitle, 
  onJumpToTime,
  activeId
}) => {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  if (subtitles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
        <div className="bg-gray-800 p-4 rounded-full mb-4">
          <Type className="w-8 h-8 opacity-50" />
        </div>
        <h3 className="text-lg font-medium text-gray-300">No Subtitles Yet</h3>
        <p className="text-sm mt-2 max-w-xs">Upload a video and use AI Auto-Transcribe to generate captions instantly.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-900/50">
      {subtitles.map((block) => {
        const isActive = activeId === block.id;
        
        return (
          <div 
            key={block.id} 
            ref={isActive ? activeRef : null}
            className={`
              group relative flex flex-col p-4 rounded-lg border transition-all duration-300 ease-out transform
              ${isActive 
                ? 'bg-gray-800 border-episode-500 shadow-xl shadow-episode-500/10 scale-[1.02] translate-x-1 z-10' 
                : 'bg-gray-800/40 border-gray-800 hover:border-gray-700 hover:bg-gray-800 hover:translate-x-1 hover:shadow-lg hover:shadow-black/20'}
            `}
          >
            {/* Metadata Header */}
            <div className="flex items-center justify-between mb-2 text-xs text-gray-500 uppercase tracking-wider font-semibold relative z-10">
              <div 
                className={`flex items-center gap-2 cursor-pointer transition-colors duration-200 ${isActive ? 'text-episode-400' : 'hover:text-episode-400'}`}
                onClick={() => onJumpToTime(block.startTime)}
              >
                <Clock className="w-3 h-3" />
                <span>{formatTime(block.startTime)} - {formatTime(block.endTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-gray-600">
                  <User className="w-3 h-3" />
                  <span>{block.speaker || 'Speaker 1'}</span>
                </div>
                <button 
                  onClick={() => onDeleteSubtitle(block.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all duration-200"
                  title="Delete Block"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Editable Text Area */}
            <textarea
              value={block.text}
              onChange={(e) => onUpdateSubtitle(block.id, e.target.value)}
              className={`
                w-full bg-transparent resize-none outline-none text-sm leading-relaxed relative z-10 transition-colors duration-200
                ${isActive ? 'text-white font-medium' : 'text-gray-300 group-hover:text-gray-200'}
                placeholder-gray-600
              `}
              rows={Math.max(2, Math.ceil(block.text.length / 50))} // Auto-growish
            />
            
            {/* Active Indicator Strip */}
            <div className={`
                absolute left-0 top-0 bottom-0 w-1 bg-episode-500 rounded-l-lg transition-all duration-300 origin-center
                ${isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50'}
            `}></div>
          </div>
        );
      })}
      
      <div className="pt-4 pb-12 flex justify-center">
        <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-episode-400 transition-colors group">
            <div className="p-1 rounded-full bg-gray-800 group-hover:bg-episode-500/20 transition-colors">
                <Plus className="w-4 h-4"/>
            </div>
            <span>Add Manual Subtitle</span>
        </button>
      </div>
    </div>
  );
};

// Helper icon
const Type = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
);

export default SubtitleList;
