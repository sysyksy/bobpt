import React, { useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { FiPlay, FiPause, FiVolume2, FiVolumeX, FiMaximize } from 'react-icons/fi';

const VideoPlayer = ({
  videoUrl,
  currentTime,
  onTimeUpdate,
  seekTo
}) => {
  const playerRef = useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const [volume, setVolume] = React.useState(0.8);
  const [muted, setMuted] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const [seeking, setSeeking] = React.useState(false);

  // Handle external seek requests
  useEffect(() => {
    if (seekTo !== null && playerRef.current) {
      playerRef.current.seekTo(seekTo, 'seconds');
    }
  }, [seekTo]);

  const handleProgress = (state) => {
    if (!seeking) {
      onTimeUpdate(state.playedSeconds);
    }
  };

  const handleSeekChange = (e) => {
    const newTime = parseFloat(e.target.value);
    onTimeUpdate(newTime);
  };

  const handleSeekMouseDown = () => {
    setSeeking(true);
  };

  const handleSeekMouseUp = (e) => {
    setSeeking(false);
    const newTime = parseFloat(e.target.value);
    playerRef.current.seekTo(newTime, 'seconds');
  };

  const formatTime = (seconds) => {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh) {
      return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  const toggleFullscreen = () => {
    const player = playerRef.current.wrapper;
    if (player.requestFullscreen) {
      player.requestFullscreen();
    } else if (player.webkitRequestFullscreen) {
      player.webkitRequestFullscreen();
    } else if (player.msRequestFullscreen) {
      player.msRequestFullscreen();
    }
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Video Player */}
      <div className="flex-1 flex items-center justify-center bg-black relative">
        <ReactPlayer
          ref={playerRef}
          url={videoUrl}
          width="100%"
          height="100%"
          playing={playing}
          volume={volume}
          muted={muted}
          onProgress={handleProgress}
          onDuration={setDuration}
          progressInterval={100}
          style={{
            maxHeight: '100%',
            maxWidth: '100%'
          }}
        />
      </div>

      {/* Controls */}
      <div className="bg-dark-secondary border-t border-dark-border p-4">
        {/* Progress Bar */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeekChange}
            onMouseDown={handleSeekMouseDown}
            onMouseUp={handleSeekMouseUp}
            className="w-full h-1 bg-dark-border rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #00d4ff 0%, #00d4ff ${(currentTime / duration) * 100}%, #2a2a2a ${(currentTime / duration) * 100}%, #2a2a2a 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={() => setPlaying(!playing)}
              className="w-10 h-10 flex items-center justify-center bg-neon-blue text-dark-bg rounded-full hover:shadow-neon transition-all"
            >
              {playing ? <FiPause size={20} /> : <FiPlay size={20} />}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMuted(!muted)}
                className="text-white hover:text-neon-blue transition-colors"
              >
                {muted ? <FiVolumeX size={20} /> : <FiVolume2 size={20} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setMuted(false);
                }}
                className="w-20 h-1 bg-dark-border rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-neon-blue transition-colors"
          >
            <FiMaximize size={20} />
          </button>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #00d4ff;
          cursor: pointer;
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.8);
        }

        .slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #00d4ff;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(0, 212, 255, 0.8);
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;
