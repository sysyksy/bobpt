# BobPT Video Editor - Frontend

Modern video editor built with Vite, React, and Tailwind CSS. Features document-based editing inspired by Vrew.

## Tech Stack

- **Vite**: Fast build tool and dev server
- **React 18**: Modern React with hooks
- **Tailwind CSS**: Utility-first styling
- **Zustand**: Lightweight state management
- **React Router**: Client-side routing
- **react-player**: Video playback
- **Axios**: HTTP client for API calls

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Main pages (Home, Editor)
│   ├── store/            # Zustand stores
│   │   └── useVideoStore.js
│   ├── services/         # API service functions
│   │   └── api.js
│   ├── App.jsx           # Router setup
│   ├── main.jsx          # Entry point
│   └── index.css         # Global styles
├── public/               # Static assets
├── index.html            # HTML entry point
├── vite.config.js        # Vite configuration (with API proxy)
├── tailwind.config.js    # Tailwind configuration
└── package.json
```

## Key Features

### State Management (Zustand)

The app uses Zustand for global state management. Main store: `useVideoStore.js`

**State:**
- `currentTime`: Current video playback time (seconds)
- `isPlaying`: Video playback state
- `transcript`: Original transcript (Firestore structure: `start`, `end`, `text`)
- `translatedScript`: Translated transcript
- `fillersRemoved`: Filler removal mode

**Actions:**
- `setCurrentTime()`: Update playback time
- `setIsPlaying()`: Control playback
- `setTranscript()`: Load transcript data
- `toggleFillers()`: Toggle filler removal
- `getActiveSegment()`: Get current active segment

### API Proxy

Vite dev server proxies `/api` requests to `http://localhost:8000` (FastAPI backend).

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

### Editor Page

**Left Panel (5:5 split):**
- `react-player` for video playback
- `onProgress` event updates `currentTime` in store continuously

**Right Panel:**
- Transcript segments mapped from store
- **Active Highlight**: Segments where `start <= currentTime && end >= currentTime` get highlighted
- **Click to Seek**: Clicking a segment calls `playerRef.current.seekTo(segment.start)`

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

App will run at [http://localhost:3000](http://localhost:3000)

API requests to `/api/*` will be proxied to `http://localhost:8000`

### Build for Production

```bash
npm run build
```

Built files will be in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## API Integration

All API calls are in `src/services/api.js`:

- `uploadVideo(file)`: Upload video file
- `getVideoDetails(videoId)`: Get video metadata
- `getTranscript(videoId)`: Get original transcript
- `getTranslatedTranscript(videoId)`: Get translated transcript
- `generateShorts(videoId)`: AI shorts generation
- `exportTranscript(videoId, format)`: Export in SRT/VTT/XML

## Backend Integration

Make sure the FastAPI backend is running on port 8000:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

## Styling

Dark mode theme with custom Tailwind colors:

- `dark-bg`: #0a0a0a
- `dark-secondary`: #1a1a1a
- `dark-border`: #2a2a2a
- `neon-blue`: #00d4ff
- `neon-blue-dim`: #0088aa

## License

MIT
