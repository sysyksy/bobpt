import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import ReactPlayer from 'react-player'
import useVideoStore from '../store/useVideoStore'
import { getVideoDetails, getTranscript, getTranslatedTranscript } from '../services/api'

const Editor = () => {
  const { videoId } = useParams()
  const playerRef = useRef(null)

  // Zustand store
  const {
    videoUrl,
    currentTime,
    isPlaying,
    transcript,
    translatedScript,
    language,
    fillersRemoved,
    isLoading,
    setVideoUrl,
    setCurrentTime,
    setIsPlaying,
    setTranscript,
    setTranslatedScript,
    setLanguage,
    toggleFillers,
    setLoading,
    getActiveSegmentIndex,
  } = useVideoStore()

  // Load video data on mount
  useEffect(() => {
    const loadVideoData = async () => {
      setLoading(true)
      try {
        // Load video details
        const videoData = await getVideoDetails(videoId)
        setVideoUrl(videoData.url)

        // Load transcript
        const transcriptData = await getTranscript(videoId)
        setTranscript(transcriptData)

        // Load translated transcript
        const translatedData = await getTranslatedTranscript(videoId, 'en')
        setTranslatedScript(translatedData)
      } catch (error) {
        console.error('Failed to load video data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (videoId) {
      loadVideoData()
    }
  }, [videoId])

  // Handle video progress update
  const handleProgress = (state) => {
    setCurrentTime(state.playedSeconds)
  }

  // Handle segment click - seek to time
  const handleSegmentClick = (segment) => {
    if (playerRef.current) {
      playerRef.current.seekTo(segment.start, 'seconds')
      setCurrentTime(segment.start)
    }
  }

  // Get current segments based on language
  const currentSegments = language === 'translated' ? translatedScript : transcript
  const activeIndex = getActiveSegmentIndex()

  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-white text-xl">Loading video...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-dark-bg">
      {/* Top Toolbar */}
      <div className="bg-dark-secondary border-b border-dark-border px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl font-bold">Video Editor</h1>

          <div className="flex items-center gap-4">
            {/* Language Toggle */}
            <div className="flex gap-2 bg-dark-bg rounded-lg p-1">
              <button
                onClick={() => setLanguage('original')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  language === 'original'
                    ? 'bg-neon-blue text-dark-bg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setLanguage('translated')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  language === 'translated'
                    ? 'bg-neon-blue text-dark-bg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Translated
              </button>
            </div>

            {/* Filler Toggle */}
            <button
              onClick={toggleFillers}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                fillersRemoved
                  ? 'bg-neon-blue text-dark-bg'
                  : 'bg-dark-bg text-gray-400 hover:text-white'
              }`}
            >
              {fillersRemoved ? 'Show Fillers' : 'Hide Fillers'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Video + Transcript (5:5 split) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Video Player */}
        <div className="w-1/2 border-r border-dark-border flex flex-col bg-black">
          <div className="flex-1 flex items-center justify-center">
            <ReactPlayer
              ref={playerRef}
              url={videoUrl}
              width="100%"
              height="100%"
              playing={isPlaying}
              onProgress={handleProgress}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              controls
              progressInterval={100}
            />
          </div>
        </div>

        {/* Right Panel - Transcript Editor */}
        <div className="w-1/2 flex flex-col bg-dark-bg">
          {/* Transcript Header */}
          <div className="px-6 py-4 border-b border-dark-border">
            <h2 className="text-white text-lg font-semibold">
              Transcript ({currentSegments.length} segments)
            </h2>
          </div>

          {/* Transcript List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {currentSegments.length === 0 ? (
              <div className="text-gray-500 text-center mt-8">
                No transcript available
              </div>
            ) : (
              currentSegments.map((segment, index) => {
                const isActive = index === activeIndex

                return (
                  <div
                    key={index}
                    onClick={() => handleSegmentClick(segment)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isActive
                        ? 'bg-neon-blue bg-opacity-10 border-neon-blue shadow-neon'
                        : 'bg-dark-secondary border-dark-border hover:border-neon-blue-dim'
                    }`}
                  >
                    {/* Time and Speaker */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-neon-blue">
                        {formatTime(segment.start)} - {formatTime(segment.end)}
                      </span>
                      {segment.speaker && (
                        <span className="text-xs font-semibold text-gray-400 bg-dark-bg px-2 py-1 rounded">
                          {segment.speaker}
                        </span>
                      )}
                    </div>

                    {/* Text */}
                    <div className="text-white leading-relaxed">
                      {segment.text}
                    </div>

                    {/* Additional metadata */}
                    {segment.is_filler && fillersRemoved && (
                      <div className="mt-2 text-xs text-yellow-400">
                        [Filler word detected]
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Editor
