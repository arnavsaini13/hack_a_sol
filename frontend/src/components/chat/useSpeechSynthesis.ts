import { useState, useEffect, useCallback, useRef } from 'react';

export const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setCurrentMessageId(null);
    }
  }, []);

  const speak = useCallback(
    (text: string, languageCode: string, messageId?: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
        return;
      }

      // If already playing this message, stop it
      if (isSpeaking && currentMessageId === messageId) {
        stop();
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.lang = languageCode;

      // Find suitable voice matching language
      const targetLang = languageCode.toLowerCase();
      const matchedVoice = voicesRef.current.find(
        (v) =>
          v.lang.toLowerCase() === targetLang ||
          v.lang.toLowerCase().startsWith(targetLang.split('-')[0])
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (messageId) setCurrentMessageId(messageId);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentMessageId(null);
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        setIsSpeaking(false);
        setCurrentMessageId(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSpeaking, currentMessageId, stop]
  );

  return {
    isSpeaking,
    currentMessageId,
    speak,
    stop,
  };
};
