import React, { useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { speakText, stopSpeech } from '../../utils/audio';

interface FieldVoiceSpeakerProps {
  textHi: string;
  textEn: string;
  textChh?: string;
  size?: 'sm' | 'md';
}

export const FieldVoiceSpeaker: React.FC<FieldVoiceSpeakerProps> = ({
  textHi,
  textEn,
  textChh,
  size = 'sm',
}) => {
  const { language } = useTranslation();
  const [playing, setPlaying] = useState(false);

  const handleSpeak = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (playing) {
      stopSpeech();
      setPlaying(false);
      return;
    }

    const textToSpeak = language === 'chh' ? (textChh || textHi) : language === 'hi' ? textHi : textEn;
    const langCode = language === 'en' ? 'en-IN' : 'hi-IN';

    setPlaying(true);
    speakText(
      textToSpeak,
      langCode,
      () => setPlaying(true),
      () => setPlaying(false)
    );
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className={`inline-flex items-center gap-1 rounded-full text-agri-dark hover:bg-agri-light/40 transition-colors p-1 ${
        size === 'sm' ? 'text-xs' : 'text-sm'
      }`}
      title={language === 'chh' ? 'एकर बारे म सुनव' : language === 'hi' ? 'इस फ़ील्ड के बारे में सुनें' : 'Listen about this field'}
      aria-label="Listen field description"
    >
      {playing ? (
        <Square className="w-3.5 h-3.5 text-rose-600 fill-current animate-pulse" />
      ) : (
        <Volume2 className="w-3.5 h-3.5 text-agri-dark" />
      )}
    </button>
  );
};
