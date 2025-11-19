# BobPT - AI-Powered Video Editor

Document-based video editor inspired by Vrew. Automatically transcribe, translate, and edit videos with AI assistance.

## Project Structure

```
bobpt/
├── frontend/          # React web application
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoUploader.jsx
│   │   │   ├── VideoPlayer.jsx
│   │   │   ├── ScriptEditor.jsx
│   │   │   ├── TranscriptSegment.jsx
│   │   │   └── MagicToolbar.jsx
│   │   ├── App.jsx
│   │   └── index.js
│   └── package.json
└── backend/           # Python API server (coming soon)
```

## Features

### Frontend (React)
- **Dark Mode Interface**: Beautiful dark theme with neon blue accents
- **5:5 Split Layout**: Video player on left, script editor on right
- **Video Upload**: Drag & drop or URL-based import
- **Transcript Editor**: Document-style editing with auto-sync
- **AI Features**:
  - Automatic filler word detection
  - AI-powered shorts generation
  - Speaker identification
- **Export**: SRT, VTT, XML, JSON formats

### Backend (Coming Soon)
- Video analysis and transcription
- Translation services
- AI-powered editing suggestions
- Clip generation for shorts

## Quick Start

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

The app will run at [http://localhost:3000](http://localhost:3000)

### Backend Setup (Coming Soon)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## Tech Stack

### Frontend
- React 18
- Tailwind CSS
- react-player
- axios

### Backend (Planned)
- Python/Flask or FastAPI
- FFmpeg for video processing
- Whisper for transcription
- Translation API

## Development Status

- [x] Frontend structure and components
- [x] Dark mode UI design
- [x] Video player with controls
- [x] Transcript editor with sync
- [x] Basic export functionality
- [ ] Backend API development
- [ ] Video analysis integration
- [ ] AI features implementation
- [ ] Production deployment

## License

MIT
