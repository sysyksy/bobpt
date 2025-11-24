
import React, { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import SubtitleList from './SubtitleList';
import { SubtitleBlock, VideoState, EditorTab, Highlight } from '../../types/studio-episode';
import { Sparkles, Download, Upload, Languages, Type, Image as ImageIcon, Scissors, Youtube, CheckCircle2, AlertCircle, RefreshCw, FileCode, ChevronLeft, Wand2 } from 'lucide-react';
// BobPT 백엔드 API
import { 
  getUploadUrl, 
  getReadUrl, 
  getTranscript, 
  updateTranscript, 
  translateCaptions,
  processYouTubeVideo,
  getProjectStatus,
  quickSpellCheck,
  generateThumbnails,
  getThumbnails,
  editVideo,
  createQuickShort
} from '../../apiClient';
// Gemini 서비스 (fallback용)
import { generateDemoSubtitles, translateSubtitles, performSpellCheck, analyzeHighlights, generateThumbnail, editImageWithPrompt } from '../../services/studio-episode/geminiService';

interface EditorProps {
  initialVideo?: File | null;
  initialMode?: 'UPLOAD' | 'YOUTUBE';
  projectId?: string | null; // 기존 프로젝트를 열 때 사용
}

const Editor: React.FC<EditorProps> = ({ initialVideo, initialMode = 'UPLOAD', projectId: initialProjectId }) => {
  const [videoState, setVideoState] = useState<VideoState>({
    file: initialVideo || null,
    url: initialVideo ? URL.createObjectURL(initialVideo) : null,
    duration: 0,
    currentTime: 0,
    isPlaying: false
  });

  const [activeTab, setActiveTab] = useState<EditorTab>('CAPTIONS');
  const [subtitles, setSubtitles] = useState<SubtitleBlock[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [generatedThumbnail, setGeneratedThumbnail] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);
  const [youtubeLinkInput, setYoutubeLinkInput] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(initialMode === 'YOUTUBE');

  // BobPT 프로젝트 관리
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialProjectId || null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 기존 프로젝트 로드
  useEffect(() => {
    if (initialProjectId && !currentProjectId) {
      setCurrentProjectId(initialProjectId);
      loadExistingProject(initialProjectId);
    }
  }, [initialProjectId]);

  const loadExistingProject = async (projectId: string) => {
    setIsProcessing(true);
    try {
      // 프로젝트 데이터 가져오기
      const transcriptData = await getTranscript(projectId);
      
      // 비디오 URL 가져오기
      const projectData = await getProject(projectId);
      const fileName = projectData.fileName || projectData.gcsFileName;
      if (fileName) {
        const videoUrl = await getReadUrl(fileName);
        setVideoState(prev => ({
          ...prev,
          url: videoUrl,
          file: null
        }));
      }

      // 트랜스크립트 변환
      if (transcriptData.transcript && transcriptData.transcript.length > 0) {
        const convertedSubtitles: SubtitleBlock[] = transcriptData.transcript.map((item: any, index: number) => ({
          id: `subtitle-${index}-${Date.now()}`,
          startTime: item.start_time || item.start || 0,
          endTime: item.end_time || item.end || 0,
          text: item.word || item.text || '',
          speaker: 'Speaker 1'
        }));
        setSubtitles(convertedSubtitles);
      }

    } catch (error: any) {
      console.error("프로젝트 로드 실패:", error);
      alert("프로젝트를 불러올 수 없습니다: " + (error.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Image editing state
  const [editPrompt, setEditPrompt] = useState('');

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (videoState.url && videoState.file) {
        URL.revokeObjectURL(videoState.url);
      }
    };
  }, []);

  // Sync active subtitle based on time
  useEffect(() => {
    const currentBlock = subtitles.find(
      s => videoState.currentTime >= s.startTime && videoState.currentTime <= s.endTime
    );
    if (currentBlock && currentBlock.id !== activeSubtitleId) {
      setActiveSubtitleId(currentBlock.id);
    }
  }, [videoState.currentTime, subtitles, activeSubtitleId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadProgress(0);

    try {
      // 1. BobPT 프로젝트 초기화 및 업로드 URL 받기
      const { projectId, uploadUrl } = await getUploadUrl(file.name);
      setCurrentProjectId(projectId);

      // 2. 파일을 GCS에 업로드
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed: Network error'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
        xhr.send(file);
      });

      // 3. 비디오 URL 가져오기 (읽기용)
      const videoUrl = await getReadUrl(file.name);

      // 4. 상태 업데이트
      setVideoState({
        file,
        url: videoUrl,
        duration: 0,
        currentTime: 0,
        isPlaying: false
      });
      setSubtitles([]); 
      setHighlights([]);
      setGeneratedThumbnail(null);

      // 5. STT 처리 대기 (백그라운드에서 처리됨)
      // 사용자가 "AI Auto-Transcribe" 버튼을 클릭하면 폴링 시작

    } catch (error: any) {
      alert(`업로드 실패: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleYouTubeSubmit = async () => {
    if (!youtubeLinkInput) return;

      setIsProcessing(true);
    setUploadProgress(0);

    try {
      // BobPT YouTube 처리 API 호출
      const result = await processYouTubeVideo({
        url: youtubeLinkInput,
        target_languages: ['en'],
        source_language: 'ko',
        enable_ocr: false
      });

      const projectId = result.project_id;
      setCurrentProjectId(projectId);

      // 상태 업데이트
          setVideoState({
              file: null,
        url: null, // YouTube는 스트리밍이므로 URL 없음
              youtubeUrl: youtubeLinkInput,
        duration: 0,
              currentTime: 0,
              isPlaying: false
          });
          setShowLinkModal(false);
      setSubtitles([]);
      setHighlights([]);
      setGeneratedThumbnail(null);

      // STT 처리 대기 (백그라운드에서 처리됨)
      // 사용자가 "AI Auto-Transcribe" 버튼을 클릭하면 폴링 시작

    } catch (error: any) {
      alert(`YouTube 처리 실패: ${error.response?.data?.detail || error.message}`);
    } finally {
          setIsProcessing(false);
      setUploadProgress(0);
    }
  }

  const handleGenerateSubtitles = async (topicOverride?: string) => {
    if (!currentProjectId) {
      alert("프로젝트가 없습니다. 먼저 비디오를 업로드하세요.");
      return;
    }

    setIsProcessing(true);

    try {
      // BobPT 백엔드에서 트랜스크립트 가져오기 (폴링)
      const pollTranscript = async (attempts = 0): Promise<void> => {
        if (attempts > 40) {
          throw new Error("STT 처리 시간이 너무 오래 걸립니다.");
        }

        try {
          const transcriptData = await getTranscript(currentProjectId!);
          
          if (transcriptData.isProcessing || transcriptData.status === 'processing') {
            // 아직 처리 중 - 5초 후 다시 시도
            await new Promise(resolve => setTimeout(resolve, 5000));
            return pollTranscript(attempts + 1);
          }

          // 트랜스크립트가 준비됨
          if (transcriptData.transcript && transcriptData.transcript.length > 0) {
            // BobPT 형식 [{start_time, end_time, word}] → Studio Episode 형식 [{startTime, endTime, text}]
            const convertedSubtitles: SubtitleBlock[] = transcriptData.transcript.map((item: any, index: number) => ({
              id: `subtitle-${index}-${Date.now()}`,
              startTime: item.start_time || item.start || 0,
              endTime: item.end_time || item.end || 0,
              text: item.word || item.text || '',
              speaker: 'Speaker 1'
            }));
            setSubtitles(convertedSubtitles);
            return;
          }

          // 트랜스크립트가 아직 없음 - 다시 시도
          await new Promise(resolve => setTimeout(resolve, 5000));
          return pollTranscript(attempts + 1);

        } catch (error: any) {
          if (error.response?.status === 202) {
            // 아직 처리 중
            await new Promise(resolve => setTimeout(resolve, 5000));
            return pollTranscript(attempts + 1);
          }
          throw error;
        }
      };

      await pollTranscript();

    } catch (error: any) {
      console.error("STT 실패:", error);
      // Fallback: Gemini 사용 (데모용)
    try {
      const topic = topicOverride || videoState.file?.name || "Generic Video";
      const result = await generateDemoSubtitles(topic);
      setSubtitles(result);
        alert("백엔드 STT 실패, Gemini 데모 모드로 전환했습니다.");
      } catch (fallbackError) {
        alert("자막 생성 실패: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranslate = async (lang: string) => {
    if (subtitles.length === 0) return;
    setIsProcessing(true);
    try {
      // 언어 코드 매핑
      const langMap: { [key: string]: string } = {
        'English': 'en',
        'Spanish': 'es',
        'Korean': 'ko',
        'Japanese': 'ja',
        'Chinese': 'zh',
        'French': 'fr'
      };
      const targetLang = langMap[lang] || lang.toLowerCase();

      // BobPT 번역 API 사용
      const captions = subtitles.map(s => ({
        start: s.startTime,
        end: s.endTime,
        text: s.text
      }));

      const result = await translateCaptions({
        captions,
        targetLanguage: targetLang
      });

      // 번역된 자막으로 업데이트
      const translatedSubtitles: SubtitleBlock[] = result.translated.map((item: any, index: number) => ({
        ...subtitles[index],
        text: item.text,
        id: subtitles[index]?.id || `translated-${index}-${Date.now()}`
      }));

      setSubtitles(translatedSubtitles);

      // 프로젝트에 저장 (선택사항)
      if (currentProjectId) {
        try {
          await updateTranscript(
            currentProjectId,
            translatedSubtitles.map(s => s.text).join('\n'),
            translatedSubtitles.map(s => ({
              start: s.startTime,
              end: s.endTime,
              text: s.text
            }))
          );
        } catch (saveError) {
          console.warn("번역 저장 실패:", saveError);
        }
      }

    } catch (error: any) {
      console.error("번역 실패:", error);
      // Fallback: Gemini 사용
    try {
        const translated = await translateSubtitles(subtitles, lang);
        setSubtitles(translated);
        alert("백엔드 번역 실패, Gemini로 전환했습니다.");
      } catch (fallbackError) {
        alert("번역 실패: " + (error.message || "Unknown error"));
      }
    } finally {
        setIsProcessing(false);
    }
  };

  const handleSpellCheck = async () => {
    if (subtitles.length === 0) return;
      setIsProcessing(true);
    try {
      // BobPT 맞춤법 검사 API 사용
      const fullText = subtitles.map(s => s.text).join(' ');
      const result = await quickSpellCheck(fullText);

      if (result.corrections && (result.corrections.naver?.length > 0 || result.corrections.google?.length > 0)) {
        // 맞춤법 교정 적용 (간단한 버전)
        // 실제로는 더 정교한 교정 로직 필요
        alert(`맞춤법 검사 완료: ${result.total_issues}개 오류 발견`);
        // Gemini fallback으로 상세 교정
        const fixed = await performSpellCheck(subtitles);
        setSubtitles(fixed);
      } else {
        // 오류 없음
        alert("맞춤법 오류가 없습니다.");
      }
    } catch (error: any) {
      console.error("맞춤법 검사 실패:", error);
      // Fallback: Gemini 사용
      try {
          const fixed = await performSpellCheck(subtitles);
          setSubtitles(fixed);
      } catch (fallbackError) {
        alert("맞춤법 검사 실패: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsProcessing(false);
    }
  }

  const handleGenerateHighlights = async () => {
    if (subtitles.length === 0) {
      alert("먼저 자막을 생성하세요.");
      return;
    }

    if (!currentProjectId) {
      alert("프로젝트가 없습니다.");
          return;
      }

      setIsProcessing(true);
    try {
      // BobPT 쇼츠 생성 API 사용
      const result = await editVideo(currentProjectId, {
        enable_filler_removal: false,
        enable_shorts_generation: true,
        num_shorts: 3,
        video_genre: "일반"
      });

      // 하이라이트 정보는 Firestore에서 가져와야 함
      // 일단 Gemini fallback 사용
      const geminiHighlights = await analyzeHighlights(subtitles);
      setHighlights(geminiHighlights);

      // 프로젝트 상태 폴링하여 highlights 가져오기 (선택사항)
      // const projectData = await getProject(currentProjectId);
      // if (projectData.highlights) {
      //   setHighlights(projectData.highlights);
      // }

    } catch (error: any) {
      console.error("하이라이트 생성 실패:", error);
      // Fallback: Gemini 사용
      try {
          const result = await analyzeHighlights(subtitles);
          setHighlights(result);
        alert("백엔드 하이라이트 생성 실패, Gemini로 전환했습니다.");
      } catch (fallbackError) {
        alert("하이라이트 분석 실패: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsProcessing(false);
    }
  }

  const handleGenerateThumbnail = async () => {
    if (subtitles.length === 0) {
      alert("먼저 자막을 생성하세요.");
      return;
    }

    if (!currentProjectId) {
      alert("프로젝트가 없습니다.");
           return;
      }

      setIsProcessing(true);
    try {
      // BobPT 썸네일 생성 API 사용
      const result = await generateThumbnails(currentProjectId, 1);

      // 썸네일 조회 (폴링)
      const pollThumbnails = async (attempts = 0): Promise<void> => {
        if (attempts > 20) {
          throw new Error("썸네일 생성 시간이 너무 오래 걸립니다.");
        }

        try {
          const thumbnailsData = await getThumbnails(currentProjectId);
          
          if (thumbnailsData.status === 'processing') {
            await new Promise(resolve => setTimeout(resolve, 3000));
            return pollThumbnails(attempts + 1);
          }

          if (thumbnailsData.status === 'completed' && thumbnailsData.thumbnails?.length > 0) {
            // 첫 번째 썸네일 사용
            setGeneratedThumbnail(thumbnailsData.thumbnails[0].thumbnail_url);
            return;
          }

          await new Promise(resolve => setTimeout(resolve, 3000));
          return pollThumbnails(attempts + 1);

        } catch (error: any) {
          if (attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            return pollThumbnails(attempts + 1);
          }
          throw error;
        }
      };

      await pollThumbnails();

    } catch (error: any) {
      console.error("썸네일 생성 실패:", error);
      // Fallback: Gemini 사용
      try {
          const base64Img = await generateThumbnail(subtitles);
          setGeneratedThumbnail(base64Img);
        alert("백엔드 썸네일 생성 실패, Gemini로 전환했습니다.");
      } catch (fallbackError) {
        alert("썸네일 생성 실패: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsProcessing(false);
    }
  }

  const handleEditThumbnail = async () => {
    if (!generatedThumbnail || !editPrompt) return;
    setIsProcessing(true);
    try {
      const editedImage = await editImageWithPrompt(generatedThumbnail, editPrompt);
      setGeneratedThumbnail(editedImage);
      setEditPrompt('');
    } catch (e) {
      alert("Failed to edit image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const exportXML = async () => {
    if (!currentProjectId) {
      alert("프로젝트가 없습니다.");
      return;
    }

    if (subtitles.length === 0) {
      alert("내보낼 자막이 없습니다.");
      return;
    }

    setIsProcessing(true);
    try {
      // BobPT Export API 사용 (FCPX 형식)
      const { exportProject } = await import('../../apiClient');
      await exportProject(currentProjectId, {
        format: 'fcpx',
        frameRate: 30,
        videoWidth: 1920,
        videoHeight: 1080
      });
    } catch (error: any) {
      console.error("Export 실패:", error);
      // Fallback: 간단한 FCPXML 생성
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
    <project name="TubeScript Export">
        <sequence duration="${videoState.duration}s">
            ${subtitles.map(s => `
            <title name="${s.text}" offset="${s.startTime}s" duration="${s.endTime - s.startTime}s">
                <text>${s.text}</text>
            </title>`).join('')}
        </sequence>
    </project>
</fcpxml>`;
      
      const element = document.createElement("a");
      const file = new Blob([xmlContent], {type: 'text/xml'});
      element.href = URL.createObjectURL(file);
      element.download = "project_subtitles.fcpxml";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Render Tab Content ---

  const renderTabContent = () => {
      switch(activeTab) {
          case 'CAPTIONS':
              return (
                <div className="flex flex-col h-full">
                     <div className="p-4 border-b border-gray-800 flex gap-2">
                        <button 
                            onClick={() => handleGenerateSubtitles()} 
                            disabled={isProcessing}
                            className="flex-1 py-2 bg-episode-500 hover:bg-episode-600 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-episode-600/20"
                        >
                            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                            AI Auto-Transcribe
                        </button>
                        <button 
                            onClick={handleSpellCheck}
                            disabled={isProcessing || subtitles.length === 0}
                            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 text-gray-300"
                        >
                            <CheckCircle2 className="w-4 h-4 text-green-400"/>
                            Spell Check
                        </button>
                     </div>
                     <SubtitleList 
                        subtitles={subtitles}
                        currentTime={videoState.currentTime}
                        activeId={activeSubtitleId}
                        onUpdateSubtitle={(id, text) => setSubtitles(prev => prev.map(s => s.id === id ? { ...s, text } : s))}
                        onDeleteSubtitle={(id) => setSubtitles(prev => prev.filter(s => s.id !== id))}
                        onJumpToTime={(time) => setVideoState(prev => ({ ...prev, currentTime: time }))}
                      />
                </div>
              );
          case 'TRANSLATE':
              return (
                  <div className="flex flex-col h-full p-4 space-y-4">
                      <h3 className="text-sm font-bold text-gray-500 uppercase">Target Language</h3>
                      <div className="grid grid-cols-2 gap-3">
                          {['English', 'Spanish', 'Korean', 'Japanese', 'Chinese', 'French'].map(lang => (
                              <button 
                                key={lang}
                                onClick={() => handleTranslate(lang)}
                                disabled={isProcessing}
                                className="p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-left text-sm font-medium transition-colors flex items-center justify-between group hover:border-episode-500/50"
                              >
                                  <span>{lang}</span>
                                  <Languages className="w-4 h-4 text-gray-500 group-hover:text-episode-400"/>
                              </button>
                          ))}
                      </div>
                      <div className="mt-auto p-4 bg-episode-900/20 border border-episode-500/30 rounded-xl">
                          <p className="text-xs text-episode-200">
                              <AlertCircle className="w-4 h-4 inline mr-2 mb-0.5"/>
                              Translation replaces current subtitles.
                          </p>
                      </div>
                  </div>
              );
          case 'SHORTS':
              return (
                  <div className="flex flex-col h-full p-4">
                       <button 
                            onClick={handleGenerateHighlights} 
                            disabled={isProcessing}
                            className="w-full py-3 mb-4 bg-gradient-to-r from-episode-500 to-pink-600 hover:from-episode-600 hover:to-pink-700 rounded-lg text-sm font-bold text-white transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Scissors className="w-4 h-4"/>}
                            Analyze & Find Highlights
                        </button>
                        
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {highlights.map(hl => (
                                <div key={hl.id} className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-episode-500/50 transition-all cursor-pointer group"
                                     onClick={() => setVideoState(prev => ({ ...prev, currentTime: hl.startTime, isPlaying: true }))}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-episode-400 text-sm">Score: {hl.viralScore}</span>
                                        <span className="text-xs text-gray-500 font-mono">{hl.startTime}s - {hl.endTime}s</span>
                                    </div>
                                    <h4 className="font-medium text-gray-200 text-sm mb-1 group-hover:text-white">{hl.title}</h4>
                                    <p className="text-xs text-gray-400 italic">"{hl.reason}"</p>
                                </div>
                            ))}
                             {highlights.length === 0 && !isProcessing && (
                                <div className="text-center text-gray-500 mt-10 text-sm">No highlights generated yet.</div>
                            )}
                        </div>
                  </div>
              );
          case 'THUMBNAIL':
              return (
                   <div className="flex flex-col h-full p-4 overflow-y-auto">
                        <button 
                            onClick={handleGenerateThumbnail} 
                            disabled={isProcessing}
                            className="w-full py-3 mb-6 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 shrink-0"
                        >
                            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <ImageIcon className="w-4 h-4"/>}
                            Generate AI Thumbnail
                        </button>

                        <div className="aspect-video bg-black rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden relative shrink-0">
                             {generatedThumbnail ? (
                                 <img src={generatedThumbnail} alt="Generated Thumbnail" className="w-full h-full object-cover" />
                             ) : (
                                 <div className="text-gray-600 flex flex-col items-center">
                                     <ImageIcon className="w-8 h-8 mb-2 opacity-50"/>
                                     <span className="text-xs">Preview Area</span>
                                 </div>
                             )}
                        </div>

                        {generatedThumbnail && (
                            <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-3">
                                <div className="flex items-center gap-2 text-episode-500 font-bold text-sm">
                                    <Wand2 className="w-4 h-4" />
                                    <span>AI Magic Edit</span>
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={editPrompt}
                                        onChange={(e) => setEditPrompt(e.target.value)}
                                        placeholder="e.g. 'Add a retro filter', 'Remove text'"
                                        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-episode-500 outline-none placeholder-gray-600"
                                        onKeyDown={(e) => e.key === 'Enter' && handleEditThumbnail()}
                                        disabled={isProcessing}
                                    />
                                    <button 
                                        onClick={handleEditThumbnail}
                                        disabled={isProcessing || !editPrompt.trim()}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 min-w-[70px] flex justify-center"
                                    >
                                        {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin"/> : 'Edit'}
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {generatedThumbnail && (
                             <button className="mt-4 w-full py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-lg text-sm flex items-center justify-center gap-2 shrink-0">
                                 <Download className="w-4 h-4"/> Download Image
                             </button>
                        )}
                   </div>
              );
          default: return null;
      }
  }

  // --- Main Render ---

  return (
    <div className="flex h-full bg-gray-950 text-white">
      
      {/* YouTube Link Modal */}
      {showLinkModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                  <div className="flex items-center gap-3 mb-4 text-episode-500">
                      <Youtube className="w-8 h-8"/>
                      <h2 className="text-xl font-bold text-white">Import YouTube Video</h2>
                  </div>
                  <p className="text-gray-400 mb-6 text-sm">Paste a link to analyze text, fix hardcoded subtitles, or extract highlights.</p>
                  
                  <input 
                    type="text" 
                    placeholder="https://www.youtube.com/watch?v=..." 
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white mb-4 focus:border-episode-500 focus:outline-none"
                    value={youtubeLinkInput}
                    onChange={(e) => setYoutubeLinkInput(e.target.value)}
                  />
                  
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setShowLinkModal(false)}
                        className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleYouTubeSubmit}
                        className="flex-1 py-3 bg-episode-600 hover:bg-episode-500 rounded-xl text-white font-medium flex justify-center items-center gap-2"
                      >
                          {isProcessing && <RefreshCw className="w-4 h-4 animate-spin"/>}
                          Import & Analyze
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Toolbar */}
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="font-semibold text-gray-200 truncate max-w-xs flex items-center gap-2">
                {videoState.file ? <Upload className="w-4 h-4 text-episode-500"/> : <Youtube className="w-4 h-4 text-episode-500"/>}
                {videoState.file ? videoState.file.name : (videoState.youtubeUrl ? "YouTube Import" : "Untitled Project")}
            </h1>
          </div>

          <div className="flex items-center gap-3">
             {/* Tab Buttons for Desktop */}
             <div className="hidden lg:flex bg-gray-900 rounded-lg p-1 border border-gray-800 mr-4">
                 {[
                     { id: 'CAPTIONS', icon: Type, label: 'Subtitles' },
                     { id: 'TRANSLATE', icon: Languages, label: 'Translate' },
                     { id: 'SHORTS', icon: Scissors, label: 'Shorts' },
                     { id: 'THUMBNAIL', icon: ImageIcon, label: 'Thumbnail' },
                 ].map((tab) => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as EditorTab)}
                        className={`
                            px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all
                            ${activeTab === tab.id ? 'bg-gray-800 text-white shadow border border-gray-700' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}
                        `}
                     >
                         <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-episode-500' : ''}`}/>
                         {tab.label}
                     </button>
                 ))}
             </div>

            <button 
              onClick={exportXML}
              disabled={subtitles.length === 0}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700 disabled:opacity-50"
            >
              <FileCode className="w-4 h-4" />
              <span>XML</span>
            </button>
            <button 
              onClick={async () => {
                if (!currentProjectId || subtitles.length === 0) {
                  alert("저장할 내용이 없습니다.");
                  return;
                }
                setIsProcessing(true);
                try {
                  await updateTranscript(
                    currentProjectId,
                    subtitles.map(s => s.text).join('\n'),
                    subtitles.map(s => ({
                      start: s.startTime,
                      end: s.endTime,
                      text: s.text
                    }))
                  );
                  alert("저장되었습니다!");
                } catch (error: any) {
                  alert("저장 실패: " + (error.message || "Unknown error"));
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={!currentProjectId || subtitles.length === 0 || isProcessing}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold bg-episode-500 hover:bg-episode-600 text-white rounded-lg shadow-lg shadow-episode-600/30 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : null}
              <span>Save</span>
            </button>
          </div>
        </header>

        {/* Workspace Split */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: Video Preview */}
          <div className="flex-[2] flex flex-col border-r border-gray-800 bg-black relative">
            <div className="w-full h-full bg-black flex items-center justify-center relative">
                {videoState.youtubeUrl ? (
                    <div className="text-center">
                        <Youtube className="w-20 h-20 text-red-600 mx-auto mb-4 opacity-80"/>
                        <p className="text-gray-500 font-mono text-sm">Streaming: {videoState.youtubeUrl}</p>
                        <p className="text-gray-600 text-xs mt-2">(Video preview simulated for demo)</p>
                    </div>
                ) : (
                    <VideoPlayer 
                        src={videoState.url}
                        currentTime={videoState.currentTime}
                        isPlaying={videoState.isPlaying}
                        onTimeUpdate={(t) => setVideoState(prev => ({ ...prev, currentTime: t }))}
                        onDurationChange={(d) => setVideoState(prev => ({ ...prev, duration: d }))}
                        onPlayPause={() => setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                    />
                )}

                {!videoState.file && !videoState.youtubeUrl && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 z-20">
                      <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl text-center max-w-md relative overflow-hidden">
                         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-episode-500 to-pink-500"></div>
                         <Upload className="w-12 h-12 text-episode-500 mx-auto mb-4" />
                         <h2 className="text-xl font-bold text-white mb-4">Start Creating</h2>
                         <div className="space-y-3">
                             <label className="block w-full py-3 bg-episode-500 hover:bg-episode-600 text-white font-bold rounded-xl cursor-pointer transition-all shadow-lg shadow-episode-500/20">
                                <span>Upload Video File</span>
                                <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                             </label>
                             <button onClick={() => setShowLinkModal(true)} className="block w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-all">
                                Paste YouTube Link
                             </button>
                         </div>
                      </div>
                   </div>
                )}
            </div>
          </div>

          {/* Right: Tools & Tabs */}
          <div className="w-96 flex flex-col bg-gray-900 border-l border-gray-800">
             {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;
