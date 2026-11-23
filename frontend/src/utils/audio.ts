/**
 * Web Speech API audio helper for Hindi and English voice output.
 * Speaks speech_text with spelled-out Indian numbering words.
 */

class AudioPlayer {
  private _isSpeaking: boolean = false;

  speak(text: string, language: 'hi' | 'en' | 'chh', onStart?: () => void, onEnd?: () => void): boolean {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      return false;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'hi' || language === 'chh' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.9; // Slightly slower for low-literacy clarity
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this._isSpeaking = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this._isSpeaking = false;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      this._isSpeaking = false;
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  }

  stop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this._isSpeaking = false;
  }

  get speaking(): boolean {
    return this._isSpeaking;
  }
}

export const speechPlayer = new AudioPlayer();

export function speakText(
  text: string,
  lang: string,
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  const normLang = lang.startsWith('hi') ? 'hi' : 'en';
  return speechPlayer.speak(text, normLang, onStart, onEnd);
}

export function stopSpeech(): void {
  speechPlayer.stop();
}

export function isSpeaking(): boolean {
  return speechPlayer.speaking;
}
