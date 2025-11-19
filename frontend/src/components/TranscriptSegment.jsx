import React from 'react';

const TranscriptSegment = ({
  segment,
  isActive,
  onClick,
  showFillers,
  language
}) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderText = () => {
    if (!segment.words || language === 'translated') {
      return <span>{segment.text}</span>;
    }

    // Render words with filler highlighting
    return segment.words.map((word, index) => (
      <span
        key={index}
        className={`${
          word.is_filler && !showFillers
            ? 'opacity-30 line-through'
            : ''
        }`}
      >
        {word.text}{' '}
      </span>
    ));
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 mb-2 rounded-lg border cursor-pointer transition-all ${
        isActive
          ? 'bg-neon-blue bg-opacity-10 border-neon-blue shadow-neon'
          : 'bg-dark-secondary border-dark-border hover:border-neon-blue-dim'
      }`}
    >
      {/* Timestamp and Speaker */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-mono text-neon-blue">
          {formatTime(segment.start)}
        </span>
        {segment.speaker && (
          <span className="text-xs font-semibold text-gray-400 bg-dark-bg px-2 py-1 rounded">
            {segment.speaker}
          </span>
        )}
        {segment.is_highlight && (
          <span className="text-xs bg-yellow-500 bg-opacity-20 text-yellow-400 px-2 py-1 rounded">
            ✨ Highlight
          </span>
        )}
      </div>

      {/* Text Content */}
      <div className="text-white leading-relaxed">
        {renderText()}
      </div>

      {/* Translated Text (if available and not in translated mode) */}
      {segment.translated && language === 'original' && (
        <div className="mt-2 pt-2 border-t border-dark-border text-gray-400 text-sm italic">
          {segment.translated}
        </div>
      )}
    </div>
  );
};

export default TranscriptSegment;
