import { useState } from 'react';
import axios from 'axios';

interface TranslationControlsProps {
  transcript: any[];
  onTranslate: (translatedData: any[]) => void;
}

function TranslationControls({ transcript, onTranslate }: TranslationControlsProps) {
  const [targetLang, setTargetLang] = useState('ko');
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    setTranslating(true);

    try {
      console.log(`🌐 번역 시작: ${transcript.length}줄 → ${targetLang}`);

      const response = await axios.post('/api/translate-captions', {
        captions: transcript,
        targetLanguage: targetLang,
      });

      console.log('✅ 번역 완료');
      onTranslate(response.data.captions);
    } catch (error: any) {
      console.error('❌ 번역 실패:', error);

      // 더 자세한 에러 정보 출력
      if (error.response) {
        console.error('   상태 코드:', error.response.status);
        console.error('   에러 메시지:', error.response.data?.error);
        console.error('   상세 정보:', error.response.data?.details);
      }

      const errorMessage = error.response?.data?.error || error.message || '번역에 실패했습니다.';
      alert(`❌ 번역 실패\n\n${errorMessage}`);
    } finally {
      setTranslating(false);
    }
  };

  const handleClearTranslation = () => {
    const cleared = transcript.map(item => {
      const { translation, ...rest } = item;
      return rest;
    });
    onTranslate(cleared);
  };

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <select
        value={targetLang}
        onChange={(e) => setTargetLang(e.target.value)}
        style={{
          padding: '8px 12px',
          fontSize: '14px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: 'white',
        }}
      >
        <option value="ko">🇰🇷 한국어</option>
        <option value="en">🇺🇸 영어</option>
        <option value="ja">🇯🇵 일본어</option>
        <option value="zh">🇨🇳 중국어</option>
        <option value="es">🇪🇸 스페인어</option>
        <option value="fr">🇫🇷 프랑스어</option>
      </select>

      <button
        onClick={handleTranslate}
        disabled={translating}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          backgroundColor: translating ? '#ccc' : '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: translating ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        {translating ? '⏳ 번역 중...' : '🌐 번역'}
      </button>

      {transcript.some(item => item.translation) && (
        <button
          onClick={handleClearTranslation}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ❌ 번역 제거
        </button>
      )}
    </div>
  );
}

export default TranslationControls;


