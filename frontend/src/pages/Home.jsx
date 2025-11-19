import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiUploadCloud } from 'react-icons/fi'
import { uploadVideo } from '../services/api'

const Home = () => {
  const navigate = useNavigate()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleFileUpload = async (file) => {
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const result = await uploadVideo(file, (progress) => {
        setUploadProgress(progress)
      })

      // Navigate to editor with video ID
      if (result.video_id) {
        navigate(`/editor/${result.video_id}`)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Video upload failed. Please try again.')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-bg px-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-white mb-4">
          BobPT Video Editor
        </h1>
        <p className="text-gray-400 text-lg">
          AI-powered document-based video editing
        </p>
      </div>

      {/* Upload Area */}
      <div className="w-full max-w-2xl">
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
            isDragging
              ? 'border-neon-blue bg-neon-blue bg-opacity-5 shadow-neon'
              : 'border-dark-border hover:border-neon-blue-dim'
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <FiUploadCloud className="w-20 h-20 mx-auto mb-6 text-neon-blue" />

          <h2 className="text-2xl font-bold mb-2 text-white">
            Upload Your Video
          </h2>
          <p className="text-gray-400 mb-6">
            Drag and drop your video file here, or click to browse
          </p>

          {isUploading ? (
            <div className="space-y-4">
              <div className="w-full bg-dark-secondary rounded-full h-3 overflow-hidden">
                <div
                  className="bg-neon-blue h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-neon-blue text-sm">
                Uploading... {uploadProgress}%
              </p>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />

              <label
                htmlFor="file-upload"
                className="inline-block px-8 py-4 bg-neon-blue text-dark-bg font-semibold rounded-lg cursor-pointer transition-all hover:shadow-neon hover:bg-opacity-90"
              >
                Browse Files
              </label>
            </>
          )}
        </div>

        {/* Info */}
        <p className="text-center text-gray-600 text-sm mt-8">
          Supported formats: MP4, MOV, AVI, WebM • Max size: 500MB
        </p>
      </div>

      {/* Features */}
      <div className="mt-16 grid grid-cols-3 gap-8 max-w-4xl">
        <div className="text-center">
          <div className="text-3xl mb-2">🎙️</div>
          <h3 className="text-white font-semibold mb-1">Auto Transcribe</h3>
          <p className="text-gray-500 text-sm">
            Automatically generate accurate transcripts
          </p>
        </div>
        <div className="text-center">
          <div className="text-3xl mb-2">🌐</div>
          <h3 className="text-white font-semibold mb-1">Translate</h3>
          <p className="text-gray-500 text-sm">
            Translate to multiple languages instantly
          </p>
        </div>
        <div className="text-center">
          <div className="text-3xl mb-2">✂️</div>
          <h3 className="text-white font-semibold mb-1">AI Editing</h3>
          <p className="text-gray-500 text-sm">
            Remove fillers and generate shorts
          </p>
        </div>
      </div>
    </div>
  )
}

export default Home
