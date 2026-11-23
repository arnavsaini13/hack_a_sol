import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  RefreshCw,
  Gift,
  Users,
  Files,
  Volume2,
  Square,
  Search,
  X,
  ArrowRight
} from 'lucide-react';
import { evaluateSchemes, applyFarmerScheme, getAppliedSchemes } from '../../services/api';
import { useTranslation } from '../../i18n';
import { speechPlayer } from '../../utils/audio';
import type { FarmerSnapshot, FarmerProfile } from '../../types/models';

interface SchemesEligibilityTabProps {
  farmer?: FarmerProfile;
  snapshot?: FarmerSnapshot | null;
  onNavigateToCases?: () => void;
}

export const SchemesEligibilityTab: React.FC<SchemesEligibilityTabProps> = ({
  farmer: _farmer,
  snapshot: _snapshot,
  onNavigateToCases,
}) => {
  const { language } = useTranslation();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [appliedCodes, setAppliedCodes] = useState<Set<string>>(new Set());
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [playingSchemeId, setPlayingSchemeId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({
    kcc_repaid_within_12m: true,
    kuy_moisture_ok: true,
    pmfby_calamity_72h: true,
    pmkisan_income_tax: false,
    pmkisan_ekyc_done: true,
    sujala_has_water: true,
    sujala_has_grid: false,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Audio Voice Summary for an individual scheme
  const handleToggleVoice = (scheme: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingSchemeId === scheme.scheme_id) {
      speechPlayer.stop();
      setPlayingSchemeId(null);
      return;
    }

    speechPlayer.stop();
    const name = language === 'en' ? scheme.scheme_name_en : ((scheme as any).scheme_name_chh || scheme.scheme_name_hi);
    const cat = scheme.category || '';
    const gives = language === 'en' ? scheme.explainer?.what_it_gives_en : ((scheme.explainer as any)?.what_it_gives_chh || scheme.explainer?.what_it_gives_hi);
    const who = language === 'en' ? scheme.explainer?.who_qualifies_en : ((scheme.explainer as any)?.who_qualifies_chh || scheme.explainer?.who_qualifies_hi);
    const rule = language === 'en' ? scheme.rule_reason_en : ((scheme as any).rule_reason_chh || scheme.rule_reason_hi);

    let summary = '';
    if (language === 'chh') {
      summary = `${name}। श्रेणी: ${cat}। का मिलही: ${gives || ''}। पात्रता: ${who || ''}। सरकारी नियम: ${rule || ''}।`;
    } else if (language === 'hi') {
      summary = `${name}। श्रेणी: ${cat}। क्या मिलता है: ${gives || ''}। कौन पात्र है: ${who || ''}। सरकारी नियम: ${rule || ''}।`;
    } else {
      summary = `${name}. Category: ${cat}. What it gives: ${gives || ''}. Who qualifies: ${who || ''}. Statutory rule: ${rule || ''}.`;
    }

    setPlayingSchemeId(scheme.scheme_id);
    speechPlayer.speak(
      summary,
      language,
      () => setPlayingSchemeId(scheme.scheme_id),
      () => setPlayingSchemeId(null)
    );
  };

  const fetchEligibility = useCallback(async (currentAnswers: Record<string, any>) => {
    setLoading(true);
    try {
      const res = await evaluateSchemes(currentAnswers);
      setData(res);
      // Auto-expand first scheme if none expanded
      if (!expandedId && res?.eligible_schemes?.length > 0) {
        setExpandedId(res.eligible_schemes[0].scheme_id);
      }
    } catch (err) {
      console.error('Failed to evaluate schemes:', err);
    } finally {
      setLoading(false);
    }
  }, [expandedId]);

  useEffect(() => {
    fetchEligibility(answers);
    // Fetch already applied schemes to sync button state
    getAppliedSchemes()
      .then((res) => {
        if (res?.applied_schemes) {
          setAppliedCodes(new Set(res.applied_schemes.map((s) => s.scheme_code)));
        }
      })
      .catch((err) => console.error('Failed to load applied schemes:', err));
  }, []);

  const handleApplyScheme = async (scheme: any) => {
    if (appliedCodes.has(scheme.scheme_id)) {
      if (onNavigateToCases) {
        onNavigateToCases();
      } else {
        window.dispatchEvent(new CustomEvent('switch-to-cases-tab'));
      }
      return;
    }

    setApplyingCode(scheme.scheme_id);
    try {
      let entitledPaise = 2849600;
      if (scheme.scheme_id.includes('KCC')) entitledPaise = 600000;
      else if (scheme.scheme_id.includes('PMFBY')) entitledPaise = 3360000;
      else if (scheme.scheme_id.includes('PM_KISAN')) entitledPaise = 600000;
      else if (scheme.scheme_id.includes('SUJALA')) entitledPaise = 21500000;

      await applyFarmerScheme({
        scheme_code: scheme.scheme_id,
        scheme_name: language === 'en' ? scheme.scheme_name_en : ((scheme as any).scheme_name_chh || scheme.scheme_name_hi),
        entitled_paise: entitledPaise,
        official_portal_url: scheme.official_portal_url,
        expected_release_date: scheme.scheme_id.includes('PMFBY') ? '2026-12-25' : '2026-12-15',
      });

      // No external redirect - locally tracks in Section A of Gaps & Cases
      setAppliedCodes((prev) => new Set([...prev, scheme.scheme_id]));
      setToastMsg(
        language === 'hi'
          ? 'योजना आवेदन दर्ज! भाग (A) "विसंगति व शिकायतें" में स्थानांतरित किया जा रहा है...'
          : language === 'chh'
          ? 'योजना आवेदन दर्ज! भाग (A) विसंगति अउ शिकायत टैब म ले जाए जात हे...'
          : 'Application recorded! Moving to Section A in Gaps & Cases...'
      );
      setTimeout(() => {
        if (onNavigateToCases) {
          onNavigateToCases();
        } else {
          window.dispatchEvent(new CustomEvent('switch-to-cases-tab'));
        }
      }, 600);
    } catch (err) {
      console.error('Failed to record scheme application:', err);
    } finally {
      setApplyingCode(null);
    }
  };

  const handleToggleAnswer = (questionId: string, value: any) => {
    const updated = { ...answers, [questionId]: value };
    setAnswers(updated);
    fetchEligibility(updated);
  };

  // Search Filter
  const filterScheme = (scheme: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameEn = (scheme.scheme_name_en || '').toLowerCase();
    const nameHi = (scheme.scheme_name_hi || '').toLowerCase();
    const cat = (scheme.category || '').toLowerCase();
    const ruleId = (scheme.rule_id || '').toLowerCase();
    const givesHi = (scheme.explainer?.what_it_gives_hi || '').toLowerCase();
    const givesEn = (scheme.explainer?.what_it_gives_en || '').toLowerCase();
    return (
      nameEn.includes(q) ||
      nameHi.includes(q) ||
      cat.includes(q) ||
      ruleId.includes(q) ||
      givesHi.includes(q) ||
      givesEn.includes(q)
    );
  };

  const eligibleList = (data?.eligible_schemes || []).filter(filterScheme);
  const notEligibleList = (data?.not_eligible_schemes || []).filter(filterScheme);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center justify-between shadow-xs animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onNavigateToCases) onNavigateToCases();
              else window.dispatchEvent(new CustomEvent('switch-to-cases-tab'));
            }}
            className="text-indigo-700 underline font-extrabold hover:text-indigo-900 ml-3"
          >
            {language === 'chh' ? 'अभि देखव ->' : language === 'hi' ? 'अभी देखें ->' : 'View in Gaps & Cases ->'}
          </button>
        </div>
      )}

      {/* Intro Trust Banner */}
      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {language === 'chh'
              ? '5 प्रमुख सरकारी योजना मन के सरकारी पात्रता जांच (कृषि विकास अउ किसान कल्याण विभाग)।'
              : language === 'hi'
              ? '5 प्रमुख सरकारी योजनाओं की आधिकारिक वैधानिक पात्रता जांच (कृषि विकास एवं किसान कल्याण विभाग).'
              : 'Statutory eligibility evaluation across 5 flagship government schemes.'}
          </span>
        </div>
        <div className="text-[11px] font-semibold text-emerald-800">
          {language === 'en' ? 'Govt of Chhattisgarh • 2026' : 'छत्तीसगढ़ शासन • 2026'}
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center p-12 space-y-2">
          <RefreshCw className="w-6 h-6 text-emerald-700 animate-spin" />
        </div>
      )}

      {/* Scheme Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'hi'
                ? 'योजना खोजें (उदा. धान खरीदी, KCC ऋण, फसल बीमा, सौर सुजला)...'
                : language === 'chh'
                ? 'योजना खोजव (जैसे धान, केसीसी, बीमा, सोलर)...'
                : 'Search schemes by name, category, or rule (e.g. Paddy, KCC, Crop Insurance, Solar)...'
            }
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-slate-50/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <span className="text-xs text-slate-500 font-medium shrink-0">
            {language === 'chh'
              ? `${eligibleList.length + notEligibleList.length} योजना मन मिलिस`
              : language === 'hi'
              ? `${eligibleList.length + notEligibleList.length} योजनाएं मिलीं`
              : `${eligibleList.length + notEligibleList.length} schemes found`}
          </span>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION 1: ELIGIBLE FOR YOU / आपके लिए पात्र योजनाएँ           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-600" />
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              {language === 'chh' ? 'तुमन बर पात्र योजना मन (Eligible Schemes)' : language === 'hi' ? 'आपके लिए पात्र योजनाएँ (Eligible For You)' : 'Eligible For You'}
            </h3>
            <span className="text-xs bg-emerald-100 text-emerald-900 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300">
              {eligibleList.length}
            </span>
          </div>
        </div>

        {eligibleList.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
            {language === 'chh' ? 'अभि कउनो पात्र योजना नइ हे।' : language === 'hi' ? 'वर्तमान में कोई पात्र योजना नहीं है।' : 'No schemes currently eligible.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {eligibleList.map((scheme: any) => {
              const isExpanded = expandedId === scheme.scheme_id;
              const name = language === 'en' ? scheme.scheme_name_en : (scheme.scheme_name_chh || scheme.scheme_name_hi);
              const verdict = language === 'en' ? scheme.verdict_en : (scheme.verdict_chh || scheme.verdict_hi);
              const ruleReason = language === 'en' ? scheme.rule_reason_en : (scheme.rule_reason_chh || scheme.rule_reason_hi);
              const explainer = scheme.explainer || {};

              return (
                <div
                  key={scheme.scheme_id}
                  className="bg-white rounded-3xl border-2 border-emerald-200 shadow-sm overflow-hidden transition-all"
                >
                  {/* Card Header (Click to expand) */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : scheme.scheme_id)}
                    className="p-5 sm:p-6 cursor-pointer flex flex-wrap items-center justify-between gap-3 hover:bg-emerald-50/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                          {scheme.rule_id}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {scheme.category}
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                        {name}
                      </h4>
                      <p className="text-xs text-emerald-800 font-medium">
                        ✓ {ruleReason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Direct Apply for Scheme Button in Header */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyScheme(scheme);
                        }}
                        disabled={applyingCode === scheme.scheme_id}
                        className={`px-3.5 py-2 rounded-xl font-extrabold text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors ${
                          appliedCodes.has(scheme.scheme_id)
                            ? 'bg-indigo-700 hover:bg-indigo-800 text-white'
                            : 'bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white'
                        }`}
                        title={language === 'en' ? 'Apply for Scheme and track in Section A' : 'योजना बर आवेदन करव अउ भाग (A) म ट्रैक करव'}
                      >
                        {applyingCode === scheme.scheme_id ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>{language === 'chh' ? 'आवेदन दर्ज...' : language === 'hi' ? 'आवेदन दर्ज...' : 'Applying...'}</span>
                          </>
                        ) : appliedCodes.has(scheme.scheme_id) ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                            <span>{language === 'chh' ? 'आवेदन दर्ज • भाग (A) देखव ->' : language === 'hi' ? 'आवेदन दर्ज • भाग (A) देखें ->' : 'Applied • View (A) ->'}</span>
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>{language === 'hi' ? 'योजना के लिए आवेदन करें ->' : language === 'chh' ? 'योजना बर आवेदन करव ->' : 'Apply for Scheme ->'}</span>
                          </>
                        )}
                      </button>

                      {/* Individual Scheme Voice Summary */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleVoice(scheme, e)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                          playingSchemeId === scheme.scheme_id
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
                        }`}
                        title={language === 'en' ? 'Listen to scheme summary' : 'योजना सारांश सुनव'}
                      >
                        {playingSchemeId === scheme.scheme_id ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current text-white" />
                            <span className="text-[11px]">{language === 'en' ? 'Stop' : 'रोकव'}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span className="text-[11px]">
                              {language === 'chh' ? 'सुनव' : language === 'hi' ? 'सुनें' : 'Listen'}
                            </span>
                          </>
                        )}
                      </button>

                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{language === 'en' ? 'Eligible' : 'पात्र (Eligible)'}</span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Panel: Simple Policy Explainer + Q&A + Apply Button */}
                  {isExpanded && (
                    <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/60 space-y-5 animate-in fade-in">
                      {/* 1. Simple Policy Explainer (3 Short Bullets) */}
                      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-emerald-700" />
                            <span>{language === 'chh' ? 'सरल नीति मार्गदर्शिका' : language === 'hi' ? 'सरल नीति मार्गदर्शिका' : 'Simple Policy Explainer'}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {scheme.provenance}
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {/* Bullet 1: What it gives */}
                          <div className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                              <Gift className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <strong className="text-slate-900 block">
                                {language === 'chh' ? 'का मिलही (फायदा):' : language === 'hi' ? 'क्या मिलता है (What it gives):' : 'What it gives:'}
                              </strong>
                              <span className="text-slate-600 leading-relaxed">
                                {language === 'en' ? explainer.what_it_gives_en : (explainer.what_it_gives_chh || explainer.what_it_gives_hi)}
                              </span>
                            </div>
                          </div>

                          {/* Bullet 2: Who qualifies */}
                          <div className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0 mt-0.5">
                              <Users className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <strong className="text-slate-900 block">
                                {language === 'chh' ? 'कउन पात्र हे (पात्रता):' : language === 'hi' ? 'कौन पात्र है (Who qualifies):' : 'Who qualifies:'}
                              </strong>
                              <span className="text-slate-600 leading-relaxed">
                                {language === 'en' ? explainer.who_qualifies_en : (explainer.who_qualifies_chh || explainer.who_qualifies_hi)}
                              </span>
                            </div>
                          </div>

                          {/* Bullet 3: Documents needed */}
                          <div className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                              <Files className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <strong className="text-slate-900 block">
                                {language === 'chh' ? 'जरूरी कागजात (दस्तावेज):' : language === 'hi' ? 'आवश्यक दस्तावेज (Documents needed):' : 'Documents needed:'}
                              </strong>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {(language === 'en' ? explainer.documents_needed_en : (explainer.documents_needed_chh || explainer.documents_needed_hi))?.map(
                                  (doc: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200"
                                    >
                                      {doc}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. Interactive Policy Q&A (Re-evaluates Live via Python Engine) */}
                      {scheme.questions && scheme.questions.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                          <span className="text-xs font-bold text-slate-700 block">
                            {language === 'chh'
                              ? 'सत्यापन सवाल (जवाब बदले म पात्रता तुरंत बदलही):'
                              : language === 'hi'
                              ? 'सत्यापन प्रश्न (उत्तर बदलने पर पात्रता तुरंत बदलेगी):'
                              : 'Verification Questions (Answers re-evaluate live via Python rules):'}
                          </span>

                          <div className="space-y-2">
                            {scheme.questions.map((q: any) => {
                              const qText = language === 'en' ? q.question_text_en : (q.question_text_chh || q.question_text_hi);
                              const currentVal = answers[q.question_id];

                              return (
                                <div
                                  key={q.question_id}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                                >
                                  <span className="font-semibold text-slate-800">{qText}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAnswer(q.question_id, true)}
                                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                        currentVal === true
                                          ? 'bg-emerald-700 text-white shadow-xs'
                                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                                      }`}
                                    >
                                      {language === 'chh' ? 'हव (Yes)' : language === 'hi' ? 'हाँ (Yes)' : 'Yes'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAnswer(q.question_id, false)}
                                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                        currentVal === false
                                          ? 'bg-rose-700 text-white shadow-xs'
                                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                                      }`}
                                    >
                                      {language === 'chh' ? 'नइ (No)' : language === 'hi' ? 'नहीं (No)' : 'No'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 3. Verdict Banner & Direct Official Apply Portal Link */}
                      <div className="p-4 rounded-2xl bg-emerald-100/70 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                          <div>
                            <span className="font-extrabold text-emerald-950 block text-sm">
                              {language === 'chh' ? 'तुमन पात्र हव (You Are Eligible)' : language === 'hi' ? 'आप पात्र हैं (You Are Eligible)' : 'You Are Eligible'}
                            </span>
                            <span className="text-xs text-emerald-800">
                              {verdict}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApplyScheme(scheme)}
                          disabled={applyingCode === scheme.scheme_id}
                          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs inline-flex items-center justify-center gap-2 shadow-xs min-h-[44px] shrink-0 transition-colors ${
                            appliedCodes.has(scheme.scheme_id)
                              ? 'bg-indigo-700 hover:bg-indigo-800 text-white'
                              : 'bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white'
                          }`}
                        >
                          {applyingCode === scheme.scheme_id ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>{language === 'chh' ? 'आवेदन दर्ज होवत हे...' : language === 'hi' ? 'आवेदन दर्ज हो रहा है...' : 'Recording Application...'}</span>
                            </>
                          ) : appliedCodes.has(scheme.scheme_id) ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                              <span>
                                {language === 'hi'
                                  ? 'आवेदन दर्ज • विसंगति जांचें (भाग A) ->'
                                  : language === 'chh'
                                  ? 'आवेदन दर्ज • विसंगति जांचव (भाग A) ->'
                                  : 'Applied • Track in Gaps & Cases (Section A) ->'}
                              </span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                              <span>
                                {language === 'hi' ? 'योजना के लिए आवेदन करें' : language === 'chh' ? 'योजना बर आवेदन करव' : 'Apply for Scheme'}
                              </span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION 2: NOT CURRENTLY ELIGIBLE / वर्तमान में अपात्र          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              {language === 'chh' ? 'अभि अपात्र (Not Currently Eligible)' : language === 'hi' ? 'वर्तमान में अपात्र (Not Currently Eligible)' : 'Not Currently Eligible'}
            </h3>
            <span className="text-xs bg-amber-100 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
              {notEligibleList.length}
            </span>
          </div>
        </div>

        {notEligibleList.length === 0 ? (
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {language === 'chh'
                ? 'बधाई! तुमन सबो मूल्यांकित योजना मन के शर्त पूरा करथव।'
                : language === 'hi'
                ? 'बधाई! आप सभी मूल्यांकित योजनाओं की शर्तों को पूर्ण करते हैं।'
                : 'All evaluated statutory schemes meet eligibility criteria.'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {notEligibleList.map((scheme: any) => {
              const isExpanded = expandedId === scheme.scheme_id;
              const name = language === 'en' ? scheme.scheme_name_en : (scheme.scheme_name_chh || scheme.scheme_name_hi);
              const verdict = language === 'en' ? scheme.verdict_en : (scheme.verdict_chh || scheme.verdict_hi);
              const ruleReason = language === 'en' ? scheme.rule_reason_en : (scheme.rule_reason_chh || scheme.rule_reason_hi);
              const explainer = scheme.explainer || {};

              return (
                <div
                  key={scheme.scheme_id}
                  className="bg-white rounded-3xl border border-slate-300 shadow-xs overflow-hidden opacity-90 transition-all"
                >
                  {/* Card Header */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : scheme.scheme_id)}
                    className="p-5 sm:p-6 cursor-pointer flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">
                          {scheme.rule_id}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {scheme.category}
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
                        {name}
                      </h4>
                      <p className="text-xs text-amber-800 font-semibold">
                        ⚠ {ruleReason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Individual Scheme Voice Summary */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleVoice(scheme, e)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                          playingSchemeId === scheme.scheme_id
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200'
                        }`}
                        title={language === 'en' ? 'Listen to scheme summary' : 'योजना सारांश सुनव'}
                      >
                        {playingSchemeId === scheme.scheme_id ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current text-white" />
                            <span className="text-[11px]">{language === 'en' ? 'Stop' : 'रोकव'}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-slate-700" />
                            <span className="text-[11px]">
                              {language === 'chh' ? 'सुनव' : language === 'hi' ? 'सुनें' : 'Listen'}
                            </span>
                          </>
                        )}
                      </button>

                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>{language === 'chh' ? 'अभि अपात्र (Not Eligible)' : language === 'hi' ? 'वर्तमान में अपात्र' : 'Not Eligible'}</span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Panel */}
                  {isExpanded && (
                    <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/60 space-y-4 animate-in fade-in">
                      {/* Reason for Ineligibility */}
                      <div className="bg-white p-4 rounded-2xl border border-amber-200 text-xs space-y-2 bg-amber-50/30">
                        <span className="font-bold text-amber-950 block text-[11px] uppercase tracking-wider">
                          {language === 'chh' ? 'अपात्रता के कानूनी कारण:' : language === 'hi' ? 'अपात्रता का वैधानिक कारण:' : 'Statutory Reason for Ineligibility:'}
                        </span>
                        <p className="text-amber-900 leading-relaxed font-semibold">
                          {ruleReason}
                        </p>
                        <p className="text-slate-600 text-[11px]">
                          {verdict}
                        </p>
                      </div>

                      {/* Simple Policy Explainer */}
                      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-emerald-700" />
                            <span>{language === 'chh' ? 'सरल नीति मार्गदर्शिका' : language === 'hi' ? 'सरल नीति मार्गदर्शिका' : 'Simple Policy Explainer'}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {scheme.provenance}
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {/* Bullet 1: What it gives */}
                          <div className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                              <Gift className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <strong className="text-slate-900 block">
                                {language === 'chh' ? 'का मिलही (What it gives):' : language === 'hi' ? 'क्या मिलता है (What it gives):' : 'What it gives:'}
                              </strong>
                              <span className="text-slate-600 leading-relaxed">
                                {language === 'en' ? explainer.what_it_gives_en : ((explainer as any).what_it_gives_chh || explainer.what_it_gives_hi)}
                              </span>
                            </div>
                          </div>

                          {/* Bullet 2: Who qualifies */}
                          <div className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0 mt-0.5">
                              <Users className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <strong className="text-slate-900 block">
                                {language === 'chh' ? 'कउन पात्र हे (Who qualifies):' : language === 'hi' ? 'कौन पात्र है (Who qualifies):' : 'Who qualifies:'}
                              </strong>
                              <span className="text-slate-600 leading-relaxed">
                                {language === 'en' ? explainer.who_qualifies_en : ((explainer as any).who_qualifies_chh || explainer.who_qualifies_hi)}
                              </span>
                            </div>
                          </div>

                          {/* Bullet 3: Documents needed */}
                          <div className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                              <Files className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <strong className="text-slate-900 block">
                                {language === 'chh' ? 'जरूरी कागजात (Documents needed):' : language === 'hi' ? 'आवश्यक दस्तावेज (Documents needed):' : 'Documents needed:'}
                              </strong>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {(language === 'en' ? explainer.documents_needed_en : ((explainer as any).documents_needed_chh || explainer.documents_needed_hi))?.map(
                                  (doc: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200"
                                    >
                                      {doc}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Q&A for What-If scenario */}
                      {scheme.questions && scheme.questions.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                          <span className="text-xs font-bold text-slate-700 block">
                            {language === 'chh'
                              ? 'शर्त मन म बदलाव के जांच करव:'
                              : language === 'hi'
                              ? 'शर्तों में परिवर्तन की जाँच करें:'
                              : 'Test Alternative Conditions Live:'}
                          </span>

                          <div className="space-y-2">
                            {scheme.questions.map((q: any) => {
                              const qText = language === 'en' ? q.question_text_en : ((q as any).question_text_chh || q.question_text_hi);
                              const currentVal = answers[q.question_id];

                              return (
                                <div
                                  key={q.question_id}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                                >
                                  <span className="font-semibold text-slate-800">{qText}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAnswer(q.question_id, true)}
                                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                        currentVal === true
                                          ? 'bg-emerald-700 text-white shadow-xs'
                                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                                      }`}
                                    >
                                      {language === 'chh' ? 'हव (Yes)' : language === 'hi' ? 'हाँ (Yes)' : 'Yes'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAnswer(q.question_id, false)}
                                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                        currentVal === false
                                          ? 'bg-rose-700 text-white shadow-xs'
                                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                                      }`}
                                    >
                                      {language === 'chh' ? 'नइ (No)' : language === 'hi' ? 'नहीं (No)' : 'No'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default SchemesEligibilityTab;
