import React, { useState } from 'react';
import { FiUploadCloud, FiLink } from 'react-icons/fi';

const VideoUploader = ({ onVideoUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('video', file);

    try {
      // TODO: Replace with actual backend API endpoint
      // const response = await axios.post('/api/upload', formData);
      // onVideoUploaded(response.data);

      // For now, create a local URL for the video
      const videoUrl = URL.createObjectURL(file);
      onVideoUploaded({ videoUrl, fileName: file.name });
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Video upload failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;

    setIsLoading(true);
    try {
      // TODO: Replace with actual backend API endpoint
      // const response = await axios.post('/api/upload-url', { url: videoUrl });
      // onVideoUploaded(response.data);

      onVideoUploaded({ videoUrl: videoUrl.trim() });
    } catch (error) {
      console.error('URL submit failed:', error);
      alert('Invalid video URL. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-dark-bg">
      <div className="w-full max-w-2xl px-6">
        {/* Upload Area */}
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
          <FiUploadCloud className="w-16 h-16 mx-auto mb-4 text-neon-blue" />

          <h2 className="text-2xl font-bold mb-2 text-white">
            Upload Your Video
          </h2>
          <p className="text-gray-400 mb-6">
            Drag and drop your video file here, or click to browse
          </p>

          <input
            type="file"
            accept="video/*"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
            disabled={isLoading}
          />

          <label
            htmlFor="file-upload"
            className={`inline-block px-6 py-3 bg-neon-blue text-dark-bg font-semibold rounded-lg cursor-pointer transition-all hover:shadow-neon ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-90'
            }`}
          >
            {isLoading ? 'Processing...' : 'Browse Files'}
          </label>
        </div>

        {/* Divider */}
        <div className="flex items-center my-8">
          <div className="flex-1 border-t border-dark-border"></div>
          <span className="px-4 text-gray-500">OR</span>
          <div className="flex-1 border-t border-dark-border"></div>
        </div>

        {/* URL Input */}
        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <div className="relative">
            <FiLink className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Paste video URL (YouTube, Vimeo, direct link...)"
              className="w-full pl-12 pr-4 py-3 bg-dark-secondary border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !videoUrl.trim()}
            className={`w-full py-3 bg-dark-secondary border border-neon-blue text-neon-blue font-semibold rounded-lg transition-all ${
              isLoading || !videoUrl.trim()
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-neon-blue hover:text-dark-bg hover:shadow-neon'
            }`}
          >
            {isLoading ? 'Processing...' : 'Load from URL'}
          </button>
        </form>

        {/* Info Text */}
        <p className="text-center text-gray-600 text-sm mt-8">
          Supported formats: MP4, MOV, AVI, WebM • Max size: 500MB
        </p>
      </div>
    </div>
  );
};

export default VideoUploader;
