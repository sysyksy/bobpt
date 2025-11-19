import React, { useRef, useEffect } from 'react';
import TranscriptSegment from './TranscriptSegment';

const ScriptEditor = ({
  transcripts,
  currentTime,
  onSeek,
  showFillers,
  language,
  onLanguageChange
}) => {
  const containerRef = useRef(null);
  const activeSegmentRef = useRef(null);

  // Find the current active segment based on video time
  const findActiveSegmentIndex = () => {
    if (!transcripts || transcripts.length === 0) return -1;

    for (let i = 0; i < transcripts.length; i++) {
      const segment = transcripts[i];
      if (currentTime >= segment.start && currentTime < segment.end) {
        return i;
      }
    }
    return -1;
  };

  const activeIndex = findActiveSegmentIndex();

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeSegmentRef.current;

      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Check if element is not fully visible
      if (
        elementRect.top < containerRect.top ||
        elementRect.bottom > containerRect.bottom
      ) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [activeIndex]);

  const handleSegmentClick = (segment) => {
    onSeek(segment.start);
  };

  if (!transcripts || transcripts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p>No transcript available. Upload a video to get started.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Header with Language Toggle */}
      <div className="flex items-center justify-between p-4 border-b border-dark-border">
        <h2 className="text-lg font-bold text-white">Script Editor</h2>

        <div className="flex gap-2 bg-dark-secondary rounded-lg p-1">
          <button
            onClick={() => onLanguageChange('original')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              language === 'original'
                ? 'bg-neon-blue text-dark-bg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Original (KO)
          </button>
          <button
            onClick={() => onLanguageChange('translated')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              language === 'translated'
                ? 'bg-neon-blue text-dark-bg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Translated (EN)
          </button>
        </div>
      </div>

      {/* Transcript List */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {transcripts.map((segment, index) => (
          <div
            key={index}
            ref={index === activeIndex ? activeSegmentRef : null}
          >
            <TranscriptSegment
              segment={segment}
              isActive={index === activeIndex}
              onClick={() => handleSegmentClick(segment)}
              showFillers={showFillers}
              language={language}
            />
          </div>
        ))}
      </div>

      {/* Stats Footer */}
      <div className="p-4 border-t border-dark-border bg-dark-secondary">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{transcripts.length} segments</span>
          <span>
            Total duration: {Math.floor(transcripts[transcripts.length - 1]?.end / 60 || 0)} min
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScriptEditor;
