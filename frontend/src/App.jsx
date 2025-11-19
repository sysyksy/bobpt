import React, { useState, useEffect } from 'react';
import VideoUploader from './components/VideoUploader';
import VideoPlayer from './components/VideoPlayer';
import ScriptEditor from './components/ScriptEditor';
import MagicToolbar from './components/MagicToolbar';

// Mock transcript data for development
const MOCK_TRANSCRIPTS = [
  {
    start: 0,
    end: 3.5,
    speaker: 'Speaker 1',
    text: '안녕하세요 여러분, 오늘은 AI 비디오 편집에 대해 이야기해보겠습니다.',
    translated: 'Hello everyone, today we will talk about AI video editing.',
    words: [
      { text: '안녕하세요', is_filler: false },
      { text: '여러분,', is_filler: false },
      { text: '음,', is_filler: true },
      { text: '오늘은', is_filler: false },
      { text: 'AI', is_filler: false },
      { text: '비디오', is_filler: false },
      { text: '편집에', is_filler: false },
      { text: '대해', is_filler: false },
      { text: '이야기해보겠습니다.', is_filler: false },
    ]
  },
  {
    start: 3.5,
    end: 7.2,
    speaker: 'Speaker 1',
    text: '그러니까, 이 기술은 정말 혁신적이라고 할 수 있죠.',
    translated: 'So, this technology can be said to be truly innovative.',
    words: [
      { text: '그러니까,', is_filler: true },
      { text: '이', is_filler: false },
      { text: '기술은', is_filler: false },
      { text: '정말', is_filler: false },
      { text: '혁신적이라고', is_filler: false },
      { text: '할', is_filler: false },
      { text: '수', is_filler: false },
      { text: '있죠.', is_filler: false },
    ]
  },
  {
    start: 7.2,
    end: 12.0,
    speaker: 'Speaker 1',
    text: '뭐, 예를 들어서 말이죠, 자동으로 자막을 생성할 수 있습니다.',
    translated: 'Well, for example, you can automatically generate subtitles.',
    is_highlight: true,
    words: [
      { text: '뭐,', is_filler: true },
      { text: '예를', is_filler: false },
      { text: '들어서', is_filler: false },
      { text: '말이죠,', is_filler: true },
      { text: '자동으로', is_filler: false },
      { text: '자막을', is_filler: false },
      { text: '생성할', is_filler: false },
      { text: '수', is_filler: false },
      { text: '있습니다.', is_filler: false },
    ]
  },
];

function App() {
  const [videoData, setVideoData] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTo, setSeekTo] = useState(null);
  const [showFillers, setShowFillers] = useState(true);
  const [language, setLanguage] = useState('original');

  // Load mock data when video is uploaded (for development)
  useEffect(() => {
    if (videoData) {
      // TODO: Replace with actual API call to backend
      // fetch(`/api/analyze/${videoData.id}`)
      //   .then(res => res.json())
      //   .then(data => setTranscripts(data.transcripts));

      // For now, use mock data
      setTranscripts(MOCK_TRANSCRIPTS);
    }
  }, [videoData]);

  const handleVideoUploaded = (data) => {
    setVideoData(data);
  };

  const handleSeek = (time) => {
    setSeekTo(time);
    setCurrentTime(time);
  };

  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
  };

  const handleToggleFillers = () => {
    setShowFillers(!showFillers);
  };

  const handleMakeShorts = () => {
    // TODO: Implement AI shorts generation
    alert('AI Shorts generation coming soon! This will analyze your video and suggest the best clips for short-form content.');
  };

  const handleExport = (format) => {
    // TODO: Implement export functionality
    console.log(`Exporting as ${format}`);

    if (format === 'json') {
      // Export as JSON
      const dataStr = JSON.stringify(transcripts, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'transcript.json';
      link.click();
    } else if (format === 'srt') {
      // Export as SRT
      let srtContent = '';
      transcripts.forEach((segment, index) => {
        const startTime = formatSRTTime(segment.start);
        const endTime = formatSRTTime(segment.end);
        srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n\n`;
      });

      const dataBlob = new Blob([srtContent], { type: 'text/plain' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'transcript.srt';
      link.click();
    } else {
      alert(`Export as ${format.toUpperCase()} coming soon!`);
    }
  };

  const formatSRTTime = (seconds) => {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours().toString().padStart(2, '0');
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
  };

  // Show uploader if no video
  if (!videoData) {
    return <VideoUploader onVideoUploaded={handleVideoUploaded} />;
  }

  return (
    <div className="h-screen flex flex-col bg-dark-bg">
      {/* Magic Toolbar */}
      <MagicToolbar
        showFillers={showFillers}
        onToggleFillers={handleToggleFillers}
        onMakeShorts={handleMakeShorts}
        onExport={handleExport}
      />

      {/* Main Content: Video + Script Editor (5:5 split) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Video Player */}
        <div className="w-1/2 border-r border-dark-border">
          <VideoPlayer
            videoUrl={videoData.videoUrl}
            currentTime={currentTime}
            onTimeUpdate={handleTimeUpdate}
            seekTo={seekTo}
          />
        </div>

        {/* Right Panel - Script Editor */}
        <div className="w-1/2">
          <ScriptEditor
            transcripts={transcripts}
            currentTime={currentTime}
            onSeek={handleSeek}
            showFillers={showFillers}
            language={language}
            onLanguageChange={setLanguage}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
