import axios from 'axios';

// 개발 환경에서 백엔드 URL 설정
const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:8000/api'
  : '/api';

// ========== 개발 모드 설정 ==========
// 로그인 비활성화 (개발 단계) - 필요할 때 false로 변경하면 실제 로그인 활성화
const DEV_MODE_SKIP_AUTH = true;

// ========== JWT 토큰 관리 ==========
const TOKEN_KEY = 'bobpt_auth_token';
const USER_KEY = 'bobpt_user';

// Axios 인터셉터 설정 (모든 요청에 토큰 자동 추가)
axios.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const setAuthToken = (token: string, user: User) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // axios 기본 헤더에 토큰 추가 (백업)
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

interface User {
  id: string;
  email: string;
  name: string;
}

export const getCurrentUser = (): User | null => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  delete axios.defaults.headers.common['Authorization'];
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

// 초기화: 로컬 스토리지에서 토큰이 있으면 axios 헤더에 설정
const savedToken = getAuthToken();
if (savedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

// 개발 모드 초기화: 로그인 비활성화 시 더미 토큰 자동 설정
if (DEV_MODE_SKIP_AUTH && !savedToken) {
  const dummyToken = 'dev_token_12345';
  const dummyUser = {
    id: 'dev_user',
    email: 'dev@example.com',
    name: 'Dev User',
  };
  setAuthToken(dummyToken, dummyUser);
}

// ========== 인증 API ==========

interface AuthResponse {
  token: string;
  user: User;
}

export const register = async (email: string, password: string, name: string): Promise<AuthResponse> => {
  try {
    // 개발 모드: 로그인 비활성화
    if (DEV_MODE_SKIP_AUTH) {
      const dummyData: AuthResponse = {
        token: 'dev_token_12345',
        user: {
          id: 'dev_user_' + Date.now(),
          email,
          name,
        }
      };
      setAuthToken(dummyData.token, dummyData.user);
      console.log('💡 [DEV MODE] 회원가입 요청 스킵됨, 더미 토큰 사용:', dummyData.user);
      return dummyData;
    }

    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      email,
      password,
      name,
    });

    // 회원가입 후 자동 로그인
    setAuthToken(response.data.token, response.data.user);
    return response.data;
  } catch (error) {
    console.error("회원가입 실패:", error);
    throw error;
  }
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    // 개발 모드: 로그인 비활성화
    if (DEV_MODE_SKIP_AUTH) {
      const dummyData: AuthResponse = {
        token: 'dev_token_12345',
        user: {
          id: 'dev_user_' + Date.now(),
          email,
          name: email.split('@')[0],
        }
      };
      setAuthToken(dummyData.token, dummyData.user);
      console.log('💡 [DEV MODE] 로그인 요청 스킵됨, 더미 토큰 사용:', dummyData.user);
      return dummyData;
    }

    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password,
    });

    // 로그인 성공 후 토큰 저장
    setAuthToken(response.data.token, response.data.user);
    return response.data;
  } catch (error) {
    console.error("로그인 실패:", error);
    throw error;
  }
};

export const logout = () => {
  clearAuthToken();
};

export const getCurrentUserInfo = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/me`);
    return response.data.user;
  } catch (error) {
    console.error("사용자 정보 조회 실패:", error);
    throw error;
  }
};

// ========== 프로젝트 API ==========

export const getProject = async (projectId: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error("프로젝트 데이터 조회 실패:", error);
    throw error;
  }
};

export const getProjects = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/projects`);
    // Map backend response to frontend interface
    // Backend returns projectId, frontend expects id
    const projects = response.data.projects || [];
    return projects.map((project: any) => ({
      ...project,
      id: project.projectId || project.id  // Use projectId as id, fallback to id
    }));
  } catch (error) {
    console.error("프로젝트 목록 조회 실패:", error);
    throw error;
  }
};

export const getProjectStatus = async (projectId: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/project-status/${projectId}`);
    return response.data;
  } catch (error) {
    console.error("프로젝트 상태 조회 실패:", error);
    throw error;
  }
};

export const getUploadUrl = async (fileName: string, language: string = "ko-KR") => {
  try {
    const response = await axios.post(`${API_BASE_URL}/projects/init`, {
      fileName: fileName,
      language: language
    });
    return {
      projectId: response.data.projectId,
      uploadUrl: response.data.uploadUrl,
      gcsUri: response.data.gcsUri
    };
  } catch (error) {
    console.error("업로드 URL 생성 실패:", error);
    throw error;
  }
};

export const getReadUrl = async (fileName: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/generate-read-url/${fileName}`);
    return response.data.read_url;
  } catch (error) {
    console.error("읽기 URL 생성 실패:", error);
    throw error;
  }
};

export const deleteProject = async (projectId: string) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error("프로젝트 삭제 실패:", error);
    throw error;
  }
};

export const getTranscript = async (projectId: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/projects/${projectId}/transcript`);

    // 서버에서 반환한 자막 데이터: [{start, end, text}, ...]
    // WordInfo 형식으로 변환: {start_time, end_time, word, text}
    const captions = response.data.captions || [];
    const transcript = captions.map((caption: any) => ({
      start_time: caption.start,
      end_time: caption.end,
      word: caption.text,
      text: caption.text,
    }));

    return {
      transcript,
      word_count: response.data.word_count || 0,
      fileName: response.data.fileName,
      language: response.data.language,
      status: response.data.status,
      completedAt: response.data.completed_at,
    };
  } catch (error: any) {
    // 202: 아직 처리 중
    if (error.response?.status === 202) {
      return {
        transcript: [],
        word_count: 0,
        status: 'processing',
        isProcessing: true,
      };
    }
    // 404: 프로젝트 없음
    if (error.response?.status === 404) {
      console.error("프로젝트를 찾을 수 없습니다:", error);
      throw new Error("프로젝트를 찾을 수 없습니다.");
    }
    console.error("트랜스크립트 조회 실패:", error);
    throw error;
  }
};

export const updateTranscript = async (projectId: string, transcript: string, captions: any[]) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/projects/${projectId}/transcript/update`, {
      transcript,
      captions,
    });
    console.log("트랜스크립트 업데이트 성공:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("트랜스크립트 업데이트 실패:", error);
    throw error;
  }
};

// ========== 번역 API ==========

interface TranslationRequest {
  captions: Array<{ start: number; end: number; text: string }>;
  targetLanguage: string;
}

export const translateCaptions = async (request: TranslationRequest) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/translate-captions`, request);
    return {
      mode: response.data.mode || 'online',
      translated: response.data.translated || [],
      originalLanguage: response.data.original_language,
      targetLanguage: response.data.target_language,
    };
  } catch (error: any) {
    console.error("자막 번역 실패:", error);
    throw error;
  }
};

// ========== OCR & 맞춤법 검사 API ==========

interface OCRStatusResponse {
  request_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  data?: any;
}

export const ocrAnalyzeYouTube = async (url: string) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/ocr-spellcheck/youtube`, {
      url,
    });
    return response.data;
  } catch (error: any) {
    console.error("YouTube OCR 분석 실패:", error);
    throw error;
  }
};

export const ocrAnalyzeLocalFile = async (file: File, intervalSeconds: number = 5) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('interval_seconds', intervalSeconds.toString());

    const response = await axios.post(`${API_BASE_URL}/ocr-spellcheck/local`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    console.error("로컬 파일 OCR 분석 실패:", error);
    throw error;
  }
};

export const getOCRStatus = async (requestId: string): Promise<OCRStatusResponse> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/ocr-spellcheck/status/${requestId}`);
    return response.data;
  } catch (error: any) {
    console.error("OCR 상태 조회 실패:", error);
    throw error;
  }
};

export const quickSpellCheck = async (text: string) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/ocr-spellcheck/quick-check`, {
      text,
    });
    return response.data;
  } catch (error: any) {
    console.error("빠른 맞춤법 검사 실패:", error);
    throw error;
  }
};

// ========== 내보내기(Export) API ==========

interface ExportOptions {
  format: 'srt' | 'vtt' | 'premiere' | 'fcpx';
  frameRate?: number;
  videoWidth?: number;
  videoHeight?: number;
}

export const exportProject = async (projectId: string, options: ExportOptions) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/projects/${projectId}/export`,
      {
        format: options.format,
        frameRate: options.frameRate || 30,
        videoWidth: options.videoWidth || 1920,
        videoHeight: options.videoHeight || 1080,
      },
      {
        responseType: 'blob', // 파일 다운로드를 위해 blob 사용
      }
    );

    // 파일 다운로드
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // 파일명 결정
    const extension = {
      srt: '.srt',
      vtt: '.vtt',
      premiere: '.xml',
      fcpx: '.fcpxml',
    }[options.format];

    link.setAttribute('download', `${projectId}${extension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error: any) {
    console.error("프로젝트 내보내기 실패:", error);
    throw error;
  }
};

export const getExportFormats = async (projectId: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/projects/${projectId}/export/formats`);
    return response.data.formats;
  } catch (error: any) {
    console.error("내보내기 형식 조회 실패:", error);
    throw error;
  }
};

// ========== YouTube 처리 API ==========

interface YouTubeProcessRequest {
  url: string;
  target_languages?: string[];
  source_language?: string;
  enable_ocr?: boolean;
}

export const processYouTubeVideo = async (request: YouTubeProcessRequest) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/youtube/process`, {
      url: request.url,
      target_languages: request.target_languages || ["en"],
      source_language: request.source_language || "ko",
      enable_ocr: request.enable_ocr || false,
    });
    return response.data;
  } catch (error: any) {
    console.error("YouTube 처리 실패:", error);
    throw error;
  }
};

export const getYouTubeStatus = async (projectId: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/youtube/status/${projectId}`);
    return response.data;
  } catch (error: any) {
    console.error("YouTube 상태 조회 실패:", error);
    throw error;
  }
};

// ========== 썸네일 생성 ==========

export const generateThumbnails = async (projectId: string, numThumbnails: number = 3) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/projects/${projectId}/thumbnails/generate`, {
      num_thumbnails: numThumbnails
    });
    return response.data;
  } catch (error: any) {
    console.error("썸네일 생성 실패:", error);
    throw error;
  }
};

export const getThumbnails = async (projectId: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/projects/${projectId}/thumbnails`);
    return response.data;
  } catch (error: any) {
    console.error("썸네일 조회 실패:", error);
    throw error;
  }
};

export const regenerateThumbnailText = async (
  projectId: string,
  thumbnailIndex: number,
  newText: string
) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/projects/${projectId}/thumbnails/regenerate-text`,
      { new_text: newText },
      { params: { thumbnail_index: thumbnailIndex } }
    );
    return response.data;
  } catch (error: any) {
    console.error("썸네일 텍스트 재생성 실패:", error);
    throw error;
  }
};

// ========== 비디오 편집 및 쇼츠 생성 ==========

interface VideoEditRequest {
  enable_filler_removal?: boolean;
  enable_shorts_generation?: boolean;
  num_shorts?: number;
  video_genre?: string;
}

export const editVideo = async (projectId: string, request: VideoEditRequest) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/projects/${projectId}/edit`,
      {
        enable_filler_removal: request.enable_filler_removal ?? true,
        enable_shorts_generation: request.enable_shorts_generation ?? true,
        num_shorts: request.num_shorts ?? 3,
        video_genre: request.video_genre
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("비디오 편집 실패:", error);
    throw error;
  }
};

export const createQuickShort = async (projectId: string, videoGenre?: string) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/projects/${projectId}/quick-short`,
      {
        video_genre: videoGenre
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("빠른 쇼츠 생성 실패:", error);
    throw error;
  }
};

