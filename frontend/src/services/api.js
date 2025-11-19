import axios from 'axios'

const API_BASE_URL = '/api'

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Video upload and processing
export const uploadVideo = async (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await apiClient.post('/videos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          onProgress(percentCompleted)
        }
      },
    })
    return response.data
  } catch (error) {
    console.error('Upload error:', error)
    throw error
  }
}

// Get video details by ID
export const getVideoDetails = async (videoId) => {
  try {
    const response = await apiClient.get(`/videos/${videoId}`)
    return response.data
  } catch (error) {
    console.error('Get video details error:', error)
    throw error
  }
}

// Get transcript for a video
export const getTranscript = async (videoId) => {
  try {
    const response = await apiClient.get(`/videos/${videoId}/transcript`)
    return response.data
  } catch (error) {
    console.error('Get transcript error:', error)
    throw error
  }
}

// Get translated transcript
export const getTranslatedTranscript = async (videoId, targetLang = 'en') => {
  try {
    const response = await apiClient.get(
      `/videos/${videoId}/transcript/translate`,
      {
        params: { target_lang: targetLang },
      }
    )
    return response.data
  } catch (error) {
    console.error('Get translated transcript error:', error)
    throw error
  }
}

// Generate shorts from video
export const generateShorts = async (videoId) => {
  try {
    const response = await apiClient.post(`/videos/${videoId}/shorts`)
    return response.data
  } catch (error) {
    console.error('Generate shorts error:', error)
    throw error
  }
}

// Export transcript in various formats
export const exportTranscript = async (videoId, format = 'srt') => {
  try {
    const response = await apiClient.get(`/videos/${videoId}/export`, {
      params: { format },
      responseType: 'blob',
    })
    return response.data
  } catch (error) {
    console.error('Export transcript error:', error)
    throw error
  }
}

// Remove filler words
export const removeFillers = async (videoId) => {
  try {
    const response = await apiClient.post(`/videos/${videoId}/remove-fillers`)
    return response.data
  } catch (error) {
    console.error('Remove fillers error:', error)
    throw error
  }
}

// Get list of all videos
export const getVideosList = async () => {
  try {
    const response = await apiClient.get('/videos')
    return response.data
  } catch (error) {
    console.error('Get videos list error:', error)
    throw error
  }
}

export default {
  uploadVideo,
  getVideoDetails,
  getTranscript,
  getTranslatedTranscript,
  generateShorts,
  exportTranscript,
  removeFillers,
  getVideosList,
}
