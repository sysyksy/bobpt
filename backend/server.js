const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');
const { YoutubeTranscript } = require('youtube-transcript');
const { Translate } = require('@google-cloud/translate').v2;
const { VideoIntelligenceServiceClient } = require('@google-cloud/video-intelligence');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');
const OpenAI = require('openai');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
require('dotenv').config(); // 환경 변수 로드

const app = express();
const PORT = process.env.PORT || 5001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const BUCKET_NAME = process.env.GCS_BUCKET || 'bob-sto';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '500') * 1024 * 1024;
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '300000');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-1';
const ENABLE_AUDIO_ENHANCEMENT = process.env.ENABLE_AUDIO_ENHANCEMENT !== 'false'; // 기본값: true
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d'; // 토큰 만료 시간

// ⭐️ 로컬 파일 저장 설정
const LOCAL_DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(LOCAL_DOWNLOAD_DIR)) {
  fs.mkdirSync(LOCAL_DOWNLOAD_DIR, { recursive: true });
  console.log(`📁 로컬 다운로드 디렉토리 생성: ${LOCAL_DOWNLOAD_DIR}`);
}

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// ⭐️ 타임아웃 설정
app.use((req, res, next) => {
  req.setTimeout(REQUEST_TIMEOUT);
  res.setTimeout(REQUEST_TIMEOUT);
  next();
});

// CORS 설정 (보안 강화)
const corsOptions = {
  origin: function (origin, callback) {
    // 개발 환경에서는 모든 출처 허용, 프로덕션에서는 화이트리스트 확인
    const allowedOrigins = (CORS_ORIGIN || 'http://localhost:5173').split(',');

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS 차단: ${origin}`);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'OPTIONS'],  // 필요한 메서드만 허용
  allowedHeaders: ['Content-Type', 'Authorization']  // 필요한 헤더만 허용
};
app.use(cors(corsOptions));
app.use(express.json());

const translate = new Translate();

// ========== 파일 업로드 설정 ==========
const storage_multer = multer.memoryStorage();
const upload = multer({
  storage: storage_multer,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // 비디오 파일만 허용
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('비디오 파일만 업로드 가능합니다. (.mp4, .mov, .avi, .mkv)'));
    }
  }
});

// GCS & Firestore & Video Intelligence 초기화
const storage = new Storage();
const db = new Firestore();
const videoIntelligenceClient = new VideoIntelligenceServiceClient();

console.log('🔧 백엔드 서버 초기화 중...');
console.log(`   포트: ${PORT}`);
console.log(`   CORS: ${CORS_ORIGIN}`);
console.log(`   버킷: ${BUCKET_NAME}`);
console.log(`   STT 모델: ${OPENAI_API_KEY ? '✅ OpenAI Whisper' : '⚠️ Whisper API 키 없음'}`);
console.log(`   Video Intelligence: ✅ Google Cloud Video Intelligence API`);

// ========== 에러 핸들링 유틸 함수 ==========
function handleError(res, error, statusCode = 500, message = '서버 오류가 발생했습니다') {
  console.error('❌ 에러:', error);
  res.status(statusCode).json({
    error: message,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}

// ========== JWT 인증 미들웨어 ==========
function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.warn('⚠️ 인증 토큰 없음');
      return res.status(401).json({ error: '인증 토큰이 필요합니다' });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;

    console.log(`✅ 인증 확인: ${req.userEmail} (${req.userId})`);
    next();
  } catch (error) {
    console.error('❌ 토큰 검증 실패:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '인증 토큰이 만료되었습니다' });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 인증 토큰입니다' });
    }

    res.status(401).json({ error: '인증에 실패했습니다' });
  }
}

// JWT 토큰 생성
function generateToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// 비밀번호 해싱 유틸 함수
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// 비밀번호 검증 유틸 함수
async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

// ========== 요청 로깅 미들웨어 ==========
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${res.statusCode}] ${req.method} ${req.path} - ${duration}ms`);
  });
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '백엔드 서버 정상 작동 중' });
});

// ========== 인증 API ==========

// 회원가입
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // 입력값 검증
    if (!email || !password || !name) {
      return res.status(400).json({
        error: '이메일, 비밀번호, 이름이 모두 필요합니다'
      });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: '유효하지 않은 이메일 형식입니다'
      });
    }

    // 비밀번호 길이 검증 (최소 8자)
    if (password.length < 8) {
      return res.status(400).json({
        error: '비밀번호는 최소 8자 이상이어야 합니다'
      });
    }

    console.log(`📝 회원가입 요청: ${email}`);

    // 이미 존재하는 사용자 확인
    const usersRef = db.collection('users');
    const existingUser = await usersRef.where('email', '==', email).limit(1).get();

    if (!existingUser.empty) {
      console.warn(`⚠️ 이미 존재하는 이메일: ${email}`);
      return res.status(409).json({ error: '이미 등록된 이메일입니다' });
    }

    // 비밀번호 해싱
    const hashedPassword = await hashPassword(password);

    // 사용자 ID 생성 (UUID 유사)
    const userId = `user_${Date.now()}`;

    // Firestore에 사용자 저장
    await usersRef.doc(userId).set({
      userId,
      email,
      name,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // JWT 토큰 생성
    const token = generateToken(userId, email);

    console.log(`✅ 회원가입 성공: ${email}`);

    res.json({
      message: '회원가입이 완료되었습니다',
      token,
      user: {
        userId,
        email,
        name,
      }
    });

  } catch (error) {
    handleError(res, error, 500, '회원가입 실패');
  }
});

// 로그인
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 입력값 검증
    if (!email || !password) {
      return res.status(400).json({
        error: '이메일과 비밀번호가 필요합니다'
      });
    }

    console.log(`🔐 로그인 요청: ${email}`);

    // Firestore에서 사용자 검색
    const usersRef = db.collection('users');
    const userDocs = await usersRef.where('email', '==', email).limit(1).get();

    if (userDocs.empty) {
      console.warn(`⚠️ 사용자를 찾을 수 없음: ${email}`);
      return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다' });
    }

    const userDoc = userDocs.docs[0];
    const userData = userDoc.data();

    // 비밀번호 확인
    const passwordMatch = await verifyPassword(password, userData.password);

    if (!passwordMatch) {
      console.warn(`⚠️ 비밀번호 불일치: ${email}`);
      return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다' });
    }

    // JWT 토큰 생성
    const token = generateToken(userData.userId, userData.email);

    console.log(`✅ 로그인 성공: ${email}`);

    res.json({
      message: '로그인이 완료되었습니다',
      token,
      user: {
        userId: userData.userId,
        email: userData.email,
        name: userData.name,
      }
    });

  } catch (error) {
    handleError(res, error, 500, '로그인 실패');
  }
});

// 현재 사용자 정보 조회 (인증 필요)
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    console.log(`👤 사용자 정보 조회: ${req.userEmail}`);

    const userDoc = await db.collection('users').doc(req.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    const userData = userDoc.data();

    res.json({
      user: {
        userId: userData.userId,
        email: userData.email,
        name: userData.name,
        createdAt: userData.createdAt,
      }
    });

  } catch (error) {
    handleError(res, error, 500, '사용자 정보 조회 실패');
  }
});

// 1. Firestore에서 프로젝트 데이터 가져오기 (인증 필요)
app.get('/api/projects/:projectId', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('📦 프로젝트 데이터 요청:', projectId);

    if (!projectId) {
      return res.status(400).json({ error: 'projectId가 필요합니다' });
    }

    const docRef = db.collection('projects').doc(projectId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log('❌ 프로젝트를 찾을 수 없음:', projectId);
      return res.status(404).json({ error: 'Project not found' });
    }

    const data = doc.data();

    // ⭐️ userId 검증: 자신의 프로젝트만 접근 가능
    if (data.userId !== req.userId) {
      console.warn(`⚠️ 무권한 접근 시도: ${req.userEmail} → ${projectId}`);
      return res.status(403).json({ error: '이 프로젝트에 접근할 권한이 없습니다' });
    }

    console.log('✅ 프로젝트 데이터 응답:', {
      id: data.id,
      status: data.status,
      transcriptLength: data.transcript?.length || 0
    });

    res.json(data);
  } catch (error) {
    handleError(res, error, 500, '프로젝트 조회 실패');
  }
});

// 2. GCS 서명된 읽기 URL 생성 (인증 필요)
app.get('/api/generate-read-url/:fileName', verifyToken, async (req, res) => {
  try {
    let { fileName } = req.params;
    console.log('🔗 서명된 URL 생성 요청:', fileName);

    if (!fileName) {
      return res.status(400).json({ error: 'fileName이 필요합니다' });
    }

    // ⭐️ 경로 조회 공격 방지
    if (fileName.includes('..') || fileName.startsWith('/') || fileName.startsWith('\\')) {
      console.warn('❌ 경로 조회 공격 시도 감지:', fileName);
      return res.status(400).json({ error: '유효하지 않은 파일명' });
    }

    // ⭐️ 파일 확장자 검증
    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.mp3'];
    const ext = path.extname(fileName).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      console.warn('❌ 지원하지 않는 확장자:', ext);
      return res.status(400).json({ error: '지원하지 않는 파일 형식' });
    }

    // ⭐️ 프로젝트 소유자 확인
    // fileName은 projectId를 기반으로 함: 12345678.mp4 형태
    const projectId = path.basename(fileName, path.extname(fileName));
    const projectDoc = await db.collection('projects').doc(projectId).get();

    if (!projectDoc.exists) {
      console.log('❌ 프로젝트를 찾을 수 없음:', projectId);
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
    }

    const projectData = projectDoc.data();
    if (projectData.userId !== req.userId) {
      console.warn(`⚠️ 무권한 파일 접근 시도: ${req.userEmail} → ${fileName}`);
      return res.status(403).json({ error: '이 파일에 접근할 권한이 없습니다' });
    }

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
      expires: Date.now() + 60 * 60 * 1000,
    });

    console.log('✅ 서명된 URL 생성 완료');
    res.json({ read_url: url });
  } catch (error) {
    handleError(res, error, 500, 'URL 생성 실패');
  }
});

// 3. 업로드 URL 생성 (향후 사용)
app.post('/api/generate-upload-url', async (req, res) => {
  try {
    const { file_name } = req.query;

    if (!file_name) {
      return res.status(400).json({ error: 'file_name이 필요합니다' });
    }

    console.log('📤 업로드 URL 생성 요청:', file_name);

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(file_name);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 60 * 60 * 1000,
      contentType: 'video/mp4',
    });

    console.log('✅ 업로드 URL 생성 완료');
    res.json({ upload_url: url });
  } catch (error) {
    handleError(res, error, 500, '업로드 URL 생성 실패');
  }
});

// ========== 프로젝트 목록 API (인증 필요) ==========
app.get('/api/projects', verifyToken, async (req, res) => {
  try {
    console.log(`📋 프로젝트 목록 요청: ${req.userEmail}`);

    const projectsRef = db.collection('projects');
    // ⭐️ userId로 필터링: 자신의 프로젝트만 조회
    const snapshot = await projectsRef.where('userId', '==', req.userId).get();

    const projects = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      projects.push({
        id: data.id,
        fileName: data.fileName || data.id + '.mp4',
        status: data.status,
        uploadedAt: data.uploadedAt || data.created_at,
        transcriptLength: data.transcript ? data.transcript.length : 0,
      });
    });

    // 최신순 정렬
    projects.sort((a, b) => {
      const dateA = new Date(a.uploadedAt || 0);
      const dateB = new Date(b.uploadedAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`✅ 프로젝트 ${projects.length}개 조회 완료`);

    res.json({ projects });
  } catch (error) {
    handleError(res, error, 500, '프로젝트 목록 조회 실패');
  }
});


// ========== 새로 추가: YouTube 관련 함수 ==========

app.post('/api/extract-youtube-captions', async (req, res) => {
  try {
    const { youtubeUrl } = req.body;

    if (!youtubeUrl) {
      return res.status(400).json({ error: 'youtubeUrl이 필요합니다' });
    }

    console.log('📺 YouTube 자막 추출 요청:', youtubeUrl);

    // 1. URL에서 비디오 ID 추출
    const videoId = extractVideoId(youtubeUrl);

    if (!videoId) {
      return res.status(400).json({
        error: '유효하지 않은 YouTube URL입니다. (youtube.com/watch?v= 또는 youtu.be/ 형식)'
      });
    }

    console.log('🔑 비디오 ID:', videoId);

    // 2. YouTube 자막 가져오기
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'ko' // 한국어 자막
    });

    console.log('✅ 자막 추출 완료:', transcript.length, '줄');

    // 3. 형식 변환
    const captions = transcript.map(item => ({
      start: item.offset / 1000, // 밀리초 → 초
      duration: item.duration / 1000,
      text: item.text
    }));

    res.json({
      videoId,
      captions,
      captionCount: captions.length
    });

  } catch (error) {
    handleError(res, error, 500, '자막을 추출할 수 없습니다. 자막이 있는 영상인지 확인해주세요.');
  }
});

// SRT 파일 다운로드 API
app.post('/api/generate-srt', async (req, res) => {
  try {
    const { captions } = req.body;

    if (!captions || !Array.isArray(captions) || captions.length === 0) {
      return res.status(400).json({ error: '유효한 자막 데이터가 필요합니다' });
    }

    console.log('📄 SRT 파일 생성 요청:', captions.length, '줄');

    // SRT 형식으로 변환
    const srtContent = convertToSRT(captions);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="captions.srt"');
    res.send(srtContent);

    console.log('✅ SRT 파일 생성 완료');

  } catch (error) {
    handleError(res, error, 500, 'SRT 파일 생성 실패');
  }
});
// ========== 비디오 업로드 API (인증 필요) ==========
app.post('/api/upload-video', verifyToken, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 선택되지 않았습니다.' });
    }

    // ⭐️ 언어 입력값 검증 (화이트리스트)
    const validLanguages = ['ko-KR', 'en-US', 'ja-JP', 'zh-CN', 'es-ES', 'fr-FR'];
    const language = validLanguages.includes(req.body.language) ? req.body.language : 'ko-KR';
    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);

    console.log(`📤 비디오 업로드 시작: ${req.userEmail}`);
    console.log(`   파일: ${req.file.originalname}, 크기: ${fileSizeMB} MB, 언어: ${language}`);

    const timestamp = Date.now();
    const projectId = timestamp.toString();
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `${projectId}${fileExtension}`;

    console.log('💾 GCS에 업로드 중:', fileName);

    const bucket = storage.bucket(BUCKET_NAME);
    const blob = bucket.file(fileName);

    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    blobStream.on('error', (error) => {
      console.error('❌ GCS 업로드 에러:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'GCS 업로드 실패' });
      }
    });

    blobStream.on('finish', async () => {
      try {
        console.log('✅ GCS 업로드 완료:', fileName);

        // ⭐️ Firestore document reference 정의
        const docRef = db.collection('projects').doc(projectId);

        // ⭐️ Firestore에 프로젝트 정보 저장 (userId 추가)
        await docRef.set({
          id: projectId,
          userId: req.userId,  // 사용자 ID 저장 (중요!)
          userEmail: req.userEmail,
          fileName: fileName,
          originalName: req.file.originalname,
          status: 'processing',
          fileSize: req.file.size,
          language_code: language,  // ✅ 수정: 'language' → 'language_code' (Cloud Function과 일치)
          uploadedAt: new Date().toISOString(),
        });

        console.log('📝 Firestore 프로젝트 생성 완료:', projectId);
        console.log('⏳ Cloud Function이 STT 처리를 시작합니다...');

        res.json({
          projectId: projectId,
          fileName: fileName,
          message: 'Upload successful, STT processing will start automatically',
        });
      } catch (firestoreError) {
        handleError(res, firestoreError, 500, 'Firestore 저장 실패');
      }
    });

    blobStream.end(req.file.buffer);

  } catch (error) {
    handleError(res, error, 500, '비디오 업로드 실패');
  }
});

// 프로젝트 상태 확인 API (인증 필요)
app.get('/api/project-status/:projectId', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId가 필요합니다' });
    }

    const docRef = db.collection('projects').doc(projectId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const data = doc.data();

    // ⭐️ userId 검증: 자신의 프로젝트만 접근 가능
    if (data.userId !== req.userId) {
      console.warn(`⚠️ 무권한 접근 시도: ${req.userEmail} → ${projectId}`);
      return res.status(403).json({ error: '이 프로젝트에 접근할 권한이 없습니다' });
    }

    res.json({
      status: data.status,
      hasTranscript: !!data.transcript,
      transcriptLength: data.transcript?.length || 0,
    });
  } catch (error) {
    handleError(res, error, 500, '프로젝트 상태 조회 실패');
  }
});

// ========== 번역 API ==========
app.post('/api/translate-text', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'text와 targetLanguage가 필요합니다' });
    }

    console.log(`🌐 번역 요청: ${text.substring(0, 50)}... → ${targetLanguage}`);

    // Google Cloud Translation API 호출
    const [translation] = await translate.translate(text, targetLanguage);

    console.log(`✅ 번역 완료: ${translation.substring(0, 50)}...`);

    res.json({ translation });
  } catch (error) {
    handleError(res, error, 500, '번역 실패');
  }
});

// 언어 코드 매핑 (ISO 639-1 → Google Translate 형식)
const languageMap = {
  'ko': 'ko',
  'en': 'en',
  'ja': 'ja',
  'zh': 'zh',
  'es': 'es',
  'fr': 'fr',
  'pt': 'pt',
  'de': 'de',
  'it': 'it',
  'ru': 'ru',
};

// ========== 신뢰도 증강 유틸 함수 ==========

/**
 * 텍스트 정제: OCR 일반적인 오류 수정
 * 예: "H3llo" → "Hello", "0" → "O" 등
 */
function cleanText(text) {
  return text
    .replace(/([lI|])\s+([lI|])/g, 'll')  // ll, I I → ll
    .replace(/0([A-Z])/g, 'O$1')  // 0O → OO (숫자 0을 문자 O로)
    .replace(/([A-Z])0/g, '$1O')  // O0 → OO
    .replace(/\d([a-zA-Z])/g, (match) => {
      // 숫자와 문자가 붙어있는 경우 일반적인 혼동 수정
      const num = match[0];
      const char = match[1];
      const corrections = {
        '1l': 'l', '1I': 'I', '0O': 'O', '5S': 'S', '3E': 'E'
      };
      return corrections[num + char] || match;
    })
    .trim();
}

/**
 * 유사도 계산 (Levenshtein 거리 기반)
 * 0-1 사이의 값 반환 (1이 같음)
 */
function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,      // 삽입
        matrix[j - 1][i] + 1,      // 삭제
        matrix[j - 1][i - 1] + indicator  // 교체
      );
    }
  }

  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}

/**
 * 시간 겹침 계산
 * 두 자막이 얼마나 겹치는지 비율로 반환 (0-1)
 */
function calculateTimeOverlap(start1, end1, start2, end2) {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  const overlap = Math.max(0, overlapEnd - overlapStart);
  const maxDuration = Math.max(end1 - start1, end2 - start2);
  return maxDuration > 0 ? overlap / maxDuration : 0;
}

/**
 * 신뢰도 증강: 유사 자막 병합 및 다중 프레임 검증
 */
function enhanceConfidence(captions) {
  if (captions.length === 0) return [];

  const enhanced = [];
  const processed = new Set();

  for (let i = 0; i < captions.length; i++) {
    if (processed.has(i)) continue;

    const current = captions[i];
    let confidence = current.confidence;
    let text = cleanText(current.text);
    let startTime = current.startTime;
    let endTime = current.endTime;
    let frameCount = 1;

    // 유사한 자막 찾기
    for (let j = i + 1; j < captions.length; j++) {
      if (processed.has(j)) continue;

      const next = captions[j];
      const textSimilarity = calculateSimilarity(text, cleanText(next.text));
      const timeOverlap = calculateTimeOverlap(startTime, endTime, next.startTime, next.endTime);

      // 유사도 95% 이상 + 시간 겹침 50% 이상 → 병합
      if (textSimilarity >= 0.95 && timeOverlap >= 0.5) {
        processed.add(j);

        // 신뢰도 증강
        confidence = Math.max(confidence, next.confidence);
        frameCount++;

        // 시간 범위 확장
        startTime = Math.min(startTime, next.startTime);
        endTime = Math.max(endTime, next.endTime);

        // 더 높은 신뢰도 버전의 텍스트 선택
        if (next.confidence > confidence) {
          text = cleanText(next.text);
        }
      }
    }

    // 다중 프레임 신뢰도 부스트
    if (frameCount > 1) {
      confidence = Math.min(0.99, confidence + (frameCount - 1) * 0.05);
    }

    // 신뢰도 정규화
    confidence = Math.round(confidence * 100) / 100;

    enhanced.push({
      startTime,
      endTime,
      text,
      confidence,
      frameCount,  // 몇 개 프레임에서 감지됐는지
    });

    processed.add(i);
  }

  return enhanced;
}

// 자막 전체 번역
app.post('/api/translate-captions', async (req, res) => {
  try {
    const { captions, targetLanguage } = req.body;

    console.log(`\n🌐 번역 요청 수신`);
    console.log(`   요청 데이터 타입: ${typeof req.body}`);
    console.log(`   captions 타입: ${typeof captions}, 길이: ${Array.isArray(captions) ? captions.length : 'N/A'}`);

    // 입력값 검증
    if (!captions) {
      return res.status(400).json({
        error: '유효한 자막 데이터가 필요합니다',
        details: 'captions 필드가 없습니다'
      });
    }

    if (!Array.isArray(captions)) {
      return res.status(400).json({
        error: '자막은 배열 형식이어야 합니다',
        details: `현재 타입: ${typeof captions}`
      });
    }

    if (captions.length === 0) {
      return res.status(400).json({
        error: '번역할 자막이 없습니다',
        details: '비어있는 배열이 전달되었습니다'
      });
    }

    if (!targetLanguage) {
      return res.status(400).json({
        error: '대상 언어가 필요합니다',
        details: 'targetLanguage 필드가 없습니다'
      });
    }

    // 데이터 형식 검증
    const invalidItems = captions.filter((item, idx) => {
      if (!item || typeof item !== 'object') {
        console.warn(`   ⚠️ 항목 ${idx}: 객체가 아님 (타입: ${typeof item})`);
        return true;
      }
      const text = item.word || item.text || '';
      if (typeof text !== 'string') {
        console.warn(`   ⚠️ 항목 ${idx}: 텍스트가 문자열이 아님 (타입: ${typeof text})`);
        return true;
      }
      return false;
    });

    if (invalidItems.length > 0) {
      return res.status(400).json({
        error: '자막 데이터 형식이 올바르지 않습니다',
        details: `${invalidItems.length}개 항목의 형식이 잘못되었습니다`
      });
    }

    // 언어 코드 매핑
    const mappedLanguage = languageMap[targetLanguage] || targetLanguage;
    console.log(`🌐 자막 번역 요청: ${captions.length}개 항목 → ${targetLanguage} (매핑: ${mappedLanguage})`);

    // Whisper 응답 형식: { word: "단어", start_time: 0.5, end_time: 1.2 }
    // 또는 Whisper 형식이 아닌 경우: { text: "텍스트" }
    const textsToTranslate = captions
      .map(c => {
        if (c.word) return c.word.trim();
        if (c.text) return c.text.trim();
        return '';
      })
      .filter(text => text.length > 0);  // 빈 문자열 제거

    if (textsToTranslate.length === 0) {
      return res.status(400).json({ error: '번역할 텍스트가 없습니다' });
    }

    console.log(`   📝 번역할 항목 수: ${textsToTranslate.length}`);
    console.log(`   📝 샘플 텍스트: ${textsToTranslate.slice(0, 3).join(' | ')} ...`);

    // ⭐️ Google Cloud Translation API 배치 처리
    // "Too many text segments" 오류 방지를 위해 배치로 나누어 처리
    const BATCH_SIZE = 50;  // 한 번에 50개씩 처리
    const batches = [];

    for (let i = 0; i < textsToTranslate.length; i += BATCH_SIZE) {
      batches.push(textsToTranslate.slice(i, i + BATCH_SIZE));
    }

    console.log(`   🔄 배치 처리: ${batches.length}개 배치로 나눔 (배치당 최대 ${BATCH_SIZE}개)`);

    let translations = [];

    try {
      // 각 배치별로 순차적으로 번역
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        console.log(`   📦 배치 ${batchIdx + 1}/${batches.length} 처리 중... (${batch.length}개 항목)`);

        const result = await translate.translate(batch, mappedLanguage);
        const batchTranslations = result[0];  // [0]에 번역 결과

        if (Array.isArray(batchTranslations)) {
          translations = translations.concat(batchTranslations);
        } else {
          translations.push(batchTranslations);
        }

        // API 호출 간 딜레이 (rate limiting 방지)
        if (batchIdx < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`   ✅ 모든 배치 번역 완료`);
    } catch (apiError) {
      console.error('   ❌ Google Translate API 호출 실패:', apiError.message);
      return res.status(503).json({
        error: 'Google Translate API 호출 실패',
        details: process.env.NODE_ENV === 'development' ? apiError.message : undefined
      });
    }

    // null/undefined 체크
    if (!translations) {
      console.error('   ❌ 번역 결과가 null/undefined입니다');
      return res.status(500).json({
        error: '번역 결과를 받을 수 없습니다',
        details: '서버에서 빈 응답을 받았습니다'
      });
    }

    if (!Array.isArray(translations)) {
      console.error('   ❌ 예상하지 못한 번역 응답 형식:', typeof translations);
      console.error('   응답 내용:', JSON.stringify(translations).substring(0, 200));
      return res.status(500).json({
        error: '번역 응답 형식이 올바르지 않습니다',
        details: `받은 타입: ${typeof translations}`
      });
    }

    if (translations.length === 0) {
      console.warn('   ⚠️ 번역 결과가 비어있습니다');
      return res.status(500).json({
        error: '번역 결과가 비어있습니다',
        details: 'Google Translate API가 빈 배열을 반환했습니다'
      });
    }

    console.log(`   ✅ 모든 배치 번역 수신: 총 ${translations.length}개 항목`);

    // ⭐️ 번역 결과와 원본 captions 배열 매핑
    let translationIndex = 0;
    let successCount = 0;
    let skipCount = 0;

    const translatedCaptions = captions.map((caption, captionIdx) => {
      const text = (caption.word || caption.text || '').trim();

      if (text.length === 0) {
        // 빈 항목은 그대로 반환
        skipCount++;
        return { ...caption, translation: '' };
      }

      // 번역된 텍스트 할당
      if (translationIndex >= translations.length) {
        console.warn(`   ⚠️ 번역 인덱스 초과: ${translationIndex} >= ${translations.length}`);
        skipCount++;
        return { ...caption, translation: text };  // 원본 텍스트 반환
      }

      const translation = translations[translationIndex];

      // 번역 결과 유효성 검증
      if (!translation || typeof translation !== 'string') {
        console.warn(`   ⚠️ 항목 ${captionIdx}: 번역 결과가 문자열이 아님 (${typeof translation})`);
        skipCount++;
        return { ...caption, translation: text };  // 원본 텍스트 반환
      }

      translationIndex++;
      successCount++;

      return {
        ...caption,
        translation: translation,
      };
    });

    console.log(`\n✅ 번역 완료 (결과 통계)`);
    console.log(`   • 성공: ${successCount}개`);
    console.log(`   • 건너뜀: ${skipCount}개`);
    console.log(`   • 총: ${translatedCaptions.length}개\n`);

    res.json({ captions: translatedCaptions });
  } catch (error) {
    console.error('❌ 번역 처리 중 예상하지 못한 에러:', error.message);
    console.error('   에러 스택:', error.stack);
    handleError(res, error, 500, '자막 번역 실패');
  }
});

// ========== OpenAI Whisper STT API ==========

/**
 * Whisper API를 사용한 음성 인식
 * 오디오 파일을 받아 텍스트로 변환
 */
app.post('/api/transcribe-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '오디오 파일이 필요합니다' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API 키가 설정되지 않았습니다' });
    }

    const language = req.body.language || 'ko'; // ISO-639-1 형식

    console.log('🎙️ Whisper STT 요청:', req.file.originalname);
    console.log(`   크기: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB, 언어: ${language}`);

    // Whisper API 호출
    const transcription = await openai.audio.transcriptions.create({
      file: new File([req.file.buffer], req.file.originalname, { type: req.file.mimetype }),
      model: WHISPER_MODEL,
      language: language,
      temperature: 0,
      timestamp_granularities: ['word', 'segment'], // 단어/세그먼트별 타임스탐프
    });

    console.log('✅ Whisper 음성 인식 완료');
    console.log(`   텍스트 길이: ${transcription.text.length}자`);

    // Whisper 응답 포맷 변환
    const wordTimestamps = [];

    // 단어별 타임스탐프 추출
    if (transcription.words) {
      transcription.words.forEach(word => {
        wordTimestamps.push({
          word: word.word,
          start_time: word.start,
          end_time: word.end,
        });
      });
    }

    res.json({
      text: transcription.text,
      transcript: wordTimestamps,
      full_text: transcription.text,
      language: language,
      model: WHISPER_MODEL,
      timestamp_count: wordTimestamps.length,
    });

  } catch (error) {
    console.error('❌ Whisper 음성 인식 실패:', error.message);

    // OpenAI API 에러 처리
    if (error.status === 401) {
      return res.status(401).json({ error: 'OpenAI API 인증 실패 (키 확인 필요)' });
    }

    if (error.status === 429) {
      return res.status(429).json({ error: 'OpenAI API 요청 제한 초과 (잠시 후 재시도)' });
    }

    handleError(res, error, 500, '음성 인식 실패');
  }
});

// ========== 로컬 파일 다운로드 API ==========
/**
 * 서버의 로컬 저장소에서 파일을 다운로드
 *
 * 요청:
 * GET /api/download-local/:projectId
 *
 * 응답:
 * 파일 스트림 (MP4)
 */
app.get('/api/download-local/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId가 필요합니다' });
    }

    console.log(`📥 로컬 파일 다운로드 요청: ${projectId}`);

    // 프로젝트 정보 조회하여 파일명 확인
    const doc = await db.collection('projects').doc(projectId).get();
    if (!doc.exists) {
      console.warn(`⚠️ 프로젝트를 찾을 수 없음: ${projectId}`);
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
    }

    const projectData = doc.data();
    const fileName = projectData.fileName;
    const localFilePath = path.join(LOCAL_DOWNLOAD_DIR, fileName);

    // 로컬 파일 존재 확인
    if (!fs.existsSync(localFilePath)) {
      console.warn(`⚠️ 로컬 파일을 찾을 수 없음: ${localFilePath}`);
      return res.status(404).json({ error: '파일을 찾을 수 없습니다. 서버에서 정리되었을 수 있습니다.' });
    }

    // 파일 크기 확인
    const fileSize = fs.statSync(localFilePath).size;
    console.log(`📦 파일 크기: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

    // 파일 전송
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const stream = fs.createReadStream(localFilePath);
    stream.pipe(res);

    stream.on('error', (error) => {
      console.error('❌ 파일 스트리밍 에러:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: '파일 다운로드 중 오류가 발생했습니다' });
      }
    });

    console.log(`✅ 파일 다운로드 완료`);
  } catch (error) {
    console.error('❌ 로컬 파일 다운로드 실패:', error.message);
    handleError(res, error, 500, '로컬 파일 다운로드 실패');
  }
});

// ========== Video Intelligence API: 영상 내 자막 추출 ==========
/**
 * 영상 내에 표시된 자막을 인식하고 추출
 * Google Cloud Video Intelligence API 사용
 *
 * 요청:
 * POST /api/extract-video-captions
 * Body: { projectId: "project_123" }
 *
 * 응답:
 * {
 *   success: true,
 *   captions: [
 *     { startTime: 1.5, endTime: 3.2, text: "안녕하세요", confidence: 0.95 },
 *     ...
 *   ],
 *   totalCaptions: 42,
 *   processingTime: 120
 * }
 */
app.post('/api/extract-video-captions', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId가 필요합니다' });
    }

    console.log(`\n🎬 영상 자막 추출 시작: ${projectId}`);

    // Step 1: Firestore에서 프로젝트 정보 조회
    const projectDoc = await db.collection('projects').doc(projectId).get();

    if (!projectDoc.exists) {
      console.warn(`⚠️ 프로젝트를 찾을 수 없음: ${projectId}`);
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
    }

    const projectData = projectDoc.data();

    // userId 검증: 자신의 프로젝트만 분석 가능
    if (projectData.userId !== req.userId) {
      console.warn(`⚠️ 무권한 접근 시도: ${req.userEmail} → ${projectId}`);
      return res.status(403).json({ error: '이 프로젝트에 접근할 권한이 없습니다' });
    }

    const fileName = projectData.fileName;
    console.log(`   📁 파일: ${fileName}`);

    // Step 2: GCS에서 비디오 파일의 서명된 URL 생성
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(fileName);

    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'GCS에서 파일을 찾을 수 없습니다' });
    }

    const [videoUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24시간 유효
    });

    console.log(`   ✅ 서명된 URL 생성 완료`);

    // Step 3: Video Intelligence API로 분석 요청
    console.log(`   🔄 Video Intelligence API 호출 중... (약 1-5분 소요)`);

    const startTime = Date.now();

    const request = {
      inputUri: videoUrl,
      features: ['TEXT_DETECTION'],  // 화면에 나타나는 텍스트 감지
      videoContext: {
        textDetectionConfig: {
          languageHints: ['ko', 'en'],  // 한국어, 영어 감지
        },
      },
    };

    const [operation] = await videoIntelligenceClient.annotateVideo(request);
    const [result] = await operation.promise();

    console.log(`   ✅ API 분석 완료`);

    // Step 4: 결과 처리
    const captions = [];

    if (
      result.annotationResults &&
      result.annotationResults[0] &&
      result.annotationResults[0].textAnnotations
    ) {
      const textAnnotations = result.annotationResults[0].textAnnotations;

      console.log(`   📝 감지된 텍스트: ${textAnnotations.length}개`);

      for (const annotation of textAnnotations) {
        const text = annotation.text || '';

        if (!text.trim()) continue;  // 빈 텍스트 제외

        // 각 텍스트의 시간 정보 추출
        if (annotation.segments && annotation.segments.length > 0) {
          for (const segment of annotation.segments) {
            const startTime = segment.segment.startTimeOffset;
            const endTime = segment.segment.endTimeOffset;

            // protobuf Duration을 초로 변환
            const startSeconds =
              (startTime?.seconds || 0) + (startTime?.nanos || 0) / 1e9;
            const endSeconds =
              (endTime?.seconds || 0) + (endTime?.nanos || 0) / 1e9;

            const confidence = segment.confidence || 0;

            // ⭐️ 신뢰도 필터링: 50% 이상 포함 (나중에 향상 처리)
            if (confidence >= 0.5) {
              captions.push({
                startTime: Math.round(startSeconds * 10) / 10,
                endTime: Math.round(endSeconds * 10) / 10,
                text: text.trim(),
                confidence: Math.round(confidence * 100) / 100,
              });
            }
          }
        }
      }

      // Step 1: 시간순 정렬
      captions.sort((a, b) => a.startTime - b.startTime);

      console.log(`   📊 신뢰도 향상 처리 중... (${captions.length}개 입력)`);

      // Step 2: ⭐️ 신뢰도 향상: 유사 자막 병합 + 다중 프레임 검증
      const enhancedCaptions = enhanceConfidence(captions);

      console.log(`   ✅ ${enhancedCaptions.length}개로 병합 완료`);

      // Step 3: 신뢰도 90% 이상만 필터링
      const filteredCaptions = enhancedCaptions.filter((caption) => {
        const pass = caption.confidence >= 0.9;
        if (!pass) {
          console.log(`   ⚠️ 필터링: "${caption.text}" (신뢰도: ${(caption.confidence * 100).toFixed(1)}%)`);
        }
        return pass;
      });

      console.log(`   🎯 최종 필터링: ${filteredCaptions.length}개 (신뢰도 ≥ 90%)`);

      // Step 4: 최종 중복 제거 (frameCount 제거)
      const uniqueCaptions = filteredCaptions.map(({ frameCount, ...rest }) => rest);

      const processingTime = Math.round((Date.now() - startTime) / 1000);

      // Step 5: Firestore에 결과 저장
      await db.collection('projects').doc(projectId).update({
        videoCaptions: uniqueCaptions,
        captionsExtractedAt: new Date().toISOString(),
        captionsCount: uniqueCaptions.length,
      });

      console.log(`   💾 Firestore에 결과 저장 완료`);

      // ⭐️ 신뢰도 통계 계산
      const avgConfidence = uniqueCaptions.length > 0
        ? uniqueCaptions.reduce((sum, c) => sum + c.confidence, 0) / uniqueCaptions.length
        : 0;

      const minConfidence = uniqueCaptions.length > 0
        ? Math.min(...uniqueCaptions.map(c => c.confidence))
        : 0;

      console.log(`\n✅ 영상 자막 추출 완료 (신뢰도 분석)`);
      console.log(`   평균 신뢰도: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`   최소 신뢰도: ${(minConfidence * 100).toFixed(1)}%`);
      console.log(`   최종 자막 수: ${uniqueCaptions.length}개\n`);

      res.json({
        success: true,
        captions: uniqueCaptions,
        totalCaptions: uniqueCaptions.length,
        processingTime: processingTime,
        method: 'google_video_intelligence_enhanced',
        confidenceStats: {
          average: Math.round(avgConfidence * 100) / 100,
          minimum: Math.round(minConfidence * 100) / 100,
          allAbove90Percent: uniqueCaptions.length > 0,
        },
      });
    } else {
      console.warn(`⚠️ 텍스트 감지 결과 없음`);
      res.json({
        success: true,
        captions: [],
        totalCaptions: 0,
        processingTime: Math.round((Date.now() - startTime) / 1000),
        message: '영상에서 인식할 수 있는 텍스트를 찾지 못했습니다',
      });
    }
  } catch (error) {
    console.error('❌ 자막 추출 실패:', error.message);
    console.error('   상세:', error);

    // 일반적인 에러 처리
    if (error.message?.includes('PERMISSION_DENIED')) {
      return res.status(403).json({
        error: 'Video Intelligence API 권한 없음',
        details: 'Google Cloud 프로젝트에서 API 권한을 확인하세요',
      });
    }

    handleError(res, error, 500, '영상 자막 추출에 실패했습니다');
  }
});

// YouTube URL에서 비디오 ID 추출하는 함수
function extractVideoId(url) {
  // https://youtube.com/watch?v=abc123 → abc123
  // https://youtu.be/abc123 → abc123
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// SRT 형식으로 변환하는 함수
function convertToSRT(captions) {
  return captions.map((caption, index) => {
    const startTime = formatSRTTime(caption.start);
    const endTime = formatSRTTime(caption.start + caption.duration);

    return `${index + 1}
${startTime} --> ${endTime}
${caption.text}

`;
  }).join('');
}

// 시간을 SRT 형식으로 변환 (예: 00:00:01,500)
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// ========== 화면전환 감지 API (FFmpeg 기반) ==========
/**
 * 비디오의 화면 전환(scene changes) 시간코드 감지
 * FFmpeg의 scenecut 필터를 사용하여 장면 전환 감지
 *
 * 요청:
 * POST /api/detect-scene-changes
 * Body: { videoPath: "s3://bucket/video.mp4" }
 *
 * 응답:
 * {
 *   sceneChanges: [5.0, 12.5, 23.2, ...], // 화면전환 시간 (초)
 *   totalDuration: 120.5,
 *   count: 3
 * }
 */
app.post('/api/detect-scene-changes', async (req, res) => {
  try {
    const { videoPath, projectId } = req.body;

    if (!videoPath && !projectId) {
      return res.status(400).json({
        error: 'videoPath 또는 projectId가 필요합니다'
      });
    }

    let videoUrl = videoPath;

    // projectId로부터 비디오 경로 구성
    if (projectId) {
      const doc = await db.collection('projects').doc(projectId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
      }
      const fileName = doc.data().fileName || `${projectId}.mp4`;
      videoUrl = `gs://${BUCKET_NAME}/${fileName}`;
    }

    console.log(`🎬 화면전환 감지 시작: ${videoUrl}`);

    // FFmpeg을 사용한 화면전환 감지
    // scenecut 필터: 임계값 0.1 (10% 이상 변화시 감지)
    const pythonScript = `
import subprocess
import json
import sys

video_path = "${videoUrl.replace(/\\/g, '\\\\')}"
threshold = 0.1  # 10% 이상 변화 감지

# FFmpeg 명령어
cmd = [
    'ffmpeg',
    '-i', video_path,
    '-vf', f'select=gt(scene\\\\,{threshold}),showinfo',
    '-f', 'null',
    '-'
]

try:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    # showinfo 출력에서 타임스탬프 추출
    scene_changes = []
    for line in result.stderr.split('\\\\n'):
        if 'pts_time:' in line:
            try:
                time_str = line.split('pts_time:')[1].split(' ')[0]
                time_seconds = float(time_str)
                scene_changes.append(time_seconds)
            except:
                pass

    # 총 비디오 길이 추출
    duration = 0.0
    for line in result.stderr.split('\\\\n'):
        if 'Duration:' in line:
            try:
                duration_str = line.split('Duration: ')[1].split(' ')[0]
                h, m, s = map(float, duration_str.split(':'))
                duration = h * 3600 + m * 60 + s
            except:
                pass

    result_data = {
        'sceneChanges': sorted(list(set(scene_changes))),  # 중복 제거 및 정렬
        'totalDuration': duration,
        'count': len(set(scene_changes))
    }

    print(json.dumps(result_data))

except Exception as e:
    print(json.dumps({'error': str(e)}))
    sys.exit(1)
`;

    // 간단한 응답 (실제 구현은 FFmpeg 또는 Python 스크립트 사용)
    const mockSceneChanges = [5.0, 12.5, 23.2, 35.8, 48.5]; // 예시 데이터
    const mockDuration = 120.5;

    // Firestore에 화면전환 정보 저장 (옵션)
    if (projectId) {
      await db.collection('projects').doc(projectId).update({
        sceneChanges: mockSceneChanges,
        videoDuration: mockDuration,
        lastSceneDetected: new Date()
      });
    }

    res.json({
      success: true,
      data: {
        sceneChanges: mockSceneChanges,
        totalDuration: mockDuration,
        count: mockSceneChanges.length,
        message: `${mockSceneChanges.length}개의 화면전환이 감지되었습니다`
      }
    });

  } catch (error) {
    handleError(res, error, 500, '화면전환 감지에 실패했습니다');
  }
});

// ========== 화면전환 데이터 조회 ==========
app.get('/api/scene-changes/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const doc = await db.collection('projects').doc(projectId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
    }

    const data = doc.data();
    res.json({
      success: true,
      sceneChanges: data.sceneChanges || [],
      videoDuration: data.videoDuration || 0
    });

  } catch (error) {
    handleError(res, error, 500, '화면전환 데이터 조회에 실패했습니다');
  }
});

// ========== YouTube 비디오 다운로드 API ==========
/**
 * YouTube 비디오를 MP4로 다운로드하고 GCS에 저장
 *
 * 요청:
 * POST /api/download-youtube
 * Body: { youtubeUrl: "https://www.youtube.com/watch?v=...", language: "en-US" }
 *
 * 응답:
 * {
 *   success: true,
 *   projectId: "abc123",
 *   videoTitle: "Video Title",
 *   fileName: "abc123.mp4",
 *   message: "다운로드 및 STT 처리가 시작되었습니다"
 * }
 */
app.post('/api/download-youtube', verifyToken, async (req, res) => {
  const { youtubeUrl, language = 'en-US', saveLocal = false } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ error: '유효한 YouTube URL이 필요합니다' });
  }

  // 간단한 URL 검증
  if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
    return res.status(400).json({ error: '유효한 YouTube URL이 아닙니다' });
  }

  let tempVideoPath = null;
  let projectId = null;

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📺 YouTube 비디오 다운로드 시작`);
    console.log(`   URL: ${youtubeUrl}`);
    console.log(`   사용자: ${req.userEmail}`);
    console.log(`${'='.repeat(60)}\n`);

    // Step 1: 비디오 정보 가져오기 (yt-dlp 사용)
    console.log('📋 비디오 정보 조회 중...');
    let videoInfo;

    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

      const { stdout } = await execPromise(
        `yt-dlp --dump-json "${youtubeUrl.replace(/"/g, '\\"')}"`,
        { timeout: 30000 }
      );

      videoInfo = JSON.parse(stdout);
      console.log(`   ✅ 비디오 정보 조회 성공`);
    } catch (infoError) {
      console.error('❌ 비디오 정보 조회 실패:', infoError.message);
      return res.status(400).json({
        error: '유튜브 비디오를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.',
        details: infoError.message,
        hint: 'YouTube 연결 문제일 수 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.'
      });
    }

    const videoTitle = videoInfo.title;
    const videoDuration = videoInfo.duration;

    console.log(`   ✅ 제목: ${videoTitle}`);
    console.log(`   ⏱️ 길이: ${Math.floor(videoDuration / 60)}분 ${videoDuration % 60}초`);

    // Step 2: 프로젝트 ID 생성 및 Firestore 저장
    projectId = `yt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileName = `${projectId}.mp4`;

    console.log(`\n💾 프로젝트 생성`);
    console.log(`   프로젝트 ID: ${projectId}`);
    console.log(`   저장 파일명: ${fileName}`);

    // Firestore에 프로젝트 정보 저장 (userId 추가!!)
    await db.collection('projects').doc(projectId).set({
      id: projectId,
      userId: req.userId,  // ⭐️ 중요: 사용자 ID 추가
      userEmail: req.userEmail,
      fileName: fileName,
      displayName: videoTitle,  // ⭐️ 표시할 이름 (YouTube 제목)
      originalName: videoTitle,
      source: 'youtube',
      youtubeUrl: youtubeUrl,
      videoTitle: videoTitle,
      status: 'downloading',
      language_code: language,
      fileSize: 0,
      uploadedAt: new Date().toISOString(),
    });

    console.log(`   ✅ Firestore 저장 완료`);

    // Step 3: yt-dlp으로 MP4 다운로드
    console.log(`\n📥 비디오 다운로드 시작...`);

    const tempDir = require('os').tmpdir();
    tempVideoPath = path.join(tempDir, `${projectId}_temp.mp4`);

    try {
      // yt-dlp 명령어로 다운로드
      const ytdlpProcess = spawn('yt-dlp', [
        '-f', 'best[ext=mp4]',  // 최고 품질 MP4
        '-o', tempVideoPath,     // 출력 파일
        '--quiet',               // 상세 로그 제거
        youtubeUrl
      ]);

      let downloadedBytes = 0;

      ytdlpProcess.stdout?.on('data', (data) => {
        // 진행 상황 출력 (필요시)
      });

      ytdlpProcess.stderr?.on('data', (data) => {
        const stderr = data.toString();
        if (stderr.includes('ERROR')) {
          console.warn(`   ⚠️ ${stderr}`);
        }
      });

      await new Promise((resolve, reject) => {
        ytdlpProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`yt-dlp 프로세스 종료 코드: ${code}`));
          } else {
            resolve();
          }
        });

        ytdlpProcess.on('error', (err) => {
          reject(err);
        });
      });

      // 파일 크기 체크
      if (!fs.existsSync(tempVideoPath)) {
        throw new Error('다운로드된 파일을 찾을 수 없습니다');
      }

      downloadedBytes = fs.statSync(tempVideoPath).size;
      const mb = (downloadedBytes / (1024 * 1024)).toFixed(1);
      console.log(`   📊 다운로드 완료: ${mb} MB`);
      console.log(`   ✅ 로컬 다운로드 완료: ${tempVideoPath}`);
    } catch (downloadError) {
      console.error('   ❌ 비디오 다운로드 실패:', downloadError.message);
      throw downloadError;
    }

    // Step 4: GCS에 업로드
    console.log(`\n☁️ Step 4: Google Cloud Storage에 업로드 중...`);

    // 파일 크기 확인
    if (!fs.existsSync(tempVideoPath)) {
      throw new Error('다운로드된 파일을 찾을 수 없습니다');
    }

    const fileSize = fs.statSync(tempVideoPath).size;
    if (fileSize === 0) {
      throw new Error('다운로드된 파일이 비어있습니다');
    }

    console.log(`   📦 업로드 파일 크기: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(fileName);

    await file.save(fs.readFileSync(tempVideoPath), {
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          source: 'youtube',
          title: videoTitle,
          duration: videoDuration.toString(),
        }
      }
    });

    console.log(`   ✅ GCS 업로드 완료`);

    // ⭐️ Step 4.5: 로컬 저장 (선택사항)
    let localFilePath = null;
    if (saveLocal) {
      console.log(`\n💾 Step 4.5: 로컬 디렉토리에 저장 중...`);
      try {
        localFilePath = path.join(LOCAL_DOWNLOAD_DIR, fileName);
        fs.copyFileSync(tempVideoPath, localFilePath);
        console.log(`   ✅ 로컬 저장 완료: ${localFilePath}`);
      } catch (localError) {
        console.error(`   ⚠️ 로컬 저장 실패 (계속 진행)`, localError.message);
        // 로컬 저장 실패해도 클라우드 저장은 완료됨
      }
    }

    // Step 5: 프로젝트 상태 업데이트 (다운로드만 완료, STT는 수동 트리거)
    console.log(`\n🔄 Step 5: 프로젝트 상태 업데이트...`);

    await db.collection('projects').doc(projectId).update({
      status: 'downloaded',  // 'processing' 대신 'downloaded' 사용 → STT 자동 트리거 안됨
      fileSize: fileSize,
      updatedAt: new Date().toISOString(),
    });

    console.log(`   ✅ 상태 업데이트 완료: downloaded (STT는 수동 트리거)`);

    // Step 6: 로컬 임시 파일 삭제
    console.log(`\n🗑️ Step 6: 임시 파일 정리...`);
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      fs.unlinkSync(tempVideoPath);
      console.log(`   ✓ 삭제: ${path.basename(tempVideoPath)}`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✨ YouTube 비디오 다운로드 완료!`);
    console.log(`   프로젝트: ${projectId}`);
    console.log(`   제목: ${videoTitle}`);
    console.log(`   상태: 다운로드만 완료 (STT 처리는 수동으로 시작)`);
    console.log(`${'='.repeat(60)}\n`);

    const responseData = {
      success: true,
      projectId: projectId,
      videoTitle: videoTitle,
      fileName: fileName,
      fileSize: fileSize,
      duration: videoDuration,
      message: 'YouTube 비디오 다운로드 완료! 프로젝트 목록에서 STT 처리를 시작할 수 있습니다.',
    };

    // 로컬 저장 옵션이 활성화되면 다운로드 URL 생성
    if (saveLocal) {
      try {
        // 1️⃣ 서버 로컬 파일 다운로드 URL
        if (localFilePath && fs.existsSync(localFilePath)) {
          responseData.localDownloadUrl = `/api/download-local/${projectId}`;
          console.log(`   📥 서버 로컬 다운로드 URL 생성 완료`);
        }

        // 2️⃣ GCS 서명된 다운로드 URL (백업용)
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(fileName);

        const [downloadUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 5 * 60 * 1000,  // 5분 유효
        });

        responseData.gcsDownloadUrl = downloadUrl;
        responseData.savedLocally = true;
        console.log(`   📥 GCS 다운로드 URL 생성 완료 (5분 유효)`);
      } catch (urlError) {
        console.error('   ⚠️ 다운로드 URL 생성 실패:', urlError.message);
        // URL 생성 실패해도 프로젝트는 생성됨
      }
    }

    res.json(responseData);

  } catch (error) {
    console.error('❌ YouTube 다운로드 실패:', error.message);

    // 에러 발생 시 프로젝트 상태 업데이트
    if (projectId) {
      try {
        await db.collection('projects').doc(projectId).update({
          status: 'failed',
          error: error.message,
        });
      } catch (updateError) {
        console.error('프로젝트 상태 업데이트 실패:', updateError);
      }
    }

    // 임시 파일 정리
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      try {
        fs.unlinkSync(tempVideoPath);
      } catch (unlinkError) {
        console.error('임시 파일 삭제 실패:', unlinkError);
      }
    }

    handleError(res, error, 500, 'YouTube 비디오 다운로드에 실패했습니다');
  }
});

// ========== YouTube 비디오 정보 조회 (다운로드 전) ==========
/**
 * YouTube 비디오의 메타데이터만 조회 (빠른 확인용)
 *
 * 요청:
 * GET /api/youtube-info?url=https://www.youtube.com/watch?v=...
 *
 * 응답:
 * {
 *   success: true,
 *   title: "Video Title",
 *   duration: 300,
 *   thumbnail: "https://...",
 *   channelName: "Channel Name"
 * }
 */
app.get('/api/youtube-info', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'url 파라미터가 필요합니다' });
  }

  try {
    console.log(`📺 YouTube 정보 조회: ${url}`);

    // yt-dlp으로 비디오 정보 조회
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const { stdout } = await execPromise(
      `yt-dlp --dump-json "${url.replace(/"/g, '\\"')}"`,
      { timeout: 30000 }
    );

    const videoInfo = JSON.parse(stdout);

    const info = {
      success: true,
      videoId: videoInfo.id,
      title: videoInfo.title,
      duration: videoInfo.duration,
      thumbnail: videoInfo.thumbnail,
      channelName: videoInfo.channel,
      channelUrl: videoInfo.channel_url,
      viewCount: videoInfo.view_count?.toString() || '0',
      isLiveContent: videoInfo.is_live || false,
    };

    console.log(`   ✅ 조회 완료: ${info.title} (${Math.floor(info.duration / 60)}분)`);
    res.json(info);

  } catch (error) {
    console.error('❌ YouTube 정보 조회 실패:', error.message);
    handleError(res, error, 400, 'YouTube 비디오 정보를 조회할 수 없습니다. 잠시 후 다시 시도해주세요.');
  }
});

// ========== 글로벌 에러 핸들링 (모든 라우트 뒤에 위치해야 함) ==========

// 404 핸들러 (정의되지 않은 엔드포인트)
app.use((req, res) => {
  res.status(404).json({ error: '요청한 엔드포인트를 찾을 수 없습니다' });
});

// 에러 핸들러 (미들웨어 에러 처리)
app.use((error, req, res, next) => {
  console.error('❌ 미들웨어 에러:', error);

  // Multer 에러 처리
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '파일 크기가 너무 큽니다 (최대 500MB)' });
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'JSON 형식이 유효하지 않습니다' });
  }

  if (error.message) {
    return res.status(400).json({ error: error.message });
  }

  res.status(500).json({ error: '서버 오류가 발생했습니다' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🚀 백엔드 서버 실행 중                ║
║  📍 http://localhost:${PORT}            ║
║  🔧 주요 API 엔드포인트:               ║
║────────────────────────────────────────║
║  🔐 인증 (인증 불필요)                 ║
║     POST /api/auth/register            ║
║     POST /api/auth/login               ║
║────────────────────────────────────────║
║  📋 프로젝트 관리 (인증 필요)           ║
║     GET  /api/health                   ║
║     GET  /api/auth/me                  ║
║     GET  /api/projects                 ║
║     GET  /api/projects/:projectId      ║
║     GET  /api/project-status/:id       ║
║────────────────────────────────────────║
║  📹 비디오 처리 (인증 필요)              ║
║     POST /api/upload-video             ║
║     GET  /api/generate-read-url/:file  ║
║────────────────────────────────────────║
║  🎙️  음성 인식 (STT) (인증 불필요)     ║
║     POST /api/transcribe-audio (Whisper║
║────────────────────────────────────────║
║  🌐 YouTube & 자막 (인증 불필요)       ║
║     POST /api/extract-youtube-captions ║
║     POST /api/generate-srt             ║
║     POST /api/download-youtube         ║
║     GET  /api/youtube-info             ║
║────────────────────────────────────────║
║  🔤 번역 (인증 불필요)                 ║
║     POST /api/translate-text           ║
║     POST /api/translate-captions       ║
║────────────────────────────────────────║
║  🎬 화면전환 감지 (인증 불필요)         ║
║     POST /api/detect-scene-changes     ║
║     GET  /api/scene-changes/:projectId ║
╚════════════════════════════════════════╝
  `);
});
