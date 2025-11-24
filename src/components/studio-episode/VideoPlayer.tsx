import React, { useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, Maximize } from 'lucide-react';

interface VideoPlayerProps {
  src: string | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, 
  currentTime, 
  onTimeUpdate, 
  onDurationChange,
  isPlaying,
  onPlayPause
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Sync internal video time with external state if difference is significant
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Handle play/pause sync
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(e => console.error("Auto-play blocked", e));
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  if (!src) {
    return (
      <div className="w-full aspect-video bg-gray-950 flex flex-col items-center justify-center border-b border-gray-800">
        <div className="text-gray-600 mb-2">
            <svg className="w-16 h-16 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-10-7h9v6h-9z"/></svg>
        </div>
        <p className="text-gray-500 font-medium">No video selected</p>
      </div>
    );
  }

  return (
    <div className="group relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
        onClick={onPlayPause}
      />
      
      {/* Custom Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onPlayPause} className="text-white hover:text-blue-400 transition-colors">
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>
            <button onClick={() => { if(videoRef.current) videoRef.current.currentTime = 0; }} className="text-gray-300 hover:text-white">
              <RotateCcw className="w-5 h-5" />
            </button>
            <div className="text-xs font-mono text-gray-300">
                {new Date(currentTime * 1000).toISOString().substr(14, 5)} 
                <span className="opacity-50 mx-1">/</span>
                {videoRef.current ? new Date(videoRef.current.duration * 1000).toISOString().substr(14, 5) : "00:00"}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <Volume2 className="w-5 h-5 text-gray-300" />
             <Maximize className="w-5 h-5 text-gray-300 hover:text-white cursor-pointer" />
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-2 h-1 w-full bg-gray-700 rounded-full cursor-pointer relative overflow-hidden">
            <div 
                className="absolute top-0 bottom-0 left-0 bg-blue-500" 
                style={{ width: `${(currentTime / (videoRef.current?.duration || 1)) * 100}%` }}
            ></div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;