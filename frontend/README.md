# BobPT Video Editor - Frontend

Document-based Video Editor inspired by Vrew. AI-powered video editing tool with transcript-based editing interface.

## Features

- **Dark Mode Interface**: Beautiful dark theme with neon blue accents
- **Video Upload**: Drag & drop or URL-based video import
- **Transcript Editor**: Document-style editing with automatic sync
- **AI Features**:
  - Automatic filler word detection and removal
  - AI-powered shorts generation
  - Speaker identification
- **Export Options**: SRT, VTT, XML, JSON formats

## Tech Stack

- **React 18**: Modern React with hooks
- **Tailwind CSS**: Utility-first styling with custom dark theme
- **react-player**: Video playback with full control
- **react-icons**: Beautiful icon library
- **axios**: HTTP client for API calls

## Project Structure

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── VideoUploader.jsx    # Video upload interface
│   │   ├── VideoPlayer.jsx      # Video playback with controls
│   │   ├── ScriptEditor.jsx     # Transcript editing panel
│   │   ├── TranscriptSegment.jsx # Individual transcript card
│   │   └── MagicToolbar.jsx     # AI features toolbar
│   ├── App.jsx                   # Main application component
│   ├── index.js                  # Entry point
│   └── index.css                 # Global styles
├── package.json
├── tailwind.config.js
└── postcss.config.js
```

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
```

## Component Overview

### VideoUploader

Entry point for uploading videos. Supports:
- Drag and drop file upload
- URL-based video loading (YouTube, Vimeo, direct links)
- File format validation

### VideoPlayer

Video playback component with:
- Play/pause controls
- Volume control with mute
- Seek bar with precise time selection
- Fullscreen support
- Sync with transcript timeline

### ScriptEditor

Transcript editing panel featuring:
- Auto-scrolling to current segment
- Click-to-seek functionality
- Language toggle (Original/Translated)
- Filler word highlighting
- Active segment highlighting

### MagicToolbar

AI-powered features:
- **Remove Fillers**: Toggle to hide/show filler words
- **Make Shorts**: AI-generated short clips
- **Export**: Download in various formats

## State Management

The app uses React hooks for state management:

- `videoData`: Current video information
- `transcripts`: Array of transcript segments
- `currentTime`: Current playback position
- `seekTo`: Programmatic seek control
- `showFillers`: Toggle for filler word visibility
- `language`: Current display language (original/translated)

## Backend Integration

The frontend is designed to work with a backend API. Update the following in production:

1. **Video Upload**: `VideoUploader.jsx` - Update API endpoint
2. **Transcript Fetch**: `App.jsx` - Replace mock data with API call
3. **AI Features**: Implement backend calls for shorts generation

Example API integration:

```javascript
// In VideoUploader.jsx
const response = await axios.post('/api/upload', formData);

// In App.jsx
const data = await axios.get(`/api/analyze/${videoId}`);
setTranscripts(data.transcripts);
```

## Styling

Custom Tailwind theme with dark mode colors:

- `dark-bg`: #0a0a0a (Main background)
- `dark-secondary`: #1a1a1a (Secondary background)
- `dark-border`: #2a2a2a (Border color)
- `neon-blue`: #00d4ff (Primary accent)
- `neon-blue-dim`: #0088aa (Dimmed accent)

## Development Notes

- The app currently uses mock transcript data for development
- Video processing and analysis features need backend integration
- Export functionality is partially implemented (SRT and JSON work)

## License

MIT
