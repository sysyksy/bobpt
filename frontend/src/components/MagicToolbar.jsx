import React, { useState } from 'react';
import { FiDownload, FiScissors } from 'react-icons/fi';
import { BsStars, BsToggleOn, BsToggleOff } from 'react-icons/bs';

const MagicToolbar = ({
  showFillers,
  onToggleFillers,
  onMakeShorts,
  onExport
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExport = (format) => {
    onExport(format);
    setShowExportMenu(false);
  };

  return (
    <div className="bg-dark-secondary border-b border-dark-border px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left Side - Magic Tools */}
        <div className="flex items-center gap-4">
          {/* Remove Fillers Toggle */}
          <div className="flex items-center gap-2 bg-dark-bg px-4 py-2 rounded-lg border border-dark-border">
            <BsStars className="text-neon-blue" />
            <span className="text-sm font-medium text-white">
              Remove Fillers
            </span>
            <button
              onClick={onToggleFillers}
              className="ml-2 focus:outline-none"
              aria-label="Toggle fillers"
            >
              {showFillers ? (
                <BsToggleOff className="w-6 h-6 text-gray-500 hover:text-gray-300 transition-colors" />
              ) : (
                <BsToggleOn className="w-6 h-6 text-neon-blue hover:text-neon-blue transition-colors" />
              )}
            </button>
          </div>

          {/* Make Shorts Button */}
          <button
            onClick={onMakeShorts}
            className="flex items-center gap-2 bg-dark-bg px-4 py-2 rounded-lg border border-neon-blue text-neon-blue hover:bg-neon-blue hover:text-dark-bg transition-all hover:shadow-neon"
          >
            <FiScissors />
            <span className="text-sm font-medium">Make Shorts</span>
          </button>
        </div>

        {/* Right Side - Export */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 bg-neon-blue text-dark-bg px-4 py-2 rounded-lg font-medium hover:shadow-neon transition-all"
          >
            <FiDownload />
            <span className="text-sm">Export</span>
          </button>

          {/* Export Dropdown Menu */}
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-dark-secondary border border-dark-border rounded-lg shadow-lg overflow-hidden z-10">
              <button
                onClick={() => handleExport('srt')}
                className="w-full px-4 py-3 text-left text-white hover:bg-dark-bg transition-colors flex items-center justify-between"
              >
                <span>SRT Subtitle</span>
                <span className="text-xs text-gray-500">.srt</span>
              </button>
              <button
                onClick={() => handleExport('vtt')}
                className="w-full px-4 py-3 text-left text-white hover:bg-dark-bg transition-colors flex items-center justify-between"
              >
                <span>WebVTT</span>
                <span className="text-xs text-gray-500">.vtt</span>
              </button>
              <button
                onClick={() => handleExport('xml')}
                className="w-full px-4 py-3 text-left text-white hover:bg-dark-bg transition-colors flex items-center justify-between"
              >
                <span>Final Cut XML</span>
                <span className="text-xs text-gray-500">.xml</span>
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-4 py-3 text-left text-white hover:bg-dark-bg transition-colors flex items-center justify-between"
              >
                <span>JSON Data</span>
                <span className="text-xs text-gray-500">.json</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MagicToolbar;
