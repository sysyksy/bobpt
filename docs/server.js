const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');

const app = express();
const PORT = 8000; // apiClient.ts에서 기대하는 포트

// CORS 설정 (React 앱에서 접근 가능하도록)
app.use(cors({
  origin: 'http://localhost:5173', // Vite 기본 포트
  credentials: true
}));
app.use(express.json());

// GCS & Firestore 초기화
const storage = new Storage();
const db = new Firestore();
const BUCKET_NAME = 'bob-sto';

console.log('🔧 백엔드 서버 초기화 중...');

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '백엔드 서버 정상 작동 중' });
});

// 1. Firestore에서 프로젝트 데이터 가져오기
app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('📦 프로젝트 데이터 요청:', projectId);

    const docRef = db.collection('projects').doc(projectId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log('❌ 프로젝트를 찾을 수 없음:', projectId);
      return res.status(404).json({ error: 'Project not found' });
    }

    const data = doc.data();
    console.log('✅ 프로젝트 데이터 응답:', {
      id: data.id,
      status: data.status,
      transcriptLength: data.transcript?.length || 0
    });
    
    res.json(data);
  } catch (error) {
    console.error('❌ 프로젝트 조회 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. GCS 서명된 읽기 URL 생성
app.get('/api/generate-read-url/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    console.log('🔗 서명된 URL 생성 요청:', fileName);

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(fileName);

    // 파일 존재 확인
    const [exists] = await file.exists();
    if (!exists) {
      console.log('❌ 파일을 찾을 수 없음:', fileName);
      return res.status(404).json({ error: 'File not found in GCS' });
    }

    // 서명된 URL 생성 (1시간 유효)
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1시간
    });

    console.log('✅ 서명된 URL 생성 완료');
    res.json({ read_url: url }); // apiClient.ts가 기대하는 형식
  } catch (error) {
    console.error('❌ URL 생성 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. 업로드 URL 생성 (향후 사용)
app.post('/api/generate-upload-url', async (req, res) => {
  try {
    const { file_name } = req.query;
    
    if (!file_name) {
      return res.status(400).json({ error: 'file_name is required' });
    }

    console.log('📤 업로드 URL 생성 요청:', file_name);

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(file_name);

    // 서명된 업로드 URL 생성 (1시간 유효)
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 60 * 60 * 1000,
      contentType: 'video/mp4',
    });

    console.log('✅ 업로드 URL 생성 완료');
    res.json({ upload_url: url });
  } catch (error) {
    console.error('❌ 업로드 URL 생성 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🚀 백엔드 서버 실행 중                ║
║  📍 http://localhost:${PORT}              ║
║  🔧 API 엔드포인트:                    ║
║     GET  /api/health                   ║
║     GET  /api/projects/:projectId      ║
║     GET  /api/generate-read-url/:file  ║
║     POST /api/generate-upload-url      ║
╚════════════════════════════════════════╝
  `);
});

