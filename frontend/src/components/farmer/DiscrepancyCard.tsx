import React, { useState } from 'react';
import { Volume2, VolumeX, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock, FileText, ArrowRight } from 'lucide-react';
import type { DiscrepancyItem } from '../../types/models';
import { useTranslation } from '../../i18n';
import { speechPlayer } from '../../utils/audio';

interface DiscrepancyCardProps {
  item: DiscrepancyItem;
  onActionClick: (item: DiscrepancyItem) => void;
}

export const DiscrepancyCard: React.FC<DiscrepancyCardProps> = ({ item, onActionClick }) => {
  const { t, language } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [mathExpanded, setMathExpanded] = useState(false);

  const schemeName = language === 'en' ? item.scheme_name_en : ((item as any).scheme_name_chh || item.scheme_name_hi);
  const explanation = language === 'en' ? item.explanation_en : ((item as any).explanation_chh || item.explanation_hi);
  const speechText = language === 'en' ? item.speech_text_en : ((item as any).speech_text_chh || item.speech_text_hi);

  const handleToggleAudio = () => {
    if (isPlaying) {
      speechPlayer.stop();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      speechPlayer.speak(speechText, language as 'hi' | 'en' | 'chh', () => {
        setIsPlaying(false);
      });
    }
  };

  // Status Styling
  const getStatusBadge = () => {
    switch (item.status) {
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            {t('farmer.status_overdue')} ({item.days_overdue} {language === 'en' ? 'days' : 'दिन'})
          </span>
        );
      case 'OVERCHARGED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300">
            <AlertCircle className="w-3.5 h-3.5 text-red-700" />
            {t('farmer.status_overcharged')}
          </span>
        );
      case 'UNDERPAID':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300">
            <AlertCircle className="w-3.5 h-3.5 text-orange-700" />
            {t('farmer.status_underpaid')}
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            {t('farmer.status_paid')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            {item.status}
          </span>
        );
    }
  };

  const getActionButtonLabel = () => {
    switch (item.next_action) {
      case 'GENERATE_GRIEVANCE':
        return language === 'chh' ? '1-क्लिक शिकायत चिट्ठी बनावव' : language === 'hi' ? '1-क्लिक शिकायत पत्र तैयार करें' : 'Generate 1-Tap Grievance Letter';
      case 'SHOW_RECEIPT_AT_BRANCH':
        return language === 'chh' ? 'शाखा म रसीद देखावव' : language === 'hi' ? 'शाखा में रसीद प्रस्तुत करें' : 'Show Receipt at Branch';
      case 'CALL_HELPLINE':
        return language === 'chh' ? 'टोल-फ्री हेल्पलाइन म फोन करव' : language === 'hi' ? 'टोल-फ्री हेल्पलाइन पर कॉल करें' : 'Call Toll-Free Helpline';
      case 'DRY_AND_RETURN':
        return language === 'chh' ? 'धान सुखा के फिर लावव' : language === 'hi' ? 'फसल सुखाकर पुनः लाएं' : 'Dry Crop & Return';
      default:
        return language === 'chh' ? 'अगोरव (प्रतीक्षा)' : language === 'hi' ? 'प्रतीक्षा करें' : 'Wait';
    }
  };

  return (
    <div
      className={`bg-white rounded-3xl border shadow-sm transition-all overflow-hidden ${
        item.alert_flag ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
      }`}
    >
      {/* Card Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div>
          <span className="text-[10px] font-mono font-extrabold text-emerald-800 uppercase tracking-wider block mb-0.5">
            {item.rule_id}
          </span>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
            {schemeName}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <button
            onClick={handleToggleAudio}
            className={`touch-target px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all ${
              isPlaying
                ? 'bg-rose-700 text-white animate-pulse'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
            aria-label="Listen Explanation"
          >
            {isPlaying ? (
              <>
                <VolumeX className="w-4 h-4" />
                <span>{language === 'en' ? 'Stop' : 'रोकव'}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-emerald-200" />
                <span>{language === 'en' ? 'Listen' : 'सुनव'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4-Part Card Body In Strict Order */}
      <div className="p-5 sm:p-6 space-y-4">
        {/* ── PART 1: (1) What you should get ──────────────────────── */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
          <span className="text-xs font-bold text-emerald-800 block mb-1">
            {language === 'chh' ? '(1) तुमन ल का मिलना चाही' : language === 'hi' ? '(1) आपको क्या मिलना चाहिए' : '(1) What you should get'}
          </span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-950 block">
            {item.entitled_display}
          </span>
        </div>

        {/* ── PART 2: (2) Why (Rules, Formula & Expandable Steps) ──── */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">
              {language === 'chh' ? '(2) काबर (नियम सूत्र अउ गणना)' : language === 'hi' ? '(2) क्यों (नियम सूत्र एवं गणना)' : '(2) Why (Rules & Calculation Steps)'}
            </span>
            <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
              {language === 'en' ? 'Statutory Ref: 2026' : 'वैधानिक संदर्भ: 2026'}
            </span>
          </div>

          <div className="text-slate-700 leading-relaxed font-medium">
            {explanation}
          </div>

          <button
            type="button"
            onClick={() => setMathExpanded(!mathExpanded)}
            className="text-emerald-800 font-bold hover:underline flex items-center gap-1 pt-1"
          >
            <span>
              {mathExpanded
                ? (language === 'chh' ? 'गणना चरण लुकावव' : language === 'hi' ? 'गणना चरण छुपाएं' : 'Hide Math Steps')
                : (language === 'chh' ? 'विस्तृत गणना चरण देखव' : language === 'hi' ? 'विस्तृत गणना चरण देखें' : 'View Step-by-Step Math')}
            </span>
            {mathExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {mathExpanded && (
            <div className="mt-2 p-3 bg-white rounded-xl border border-slate-200 text-[11px] font-mono text-slate-600 space-y-1">
              <div>Rule Reference: {item.rule_id}</div>
              <div>Entitled Amount: {item.entitled_display} ({item.entitled_paise} paise)</div>
              <div>Received Amount: {item.received_display} ({item.received_paise} paise)</div>
              <div>Calculated Net Gap: {item.gap_display} (Tolerance: ₹1)</div>
            </div>
          )}
        </div>

        {/* ── PART 3: (3) What you actually got & Gap ───────────────── */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="font-bold text-amber-900 block mb-0.5">
              {language === 'chh' ? '(3) असली म का मिलीस' : language === 'hi' ? '(3) वास्तविक प्राप्ति' : '(3) What You Actually Received'}
            </span>
            <span className="text-xl font-black text-slate-900">
              {item.received_display}
            </span>
          </div>

          <div>
            <span className="font-bold text-amber-900 block mb-0.5">
              {language === 'chh' ? 'विसंगति / बाकी पइसा (Gap)' : language === 'hi' ? 'विसंगति / बकाया राशि (Gap)' : 'Discrepancy / Overdue Gap'}
            </span>
            <span
              className={`text-xl font-black ${
                item.gap_paise > 0 ? 'text-amber-800' : 'text-emerald-700'
              }`}
            >
              {item.gap_display}
            </span>
          </div>
        </div>

        {/* ── PART 4: (4) What to do next ───────────────────────────── */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-800">
              {language === 'chh' ? '(4) आगे का करना हे:' : language === 'hi' ? '(4) आगे की कार्रवाई:' : '(4) What to do next:'}
            </span>{' '}
            {item.next_action === 'GENERATE_GRIEVANCE'
              ? (language === 'chh' ? 'अधिकारी मन बर अपने-आप शिकायत चिट्ठी तैयार करव' : language === 'hi' ? 'अधिकारियों को प्रेषित करने हेतु स्वतः शिकायत पत्र तैयार करें' : 'Generate official grievance representation letter')
              : (language === 'chh' ? 'बैंक या समिति ले बात करव' : language === 'hi' ? 'बैंक अथवा समिति से संपर्क करें' : 'Contact bank branch or primary society')}
          </div>

          <button
            type="button"
            onClick={() => onActionClick(item)}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
          >
            <FileText className="w-4 h-4" />
            <span>{getActionButtonLabel()}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default DiscrepancyCard;
