import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { usePageContext } from '../../context/PageContext';
import { useVoiceInput } from './useVoiceInput';
import { useSpeechSynthesis } from './useSpeechSynthesis';
import { API_BASE_URL } from '../../services/api';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  displayText: string;
  ttsText: string;
  uiAction?: {
    type: string;
    route: string;
    fields?: Record<string, any>;
  };
  imageUrl?: string;
  timestamp: string;
}

export const ChatWidget: React.FC = () => {
  const { language } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    pageInfo,
    activeFarmerId,
    setPendingFields,
    speechLanguageCode,
  } = usePageContext();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(false);

  // Proactive Nudge state
  const [nudgePill, setNudgePill] = useState<{ text: string; query: string } | null>(null);
  const [isNudgeDismissed, setIsNudgeDismissed] = useState<boolean>(false);

  // Multimodal scan state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { isSpeaking, currentMessageId, speak, stop } = useSpeechSynthesis();

  // Voice Input hook
  const { isListening, isSupported: isVoiceSupported, toggleListening } = useVoiceInput({
    languageCode: speechLanguageCode,
    onTranscript: (transcript) => {
      setInputText(transcript);
    },
  });

  // Fetch safe profile info to generate zero-LLM proactive nudge
  useEffect(() => {
    const fetchNudge = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/chat/profiles`);
        if (res.ok) {
          const data = await res.json();
          const profiles = data.profiles || [];
          const current = profiles.find((p: any) => p.id === activeFarmerId) || profiles[0];
          if (current) {
            if (current.ekyc_pending) {
              setNudgePill({
                text: language === 'hi' || language === 'chh'
                  ? '⚠️ ई-केवाईसी लंबित: कृषक उन्नति बोनस स्थिति जांचें'
                  : '⚠️ eKYC Pending: Check your Paddy bonus release status',
                query: language === 'hi' || language === 'chh'
                  ? 'मेरी ई-केवाईसी और धान बोनस भुगतान की स्थिति क्या है?'
                  : 'What is my pending eKYC and paddy bonus status?',
              });
            } else if (current.land_acres) {
              setNudgePill({
                text: language === 'hi' || language === 'chh'
                  ? `🌾 ${current.land_acres} एकड़: 4% ब्याज पर KCC ऋण सीमा जानें`
                  : `🌾 ${current.land_acres} Acres: Calculate KCC loan limit at 4%`,
                query: language === 'hi' || language === 'chh'
                  ? `मेरी ${current.land_acres} एकड़ जमीन पर केसीसी ऋण सीमा कितनी है?`
                  : `What is my eligible KCC loan limit for ${current.land_acres} acres?`,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Could not load chat profiles for nudge:', err);
      }
    };
    fetchNudge();
  }, [activeFarmerId, language]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const isHi = language === 'hi' || language === 'chh';
      const welcomeDisplay = isHi
        ? 'नमस्ते! मैं बंदू (Bandu) हूँ, आपका जन-कृषि साथी। आप मुझसे बोलकर या लिखकर केसीसी ऋण, धान बोनस (₹3,100), अथवा किसी भी योजना की जानकारी ले सकते हैं।'
        : 'Namaste! I am Bandu, your JanAgri assistant. You can ask by voice or text about your KCC loan limit, Paddy bonus (₹3,100), or reject slips.';
      const welcomeTts = isHi
        ? 'नमस्ते! मैं बंदू हूँ, आपका जन-कृषि साथी। आप मुझसे बोलकर या लिखकर केसीसी ऋण, धान बोनस, अथवा किसी भी योजना की जानकारी ले सकते हैं।'
        : 'Namaste! I am Bandu, your JanAgri assistant. You can ask by voice or text about your KCC loan limit, Paddy bonus, or reject slips.';

      setMessages([
        {
          id: 'welcome-1',
          sender: 'bot',
          displayText: welcomeDisplay,
          ttsText: welcomeTts,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [language]);

  // Scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Handle Send text message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text && !selectedFile) return;

    // If a photo is selected, route to scan endpoint
    if (selectedFile) {
      handleScanUpload(selectedFile, text);
      return;
    }

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      displayText: text,
      ttsText: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.displayText,
      }));

      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Farmer-Id': activeFarmerId,
        },
        body: JSON.stringify({
          message: text,
          language: language,
          page_context: {
            page: pageInfo.page,
            route: location.pathname,
            summary: pageInfo.summary,
            visibleData: pageInfo.visibleData,
          },
          history: historyPayload,
        }),
      });

      if (!res.ok) throw new Error('Chat API failed');

      const data = await res.json();
      const botMsg: Message = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        displayText: data.display_text,
        ttsText: data.tts_text,
        uiAction: data.ui_action,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);

      // If UI action queued, navigate and pre-fill fields
      if (data.ui_action && data.ui_action.type === 'NAVIGATE_AND_FILL') {
        if (data.ui_action.fields) {
          setPendingFields(data.ui_action.fields);
        }
        if (data.ui_action.route && location.pathname !== data.ui_action.route) {
          navigate(data.ui_action.route);
        }
      }

      // Auto-speak if toggled on
      if (autoSpeak && data.tts_text) {
        speak(data.tts_text, speechLanguageCode, botMsg.id);
      }
    } catch (err) {
      console.error('Error during chat:', err);
      const isHi = language === 'hi' || language === 'chh';
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          displayText: isHi
            ? 'क्षमा करें, नेटवर्क सेवा में समस्या आई है। कृपया पुनः प्रयास करें अथवा हेल्पलाइन 1800-180-1551 पर संपर्क करें।'
            : 'Sorry, a temporary network issue occurred. Please retry or contact the Kisan Helpline at 1800-180-1551.',
          ttsText: isHi
            ? 'क्षमा करें, कृपया पुनः प्रयास करें।'
            : 'Sorry, please retry your query.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Photo Scan Upload
  const handleScanUpload = async (file: File, userPrompt?: string) => {
    const preview = URL.createObjectURL(file);
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      displayText: userPrompt || (language === 'en' ? 'Uploaded document for analysis' : 'दस्तावेज़ विश्लेषण हेतु अपलोड किया गया'),
      ttsText: '',
      imageUrl: preview,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setSelectedFile(null);
    setPreviewUrl(null);
    setInputText('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (userPrompt) formData.append('prompt', userPrompt);
      formData.append('language', language);

      const res = await fetch(`${API_BASE_URL}/api/chat/scan`, {
        method: 'POST',
        headers: {
          'X-Farmer-Id': activeFarmerId,
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Scan API failed');

      const data = await res.json();
      const botMsg: Message = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        displayText: data.display_text,
        ttsText: data.tts_text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);

      if (autoSpeak && data.tts_text) {
        speak(data.tts_text, speechLanguageCode, botMsg.id);
      }
    } catch (err) {
      console.error('Scan error:', err);
      const isHi = language === 'hi' || language === 'chh';
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          displayText: isHi
            ? 'दस्तावेज़ की समीक्षा पूर्ण नहीं हो सकी। कृपया सुनिश्चित करें कि फोटो साफ है।'
            : 'Could not complete document scanning. Please ensure the image is clear and retake.',
          ttsText: isHi ? 'कृपया पुनः प्रयास करें।' : 'Please try scanning again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      if (!isOpen) setIsOpen(true);
    }
  };

  const quickPrompts = [
    {
      title: language === 'hi' || language === 'chh' ? '🌾 धान बोनस (₹780)' : '🌾 Paddy Bonus (₹780)',
      query: language === 'hi' || language === 'chh' ? 'धान खरीद MSP और कृषक उन्नति बोनस ₹780 कब मिलेगा?' : 'When will my Paddy MSP and Krishak Unnati bonus ₹780 be released?',
    },
    {
      title: language === 'hi' || language === 'chh' ? '💳 केसीसी ऋण सीमा' : '💳 KCC Loan Limit',
      query: language === 'hi' || language === 'chh' ? 'मेरी जमीन पर 4% ब्याज पर KCC ऋण सीमा कितनी है?' : 'What is my eligible KCC loan limit at 4% prompt repayment rate?',
    },
    {
      title: language === 'hi' || language === 'chh' ? '⚠️ ई-केवाईसी स्थिति' : '⚠️ eKYC Status',
      query: language === 'hi' || language === 'chh' ? 'क्या मेरी ई-केवाईसी अथवा खाते में कोई रोक है?' : 'Is my eKYC pending or any payment bottleneck detected?',
    },
  ];

  return (
    <>
      {/* ── 1. PROACTIVE SMART NUDGE PILL (Zero LLM, Live DB flags) ── */}
      {!isOpen && nudgePill && !isNudgeDismissed && (
        <div className="fixed bottom-24 right-6 z-50 max-w-sm animate-bounce duration-1000">
          <div className="bg-emerald-900 border-2 border-amber-400/80 text-white rounded-2xl shadow-2xl p-3 flex items-start gap-2.5 backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <button
              onClick={() => {
                setIsOpen(true);
                handleSendMessage(nudgePill.query);
              }}
              className="text-left text-xs font-semibold leading-relaxed hover:text-amber-200 transition-colors flex-1"
            >
              {nudgePill.text}
              <span className="block text-[11px] text-amber-300 font-normal mt-0.5">
                {language === 'en' ? 'Tap to ask Bandu →' : 'बंदू से पूछें →'}
              </span>
            </button>
            <button
              onClick={() => setIsNudgeDismissed(true)}
              className="text-emerald-300 hover:text-white p-1"
              aria-label="Dismiss nudge"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── 2. FLOATING ACTION BUTTON (FAB) ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-2.5 bg-gradient-to-r from-emerald-800 to-green-900 hover:from-emerald-700 hover:to-green-800 text-white px-4 py-3 rounded-full shadow-2xl border-2 border-amber-400/70 transition-all duration-300 hover:scale-105 active:scale-95"
          aria-label="Open Bandu AI Assistant"
        >
          <div className="relative">
            <MessageSquare className="w-6 h-6 text-amber-300" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
          </div>
          <span className="font-semibold text-sm tracking-wide pr-1">
            {language === 'hi' || language === 'chh' ? 'बंदू (Bandu)' : 'Bandu'}
          </span>
        </button>
      )}

      {/* ── 3. DRAWER / EXPANDABLE CHAT INTERFACE ── */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[92vw] sm:w-[410px] h-[580px] max-h-[85vh] bg-white dark:bg-emerald-950 rounded-2xl shadow-2xl border-2 border-emerald-800/40 dark:border-amber-400/40 flex flex-col overflow-hidden transition-all duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-900 via-green-900 to-emerald-800 text-white px-4 py-3.5 flex items-center justify-between border-b border-amber-400/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-400/20 border border-amber-400/60 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide text-amber-200">
                  {language === 'hi' || language === 'chh' ? 'बंदू (Bandu)' : 'Bandu'}
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{pageInfo.page || 'Farmer Portal'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Auto-speak toggle */}
              <button
                onClick={() => setAutoSpeak(!autoSpeak)}
                title={autoSpeak ? 'Auto-speak ON' : 'Auto-speak OFF'}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 border ${
                  autoSpeak
                    ? 'bg-amber-400 text-emerald-950 border-amber-300 font-bold'
                    : 'bg-emerald-800/60 text-emerald-200 border-emerald-700'
                }`}
              >
                {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Close */}
              <button
                onClick={() => {
                  stop();
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/80 transition-colors"
                aria-label="Close Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages stream */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-emerald-50/40 dark:bg-emerald-950/40">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-r from-emerald-800 to-green-800 text-white rounded-br-none'
                      : 'bg-white dark:bg-emerald-900/90 text-gray-800 dark:text-emerald-50 border border-emerald-200 dark:border-emerald-700/60 rounded-bl-none'
                  }`}
                >
                  {/* Uploaded Image Preview */}
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt="Uploaded scan"
                      className="w-full max-h-40 object-cover rounded-lg mb-2 border border-emerald-300"
                    />
                  )}

                  <p className="whitespace-pre-line">{m.displayText}</p>

                  {/* UI Action badge if co-pilot navigated */}
                  {m.uiAction && (
                    <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-700/60 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-amber-300">
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span>{language === 'en' ? 'Screen Navigated & Pre-filled' : 'पृष्ठ नेविगेट एवं प्रपत्र भरा गया'}</span>
                    </div>
                  )}

                  {/* Audio Speaker per message */}
                  {m.sender === 'bot' && m.ttsText && (
                    <div className="mt-2 pt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-emerald-300">
                      <span>{m.timestamp}</span>
                      <button
                        onClick={() => speak(m.ttsText, speechLanguageCode, m.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-800 text-emerald-800 dark:text-amber-300 hover:bg-emerald-200 font-medium transition-colors"
                        title="Listen to message"
                      >
                        {isSpeaking && currentMessageId === m.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Speak</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 p-2.5 rounded-xl w-fit">
                <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                <span>{language === 'en' ? 'Checking statutory rules...' : 'नियमों की पुष्टि हो रही है...'}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick-Prompt Chips */}
          <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/60 border-t border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip.query)}
                className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-white dark:bg-emerald-800/90 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-700 transition-colors shadow-2xs"
              >
                {chip.title}
              </button>
            ))}
          </div>

          {/* Selected Photo Preview in input tray */}
          {previewUrl && (
            <div className="px-3 py-1.5 bg-amber-50 dark:bg-emerald-950 border-t border-amber-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <img src={previewUrl} alt="Preview" className="w-7 h-7 object-cover rounded border" />
                <span className="text-emerald-900 dark:text-emerald-200 font-medium">
                  {language === 'en' ? 'Photo ready to scan' : 'दस्तावेज़ फोटो तैयार है'}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Input & Voice Controls */}
          <div className="p-2.5 bg-white dark:bg-emerald-950 border-t border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
            {/* Hidden file input for Photo Scanner */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Camera / Photo Scan button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title={language === 'en' ? 'Scan rejection slip or soil card' : 'अस्वीकृति पर्ची या मृदा कार्ड स्कैन करें'}
              className="p-2 rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Voice Mic button with pulsing ring */}
            {isVoiceSupported && (
              <button
                onClick={toggleListening}
                title={isListening ? 'Stop listening' : 'Start voice input'}
                className={`p-2 rounded-xl transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-300 dark:ring-red-900'
                    : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={
                isListening
                  ? language === 'en' ? 'Listening...' : 'सुन रहे हैं...'
                  : language === 'en' ? 'Ask question or upload photo...' : 'सवाल पूछें या फोटो अपलोड करें...'
              }
              className="flex-1 text-sm px-3 py-2 rounded-xl bg-gray-50 dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700 text-gray-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />

            {/* Send button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={loading || (!inputText.trim() && !selectedFile)}
              className="p-2 rounded-xl bg-gradient-to-r from-emerald-800 to-green-800 text-white hover:from-emerald-700 hover:to-green-700 disabled:opacity-40 transition-all shadow-sm"
              aria-label="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
