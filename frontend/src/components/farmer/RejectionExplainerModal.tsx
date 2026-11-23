import React, { useState } from 'react';
import { X, AlertCircle, ShieldAlert, CheckCircle, Volume2, Square, Sparkles, Wheat, Edit3 } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { explainRejection } from '../../services/api';
import { speakText, stopSpeech } from '../../utils/audio';
import { FieldVoiceSpeaker } from '../common/FieldVoiceSpeaker';

interface RejectionExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RejectionExplainerModal: React.FC<RejectionExplainerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, language } = useTranslation();

  // State
  const [selectedCrop, setSelectedCrop] = useState<string>('Paddy (धान)');
  const [selectedChip, setSelectedChip] = useState<string>('REJ-MOISTURE');
  const [customReason, setCustomReason] = useState<string>('');
  const [moisture, setMoisture] = useState<string>('18.5');
  const [acres, setAcres] = useState<string>('2.5');
  const [qty, setQty] = useState<string>('60');

  const [loading, setLoading] = useState<boolean>(false);
  const [audioPlaying, setAudioPlaying] = useState<boolean>(false);
  const [result, setResult] = useState<{
    verdict: string;
    explanation_hi: string;
    explanation_en: string;
    speech_text_hi: string;
    speech_text_en: string;
    suggested_action: string;
  } | null>(null);

  if (!isOpen) return null;

  const crops = [
    { id: 'Paddy (धान)', labelHi: 'धान (Paddy)', labelEn: 'Paddy' },
    { id: 'Wheat (गेहूँ)', labelHi: 'गेहूँ (Wheat)', labelEn: 'Wheat' },
    { id: 'Maize (मक्का)', labelHi: 'मक्का (Maize)', labelEn: 'Maize' },
    { id: 'Soybean (सोयाबीन)', labelHi: 'सोयाबीन (Soybean)', labelEn: 'Soybean' },
    { id: 'Tur / Arhar (अरहर)', labelHi: 'अरहर / तूर (Tur)', labelEn: 'Tur / Arhar' },
    { id: 'Gram / Chana (चना)', labelHi: 'चना (Gram)', labelEn: 'Gram / Chana' },
    { id: 'Mustard (सरसों)', labelHi: 'सरसों (Mustard)', labelEn: 'Mustard' },
    { id: 'Ragi (रागी / कोदो-कुटकी)', labelHi: 'रागी / मिलेट्स (Ragi)', labelEn: 'Ragi / Millets' },
  ];

  const chips = [
    { id: 'REJ-MOISTURE', label: t('farmer.chip_moisture') },
    { id: 'REJ-LAND-LIMIT', label: t('farmer.chip_land_limit') },
    { id: 'REJ-AADHAAR', label: t('farmer.chip_aadhaar_mismatch') },
    { id: 'REJ-BANK-MISMATCH', label: t('farmer.chip_bank_mismatch') },
    { id: 'REJ-OTHER', label: t('farmer.chip_other') },
  ];

  const handleCheck = async () => {
    stopSpeech();
    setAudioPlaying(false);
    setLoading(true);
    setResult(null);

    try {
      const data = await explainRejection({
        crop_name: selectedCrop,
        reason_chip: selectedChip,
        custom_reason: selectedChip === 'REJ-OTHER' ? customReason : undefined,
        moisture_pct: selectedChip === 'REJ-MOISTURE' ? moisture : undefined,
        paddy_acres: selectedChip === 'REJ-LAND-LIMIT' ? acres : undefined,
        quantity_offered_quintals: selectedChip === 'REJ-LAND-LIMIT' ? qty : undefined,
      });
      setResult(data);
    } catch (err) {
      console.error('Error checking rejection:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAudio = () => {
    if (!result) return;
    if (audioPlaying) {
      stopSpeech();
      setAudioPlaying(false);
    } else {
      const text = language === 'en' ? result.speech_text_en : ((result as any).speech_text_chh || result.speech_text_hi);
      speakText(
        text,
        language === 'en' ? 'en-IN' : 'hi-IN',
        () => setAudioPlaying(true),
        () => setAudioPlaying(false)
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-surface-border overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-muted/50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-base text-text-primary">
              {t('farmer.rejection_modal_title')}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopSpeech();
              onClose();
            }}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Crop Selector (General for ALL crops) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-text-secondary uppercase flex items-center gap-1.5">
                <Wheat className="w-3.5 h-3.5 text-agri-dark" />
                <span>फसल का चयन करें / Select Crop</span>
              </label>
              <FieldVoiceSpeaker
                textHi="अपनी फसल चुनें, जैसे धान, गेहूँ, मक्का, सोयाबीन या चना।"
                textEn="Select your crop: Paddy, Wheat, Maize, Soybean, or Gram."
              />
            </div>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-surface-border bg-white text-xs sm:text-sm font-semibold focus:border-agri-dark"
            >
              {crops.map((c) => (
                <option key={c.id} value={c.id}>
                  {language === 'en' ? c.labelEn : c.labelHi}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-text-secondary uppercase">
                {t('farmer.rejection_chip_label')}
              </label>
              <FieldVoiceSpeaker
                textHi="मंडी अथवा बैंक द्वारा दिया गया अस्वीकृति कारण चुनें।"
                textEn="Select the rejection reason provided to you."
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setSelectedChip(chip.id)}
                  className={`text-left px-4 py-3 rounded-xl border text-xs sm:text-sm font-medium transition-colors flex items-center justify-between ${
                    selectedChip === chip.id
                      ? 'border-agri-dark bg-agri-light/30 text-agri-dark font-bold'
                      : 'border-surface-border bg-white text-text-primary hover:bg-surface-muted/50'
                  }`}
                >
                  <span>{chip.label}</span>
                  {selectedChip === chip.id && (
                    <span className="w-2.5 h-2.5 rounded-full bg-agri-dark" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Reason Textarea if "Other" is selected */}
          {selectedChip === 'REJ-OTHER' && (
            <div className="p-4 bg-amber-50/60 rounded-xl space-y-2 border border-amber-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                  <span>अपना अस्वीकृति कारण लिखें / Enter Specific Reason</span>
                </label>
                <FieldVoiceSpeaker
                  textHi="मंडी अधिकारी अथवा समिति द्वारा बताया गया अस्वीकृति कारण यहाँ विस्तार से लिखें।"
                  textEn="Type the specific rejection reason given to you by the mandi official."
                />
              </div>
              <textarea
                rows={3}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder={
                  language === 'en'
                    ? 'e.g., Mandi official stated server issue or quota exhausted for today...'
                    : 'उदा. समिति प्रबंधक ने सर्वर डाउन या टोकन समाप्त होने का कारण बताया...'
                }
                className="w-full px-3 py-2 border border-surface-border rounded-lg text-xs sm:text-sm bg-white focus:outline-agri-dark"
              />
              <p className="text-[11px] text-amber-800">
                वैधानिक नियमों के अनुसार बिना लिखित आदेश उपार्जन रोकना अमान्य है।
              </p>
            </div>
          )}

          {/* Conditional extra inputs */}
          {selectedChip === 'REJ-MOISTURE' && (
            <div className="p-4 bg-surface-muted/40 rounded-xl space-y-2 border border-surface-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-secondary">
                  Measured Moisture Content (%)
                </label>
                <FieldVoiceSpeaker
                  textHi="नमी मापक यंत्र द्वारा मापा गया प्रतिशत दर्ज करें।"
                  textEn="Enter moisture percentage measured by the moisture meter."
                />
              </div>
              <input
                type="number"
                step="0.1"
                value={moisture}
                onChange={(e) => setMoisture(e.target.value)}
                className="w-full px-3 py-2 border border-surface-border rounded-lg text-sm bg-white"
                placeholder="e.g. 18.5"
              />
              <p className="text-xs text-text-muted">
                Statutory limit: 17.0% for Paddy, 14.0% for other cereals. Values above require drying before weighing.
              </p>
            </div>
          )}

          {selectedChip === 'REJ-LAND-LIMIT' && (
            <div className="p-4 bg-surface-muted/40 rounded-xl space-y-3 border border-surface-border">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-text-secondary">
                    Registered Sown Area (Acres)
                  </label>
                  <FieldVoiceSpeaker
                    textHi="गिरदावरी में दर्ज अपना बोया गया रकबा एकड़ में दर्ज करें।"
                    textEn="Enter your sown area in acres as registered in Girdawari."
                  />
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={acres}
                  onChange={(e) => setAcres(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg text-sm bg-white"
                  placeholder="e.g. 2.5"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-text-secondary">
                    Quantity Offered (Quintals)
                  </label>
                  <FieldVoiceSpeaker
                    textHi="उपार्जन हेतु प्रस्तावित मात्रा क्विंटल में दर्ज करें।"
                    textEn="Enter quantity offered in quintals."
                  />
                </div>
                <input
                  type="number"
                  step="0.5"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-border rounded-lg text-sm bg-white"
                  placeholder="e.g. 60"
                />
              </div>
              <p className="text-xs text-text-muted">
                Paddy cap = Acres × 21 quintals. Maximum eligible is {(parseFloat(acres || '0') * 21).toFixed(2)} quintals.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleCheck}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-agri-dark text-white font-bold text-sm hover:bg-agri-primary transition-colors min-h-[48px] flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-agri-accent" />
            {loading ? 'Analyzing with Rules...' : t('farmer.btn_check_verdict')}
          </button>

          {/* Verdict Result Card */}
          {result && (
            <div
              className={`p-5 rounded-2xl border space-y-3 ${
                result.verdict === 'WRONGFUL'
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    result.verdict === 'WRONGFUL'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {result.verdict === 'WRONGFUL' ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      UNJUSTIFIED / WRONGFUL REJECTION
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      STATUTORY REJECTION JUSTIFIED
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={handleAudio}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-surface-border shadow-xs text-xs font-bold text-agri-dark hover:bg-agri-light/40"
                >
                  {audioPlaying ? (
                    <>
                      <Square className="w-3.5 h-3.5 text-rose-600" />
                      {t('farmer.stop_audio')}
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-agri-dark" />
                      {t('farmer.listen_button')}
                    </>
                  )}
                </button>
              </div>

              <div className="text-sm text-text-primary font-medium leading-relaxed">
                {language === 'en' ? result.explanation_en : ((result as any).explanation_chh || result.explanation_hi)}
              </div>

              <div className="pt-2 border-t border-black/10">
                <span className="text-xs font-bold text-text-secondary block mb-1">
                  {t('farmer.card_next_action')}:
                </span>
                <span className="text-xs font-semibold text-agri-dark block">
                  {result.suggested_action}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
