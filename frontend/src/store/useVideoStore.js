import { create } from 'zustand'

const useVideoStore = create((set, get) => ({
  // Video state
  videoId: null,
  videoUrl: null,
  currentTime: 0,
  isPlaying: false,
  duration: 0,

  // Transcript state (Firestore 구조: start, end, text)
  transcript: [],
  translatedScript: [],

  // UI state
  fillersRemoved: false,
  language: 'original', // 'original' or 'translated'

  // Loading state
  isLoading: false,
  error: null,

  // Actions
  setVideoId: (id) => set({ videoId: id }),

  setVideoUrl: (url) => set({ videoUrl: url }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setDuration: (duration) => set({ duration: duration }),

  setTranscript: (transcript) => set({ transcript }),

  setTranslatedScript: (translatedScript) => set({ translatedScript }),

  toggleFillers: () => set((state) => ({
    fillersRemoved: !state.fillersRemoved
  })),

  setLanguage: (language) => set({ language }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  // Reset all state
  reset: () => set({
    videoId: null,
    videoUrl: null,
    currentTime: 0,
    isPlaying: false,
    duration: 0,
    transcript: [],
    translatedScript: [],
    fillersRemoved: false,
    language: 'original',
    isLoading: false,
    error: null,
  }),

  // Get active transcript segment based on currentTime
  getActiveSegment: () => {
    const { currentTime, transcript, translatedScript, language } = get()
    const segments = language === 'translated' ? translatedScript : transcript

    return segments.find(
      (segment) => segment.start <= currentTime && segment.end >= currentTime
    )
  },

  // Get active segment index
  getActiveSegmentIndex: () => {
    const { currentTime, transcript, translatedScript, language } = get()
    const segments = language === 'translated' ? translatedScript : transcript

    return segments.findIndex(
      (segment) => segment.start <= currentTime && segment.end >= currentTime
    )
  },
}))

export default useVideoStore
